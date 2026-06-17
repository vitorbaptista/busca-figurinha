package br.com.fiquemsabendo.figurinhas.scan

import android.content.Context
import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.camera.downscaleTo
import br.com.fiquemsabendo.figurinhas.data.CameraFacing
import br.com.fiquemsabendo.figurinhas.data.CollectionRepository
import br.com.fiquemsabendo.figurinhas.data.SessionRepository
import br.com.fiquemsabendo.figurinhas.data.SettingsRepository
import br.com.fiquemsabendo.figurinhas.data.collectionDataStore
import br.com.fiquemsabendo.figurinhas.data.sessionDataStore
import br.com.fiquemsabendo.figurinhas.data.settingsDataStore
import br.com.fiquemsabendo.figurinhas.domain.Checklist
import br.com.fiquemsabendo.figurinhas.domain.Session
import br.com.fiquemsabendo.figurinhas.domain.SessionReport
import br.com.fiquemsabendo.figurinhas.data.checklist as defaultChecklist
import br.com.fiquemsabendo.figurinhas.domain.matchCode
import br.com.fiquemsabendo.figurinhas.ocr.CapturePhase
import br.com.fiquemsabendo.figurinhas.ocr.CaptureTrigger
import br.com.fiquemsabendo.figurinhas.ocr.CodeBox
import br.com.fiquemsabendo.figurinhas.ocr.CodeBoxSource
import br.com.fiquemsabendo.figurinhas.ocr.FrameRecognizer
import br.com.fiquemsabendo.figurinhas.ocr.GrayImage
import br.com.fiquemsabendo.figurinhas.ocr.GlyphOnlyRecognizer
import br.com.fiquemsabendo.figurinhas.ocr.GlyphRecognizer
import br.com.fiquemsabendo.figurinhas.ocr.codeCropCandidates
import br.com.fiquemsabendo.figurinhas.ocr.Roi
import br.com.fiquemsabendo.figurinhas.ocr.findCodeBoxes
import br.com.fiquemsabendo.figurinhas.ocr.frameDiff
import br.com.fiquemsabendo.figurinhas.ocr.loadAtlas
import br.com.fiquemsabendo.figurinhas.ocr.recognizeFrameInOrder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.withContext

// The Android orchestrator (ports src/ui/screens/ScanScreen.tsx's loop). The Composable owns the
// camera Preview surface + the use-case binding; this ViewModel owns the recognition wiring:
//
//   camera analyzer → onLumaFrame → frame-diff → CaptureTrigger → (on FIRE) a serialized burst that
//   runs recognizeFrameInOrder on a background dispatcher → ScanController (confirm + commit) →
//   ScanFeedback emitted to the UI.
//
// It is deliberately Compose-free and Camera-free: the screen reads the StateFlows/SharedFlow below
// and renders flash/multi/beep/haptic/counters/recent (the side effects ScanScreen.tsx kept in its
// view layer). ScanController stays the pure 0-FP decision core; this is only the async plumbing
// around it.

/** Running KEEP/REPEAT tallies shown in the top bar — the ViewModel-side mirror of ScanScreen's
 *  `counters` state, accumulating the per-batch deltas from each ScanFeedback. */
data class Counters(val newCount: Int = 0, val repeatCount: Int = 0)

/** One row in the "recent" strip (mirrors ScanScreen's RecentScan): the display label + whether the
 *  sticker was owned (REPETIDA) so the chip colour matches. */
data class RecentScan(val id: Long, val owned: Boolean, val label: String)

/** A one-shot result for the UI to react to (flash/multi/beep/haptic). A SharedFlow event rather
 *  than state because the same batch can repeat (re-scanning a sticker) and must re-fire. */
data class ScanEvent(val feedback: ScanFeedback, val key: Long)

class ScanViewModel(
    private val checklist: Checklist,
    private val collection: CollectionRepository,
    private val settings: SettingsRepository,
    private val sessionRepo: SessionRepository,
    /** Lazily-built recognizer (the atlas load is slow + IO, so it runs off the main thread). */
    private val recognizerProvider: suspend () -> FrameRecognizer,
    /** Frame/crop dumper for the DEBUG readout (writes PNGs the dev pulls via adb). */
    private val debugCapture: DebugCapture,
) : ViewModel() {

    // ---------- Live decision state ----------

    private val trigger = CaptureTrigger()

    // The session is the read-only accumulator; the controller dedupes/records into it and the
    // report screen commits the keepers later. Both are built ONCE in init() after the persisted
    // in-progress session is loaded, so the Session is seeded via its constructor (its only
    // bulk-load path) — we never reach into it before then because the burst/manual paths are gated
    // on the recognizer, which init() sets last. @Volatile: written on init's coroutine, read on the
    // analysis thread.
    @Volatile private var session: Session? = null
    @Volatile private var controller: ScanController? = null

    // The recognizer is built once, off-thread; null until ready. Reads are guarded by ocrReady.
    @Volatile private var recognizer: FrameRecognizer? = null

    // The previous small diff frame (the only cross-frame state frameDiff needs). Touched ONLY on
    // the analysis thread (onLumaFrame), so it needs no lock.
    private var prevSmall: GrayImage? = null
    private val staticSceneProbe = StaticSceneProbe()

    // Burst state. `bursting` is read/written on the analysis thread; the actual recognize runs on
    // Dispatchers.Default, serialized by recognizeLock.tryLock so an in-flight recognize never
    // blocks the analyzer (mirrors ScanScreen's recognizeChainRef, but DROPS rather than queues —
    // STRATEGY_KEEP_ONLY_LATEST already drops at the camera, so queueing stale frames is pointless).
    // @Volatile: written on the analysis thread (FIRE/setFacing) and on Dispatchers.Default
    // (burst end), read on the analysis thread. The check-then-act is benign (at worst one extra
    // dropped-by-tryLock dispatch); volatility just guarantees the analysis thread promptly sees the
    // burst-end clear. burstFramesLeft is touched ONLY on the analysis thread (tryRecognize), so it
    // needs no volatility.
    @Volatile private var bursting = false
    private var burstFramesLeft = 0
    private val recognizeLock = Mutex()

    // ---------- Debug state (mirrors ScanScreen.tsx's ?debug readout) ----------

    // Heartbeat tick + the per-frame diff/phase snapshot. `tick` is touched ONLY on the analysis
    // thread (onLumaFrame), so it needs no lock. _debug is a StateFlow the screen renders when the
    // Ajustes debug toggle is on; we always copy() to preserve fields a given update doesn't touch
    // (the heartbeat update keeps the last reads/resolved/committed; a recognize update keeps
    // tick/phase).
    private var tick = 0L

    // forceCapture() (debug tap-to-capture) requests a one-off recognize + dump of the NEXT frame.
    // @Volatile: set on the main thread by forceCapture(), read+cleared on the analysis thread in
    // onLumaFrame. Whether dumping is on is held inside _debug.value.dumpEnabled (no separate field).
    @Volatile private var forceDumpNext = false
    // Whether THIS burst has already dumped (we dump at most once per burst when dumpEnabled, to
    // avoid flooding the disk). Touched only on the analysis thread (FIRE) + the recognize coroutine.
    @Volatile private var dumpedThisBurst = false
    // Monotonic dump label so each dump lands in its own dir.
    private var dumpSeq = 0L

    // Rolling FPS meters for the perf readout: cameraMeter is ticked on the analysis thread (every
    // frame → input fps), ocrMeter on the recognize coroutine (serialized by recognizeLock →
    // recognitions/sec). Each has a single accessor context, so no extra synchronization is needed.
    private val cameraMeter = RateMeter()
    private val ocrMeter = RateMeter()

    /** Tiny rolling-window rate meter: tick() records nowMs and returns events/sec over the last
     *  windowMs, decaying to 0 when idle. Not thread-safe — used from one context per instance. */
    private class RateMeter(private val windowMs: Long = 1500L) {
        private val stamps = ArrayDeque<Long>()
        fun tick(nowMs: Long): Double {
            stamps.addLast(nowMs)
            while (stamps.isNotEmpty() && nowMs - stamps.first() > windowMs) stamps.removeFirst()
            if (stamps.size < 2) return 0.0
            val span = (stamps.last() - stamps.first()).coerceAtLeast(1L)
            return (stamps.size - 1) * 1000.0 / span
        }
    }

    // ---------- UI-facing state ----------

    private val _ocrReady = MutableStateFlow(false)
    val ocrReady: StateFlow<Boolean> = _ocrReady.asStateFlow()

    private val _phase = MutableStateFlow(CapturePhase.WAITING)
    val phase: StateFlow<CapturePhase> = _phase.asStateFlow()

    private val _guidance = MutableStateFlow<ScanGuidance?>(null)
    val guidance: StateFlow<ScanGuidance?> = _guidance.asStateFlow()

    private val _frameAspect = MutableStateFlow(0.75f)
    /** Display-oriented frame aspect (width/height) so the reticle can map the ROI fractions onto the
     *  FIT_CENTER (letterboxed) preview exactly. Emits once then stays constant (StateFlow dedups). */
    val frameAspect: StateFlow<Float> = _frameAspect.asStateFlow()

    private val _debug = MutableStateFlow(DebugInfo())
    val debug: StateFlow<DebugInfo> = _debug.asStateFlow()

    private val _counters = MutableStateFlow(Counters())
    val counters: StateFlow<Counters> = _counters.asStateFlow()

    private val _recent = MutableStateFlow<List<RecentScan>>(emptyList())
    val recent: StateFlow<List<RecentScan>> = _recent.asStateFlow()

    private val _facing = MutableStateFlow(settings.settings.value.camera)
    val facing: StateFlow<CameraFacing> = _facing.asStateFlow()

    // Replay 0 + a small buffer: events are transient (flash/beep), but buffering a couple guards a
    // burst that commits two co-present stickers a frame apart against a slow collector.
    private val _events = MutableSharedFlow<ScanEvent>(replay = 0, extraBufferCapacity = 8)
    val events: SharedFlow<ScanEvent> = _events.asSharedFlow()

    private var eventKey = 0L

    init {
        // Seed the session from the persisted in-progress one (via its constructor — the only
        // bulk-load path), build the controller around it, then build the recognizer (atlas load is
        // IO-bound). All off the main thread; the recognizer is published LAST and gates the burst,
        // so the analysis thread never sees a half-built controller. ocrReady flips true at the end.
        viewModelScope.launch {
            val saved = withContext(Dispatchers.IO) { sessionRepo.load() }
            val s = Session(initial = saved)
            session = s
            controller = ScanController(
                checklist = checklist,
                owned = collection.asOwnedCodes(),
                session = s,
            )
            recognizer = withContext(Dispatchers.Default) { recognizerProvider() }
            _ocrReady.value = true
        }
    }

    // ---------- Camera frame entry point (called on the analysis executor) ----------

    /**
     * One camera luma frame. Runs the cheap, synchronous frame-diff + trigger here on the analysis
     * thread, then — when a burst is active — kicks the (async, off-thread) recognize. The heavy
     * recognizeFrameInOrder NEVER runs on this thread, and frames arriving while a recognize is in
     * flight are DROPPED (tryLock), so the analyzer stays free and the preview never stalls.
     */
    fun onLumaFrame(full: GrayImage) {
        val now = SystemClock.uptimeMillis()
        // Publish the (display-oriented) frame aspect so the reticle can draw the ROI box exactly over
        // the letterboxed preview. StateFlow dedups, so this emits once then stays constant.
        if (full.height > 0) {
            val a = full.width.toFloat() / full.height
            if (_frameAspect.value != a) _frameAspect.value = a
        }
        val small = full.downscaleTo(DIFF_MAX_W)
        val diff = prevSmall?.let { frameDiff(it, small) } ?: 0.0
        prevSmall = small

        val phase = trigger.onFrame(diff, now)
        _phase.value = phase

        // Heartbeat: bump the tick and publish the per-frame snapshot EVERY frame, even before the
        // recognizer is ready (mirrors ScanScreen's onTick spinner, which advances regardless of OCR
        // state). copy() preserves the last recognize's reads/resolved/committed/crops/lastMs and the
        // dump fields — only the live-loop fields change here.
        tick += 1
        _debug.value = _debug.value.copy(
            tick = tick,
            phase = phase,
            diffPct = (diff * 100).toInt(),
            heldMs = trigger.heldMs(now),
            cameraFps = cameraMeter.tick(now),
        )

        // Debug tap-to-capture: a one-off forced recognize + dump of THIS frame, regardless of the
        // capture phase (mirrors ScanScreen.captureNow). Runs only when not already bursting, so it
        // never races the burst path; tryRecognize tryLocks and drops if a recognize is in flight, so
        // it can't deadlock the recognizeLock. We dump unconditionally for a forced capture.
        if (forceDumpNext && !bursting) {
            forceDumpNext = false
            tryRecognize(full, now, forceDump = true)
            return
        }

        // Not ready until the controller + recognizer are built (init coroutine). The diff/trigger
        // above still run so the phase heartbeat ticks, but we don't recognize yet (matches
        // ScanScreen's loop, which no-ops until OCR loads).
        val ctrl = controller ?: return

        if (maybeStartStaticSceneBurst(full, now, diff, phase, ctrl)) return

        when {
            phase == CapturePhase.FIRE && !bursting -> {
                val quality = assessFrameQuality(full)
                _guidance.value = quality.guidance
                if (!quality.canCapture) {
                    trigger.rearmAfterEmptyBurst(now)
                    return
                }
                // A fresh sticker settled: arm a new burst and read THIS frame as its first.
                // CRITICAL: only on the FIRST FIRE (!bursting). The trigger keeps returning FIRE every
                // still frame until the burst ends (it doesn't self-lock — fired()/rearm does, at burst
                // END). Without the !bursting guard, each held frame would re-enter here and call
                // onBurstStart() AGAIN, resetting the confirmer every frame so it could never reach
                // CONFIRMATIONS (2) and NOTHING would ever commit on the live path.
                ctrl.onBurstStart()
                bursting = true
                burstFramesLeft = Config.Capture.BURST_FRAMES
                dumpedThisBurst = false // a fresh burst may dump one frame when dumpEnabled
                tryRecognize(full, now)
            }
            bursting -> {
                // Subsequent held frames feed the SAME burst (each a confirmer round), including the
                // repeated FIRE frames above. The burst ends when the controller says stop or we
                // exhaust BURST_FRAMES (runBurstFrame then locks on a real read, else re-arms).
                tryRecognize(full, now)
            }
            // WAITING/MOVING/HOLDING/LOCKED outside a burst: nothing to recognize.
        }
    }

    private fun maybeStartStaticSceneBurst(
        full: GrayImage,
        nowMs: Long,
        diff: Double,
        phase: CapturePhase,
        ctrl: ScanController,
    ): Boolean {
        if (recognizer == null) return false
        var quality: FrameQuality? = null
        val shouldStart = staticSceneProbe.maybeStartBurst(
            diff = diff,
            nowMs = nowMs,
            hasCodeBox = {
                if (phase == CapturePhase.WAITING && !bursting) {
                    assessFrameQuality(full).also { quality = it }.canCapture
                } else {
                    false
                }
            },
        )
        quality?.let { _guidance.value = it.guidance }
        if (!shouldStart) return false

        ctrl.onBurstStart()
        bursting = true
        burstFramesLeft = Config.Capture.BURST_FRAMES
        dumpedThisBurst = false
        tryRecognize(full, nowMs)
        return true
    }

    /**
     * Dispatch one burst frame to the background recognizer IF no recognize is already running
     * (tryLock — a busy lock means this frame is dropped, keeping the analyzer non-blocking). The
     * recognize + commit decision run off-thread; the burst bookkeeping is finalized back here.
     *
     * [forceDump] is the debug tap-to-capture path: a STANDALONE recognize (not a burst frame), so it
     * never touches burstFramesLeft/bursting and always dumps. It still goes through the SAME tryLock,
     * so it drops (rather than deadlocks) if a recognize is already in flight.
     */
    private fun tryRecognize(frame: GrayImage, nowMs: Long, forceDump: Boolean = false) {
        val engine = recognizer ?: return // OCR not ready yet → no-op, like ScanScreen's loop
        val ctrl = controller ?: return
        if (!recognizeLock.tryLock()) return // a recognize is in flight → drop this frame
        // A forced one-off is not part of a burst, so it leaves the burst budget alone.
        val lastFrame = if (forceDump) false else (--burstFramesLeft <= 0)
        viewModelScope.launch(Dispatchers.Default) {
            try {
                runBurstFrame(engine, ctrl, frame, nowMs, lastFrame, forceDump)
            } finally {
                recognizeLock.unlock()
            }
        }
    }

    /** Recognize one burst frame, run the commit decision, and emit feedback. Mirrors the body of
     *  recognizeCanvas's confirm path + handleMatches. Runs on Dispatchers.Default. [forceDump] is the
     *  debug tap path: a standalone recognize that always dumps and skips the burst-end bookkeeping. */
    private suspend fun runBurstFrame(
        engine: FrameRecognizer,
        ctrl: ScanController,
        frame: GrayImage,
        nowMs: Long,
        lastFrame: Boolean,
        forceDump: Boolean = false,
    ) {
        // Measure the wall-clock cost of the recognize for the debug readout (mirrors the PWA's
        // implicit "how long did this frame take"). nanoTime is monotonic and unaffected by clock
        // changes — the right clock for a duration.
        val t0 = System.nanoTime()
        val outcome = recognizeFrameInOrder(engine, frame, checklist, stopOnFirstCode = true)
        val lastMs = (System.nanoTime() - t0) / 1_000_000
        val commit = ctrl.commitFromFrame(outcome.resolved, nowMs)

        if (commit.toCommit.isNotEmpty()) {
            _guidance.value = null
            val feedback = ctrl.handleMatches(commit.toCommit)
            applyFeedback(feedback)
            // Persist the (now-mutated) session so a process death mid-scan doesn't lose progress.
            persistSession()
        }

        // Publish the recognize snapshot for the debug readout (mirrors ScanScreen's
        // "Ncr raw → resolved ✓[committed]" line). copy() keeps the live heartbeat fields
        // (tick/phase/diffPct/heldMs) the analysis thread owns.
        _debug.value = _debug.value.copy(
            reads = outcome.reads,
            resolved = outcome.resolved.mapNotNull { it.entry?.code },
            committed = commit.toCommit.mapNotNull { it.entry?.code },
            crops = outcome.crops,
            cropBoxes = if (settings.settings.value.debug) debugCropBoxes(frame) else emptyList(),
            lastMs = lastMs,
            ocrFps = ocrMeter.tick(SystemClock.uptimeMillis()),
        )

        // Frame/crop dump: ALWAYS on a forced tap; otherwise at most ONCE per burst when dumping is
        // on (the committing frame if there is one, else the first burst frame). Re-derive the
        // prepared crops the recognizer would have OCR'd and write them off-thread.
        val shouldDump = forceDump || (_debug.value.dumpEnabled && !dumpedThisBurst)
        if (shouldDump) {
            if (!forceDump) dumpedThisBurst = true
            dumpFrame(frame)
        }

        // End the burst when the controller signals stop OR we've used the frame budget. Cleared on
        // the analysis thread's next FIRE anyway, but clearing here stops further dispatches sooner.
        // The forced one-off is NOT a burst frame, so it leaves the burst/trigger state untouched.
        if (!forceDump && (commit.stopBurst || lastFrame)) {
            bursting = false
            if (ctrl.burstCommitted) {
                // A real read landed → LOCK until the sticker leaves so we don't re-read it. Only
                // here does the debug heartbeat correctly show "lido ✓ — troque a figurinha".
                trigger.fired(nowMs)
            } else {
                // The burst resolved NOTHING. Don't lock (that would falsely report a read and strand
                // the user on a sticker that just needs a sharper frame) — re-arm so a sticker held
                // over the box keeps being retried at the recapture cadence.
                if (_guidance.value == null) _guidance.value = ScanGuidance.HOLD_STILL
                trigger.rearmAfterEmptyBurst(nowMs)
            }
        }
    }

    /** Re-derive the prepared crops for [frame] (the same boxes/crops the recognizer OCRs) and write
     *  the frame + crops to disk via DebugCapture, off the recognize thread (Dispatchers.IO). Updates
     *  _debug.lastDumpDir so the UI can show the "adb pull" path. Best-effort — never fails the read. */
    private fun dumpFrame(frame: GrayImage) {
        val label = "frame-${++dumpSeq}"
        viewModelScope.launch(Dispatchers.IO) {
            val crops = findCodeBoxes(frame, Roi.CONFIG)
                .let(::debugCodeBoxes)
                .flatMap { codeCropCandidates(frame, it) }
            val dir = debugCapture.dump(label, frame, crops)
            _debug.value = _debug.value.copy(lastDumpDir = dir)
        }
    }

    private fun debugCropBoxes(frame: GrayImage): List<DebugCropBox> {
        if (frame.width <= 0 || frame.height <= 0) return emptyList()
        return findCodeBoxes(frame, Roi.CONFIG)
            .let(::debugCodeBoxes)
            .map { box ->
                val padX = box.w * DEBUG_CROP_PAD_FRAC
                val padY = box.h * DEBUG_CROP_PAD_FRAC
                DebugCropBox(
                    left = ((box.x - padX) / frame.width).toFloat().coerceIn(0f, 1f),
                    top = ((box.y - padY) / frame.height).toFloat().coerceIn(0f, 1f),
                    right = ((box.x + box.w + padX) / frame.width).toFloat().coerceIn(0f, 1f),
                    bottom = ((box.y + box.h + padY) / frame.height).toFloat().coerceIn(0f, 1f),
                    score = box.score,
                    source = box.source,
                )
            }
    }

    private fun debugCodeBoxes(boxes: List<CodeBox>): List<CodeBox> {
        val component = boxes.filter { it.source != CodeBoxSource.HORIZONTAL_SCAN }.take(DEBUG_COMPONENT_BOXES)
        val horizontal = boxes.filter { it.source == CodeBoxSource.HORIZONTAL_SCAN }.take(DEBUG_HORIZONTAL_SCAN_BOXES)
        return (component + horizontal).take(DEBUG_CROP_BOXES)
    }

    /** Fold one batch's feedback into the running counters + recent strip and emit the one-shot
     *  event the UI turns into flash/multi/beep/haptic. Misses (nothing resolved) still emit so the
     *  UI can show "tente de novo", but don't touch counters/recent. */
    @Synchronized
    private fun applyFeedback(feedback: ScanFeedback) {
        val key = ++eventKey
        if (!feedback.isMiss) {
            _counters.value = Counters(
                newCount = _counters.value.newCount + feedback.newNeeded,
                repeatCount = _counters.value.repeatCount + feedback.newOwned,
            )
            val rows = feedback.items.mapIndexed { i, it ->
                RecentScan(id = key * 100 + i, owned = it.owned, label = it.display)
            }
            _recent.value = (rows + _recent.value).take(RECENT_MAX)
        }
        _events.tryEmit(ScanEvent(feedback, key))
    }

    private fun persistSession() {
        val snapshot = session?.toJSON() ?: return
        viewModelScope.launch(Dispatchers.IO) { sessionRepo.save(snapshot) }
    }

    // ---------- UI actions ----------

    /** Flip the active camera and persist the choice (mirrors ScanScreen.flipCamera). The screen
     *  observes [facing] and re-binds CameraFrameSource. */
    fun setFacing(facing: CameraFacing) {
        _facing.value = facing
        settings.setCamera(facing)
        // A facing flip restarts the stream; clear the diff baseline so the first frame of the new
        // camera doesn't read as a huge (false) motion against the old camera's last frame.
        prevSmall = null
        staticSceneProbe.reset()
        bursting = false
        _guidance.value = null
        trigger.reset()
    }

    fun toggleFacing() {
        setFacing(if (_facing.value == CameraFacing.FRONT) CameraFacing.BACK else CameraFacing.FRONT)
    }

    // ---------- Debug actions (mirror ScanScreen.tsx's ?debug affordances) ----------

    /** Flip frame/crop dumping on or off (DebugInfo.dumpEnabled). When on, the loop dumps at most one
     *  frame per burst; a one-off tap (forceCapture) always dumps. */
    fun toggleDumpFrames() {
        _debug.value = _debug.value.copy(dumpEnabled = !_debug.value.dumpEnabled)
    }

    /** Tap-to-capture (mirrors ScanScreen.captureNow): force a one-off recognize + dump of the NEXT
     *  camera frame, regardless of the capture phase or whether dumping is enabled. The flag is
     *  consumed on the analysis thread in onLumaFrame, which routes it through tryRecognize (tryLock,
     *  so it drops rather than deadlocks if a recognize is already in flight). */
    fun forceCapture() {
        forceDumpNext = true
    }

    /** Manual code entry (the keyboard fallback). Matches the typed text and routes it through the
     *  same handleMatches path so it counts/records/flashes identically. Mirrors submitManual. */
    fun manualEntry(text: String) {
        val ctrl = controller ?: return // ignored until the session/controller are built
        val value = text.trim()
        if (value.isEmpty()) return
        val match = matchCode(value, checklist)
        val feedback = ctrl.handleMatches(listOf(match))
        applyFeedback(feedback)
        if (!feedback.isMiss) persistSession()
    }

    /** Build the end-of-session report (deduped keepers/repeats/unknowns) — the report screen reads
     *  this. Read-only over the session. Empty when the session hasn't loaded yet. */
    fun finishSession(): SessionReport =
        session?.report(checklist) ?: SessionReport(0, emptyList(), emptyList(), emptyList())

    /** Discard the in-progress session (after the report screen committed the user's picks). Clears
     *  the in-memory accumulator, persisted copy, and the UI tallies. */
    fun resetSession() {
        session?.clear()
        _counters.value = Counters()
        _recent.value = emptyList()
        viewModelScope.launch(Dispatchers.IO) { sessionRepo.clear() }
    }

    companion object {
        /** Long side (px) of the frame-diff image. Coarse motion detection only — small is fast and
         *  enough (mirrors the PWA's ~160px diff frame). */
        private const val DIFF_MAX_W = 160

        /** How many recent chips to keep (mirrors ScanScreen's slice(0, 12)). */
        private const val RECENT_MAX = 12

        /** Mirrors Locate.cropRegion's padFrac so the overlay shows the actual OCR crop extent. */
        private const val DEBUG_CROP_PAD_FRAC = 0.18

        /** Include late horizontal-scan candidates, not just the first live OCR boxes. */
        private const val DEBUG_CROP_BOXES = 8
        private const val DEBUG_COMPONENT_BOXES = 4
        private const val DEBUG_HORIZONTAL_SCAN_BOXES = 4

        /** Atlas asset shipped under app/src/main/assets/. */
        private const val ATLAS_ASSET = "glyph_atlas.bin"

        /** ViewModelProvider.Factory that wires the DataStore repositories + the off-thread atlas
         *  load. Use from a Composable: viewModel(factory = ScanViewModel.factory(context)). */
        fun factory(context: Context): ViewModelProvider.Factory {
            val appContext = context.applicationContext
            return object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    // The repositories' StateFlows need a scope; the VM's viewModelScope isn't
                    // available until after construction, so build them eagerly here on a child of
                    // the app process. (They outlive the VM only by the time it takes a flip; the
                    // DataStores themselves are process singletons.)
                    val scope = kotlinx.coroutines.CoroutineScope(
                        kotlinx.coroutines.SupervisorJob() + Dispatchers.Default,
                    )
                    val collection = CollectionRepository(appContext.collectionDataStore, scope)
                    val settings = SettingsRepository(appContext.settingsDataStore, scope)
                    val sessionRepo = SessionRepository(appContext.sessionDataStore)
                    val provider: suspend () -> FrameRecognizer = {
                        val atlas = appContext.assets.open(ATLAS_ASSET).use { loadAtlas(it) }
                        GlyphOnlyRecognizer(GlyphRecognizer(atlas))
                    }
                    return ScanViewModel(
                        checklist = defaultChecklist,
                        collection = collection,
                        settings = settings,
                        sessionRepo = sessionRepo,
                        recognizerProvider = provider,
                        debugCapture = DebugCapture(appContext),
                    ) as T
                }
            }
        }
    }
}
