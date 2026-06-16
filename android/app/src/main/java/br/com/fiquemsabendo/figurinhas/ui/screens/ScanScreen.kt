package br.com.fiquemsabendo.figurinhas.ui.screens

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings as AndroidSettings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.RequestPermission
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.camera.CameraFrameSource
import br.com.fiquemsabendo.figurinhas.data.CameraFacing
import br.com.fiquemsabendo.figurinhas.data.SettingsRepository
import br.com.fiquemsabendo.figurinhas.domain.ScanOutcome
import br.com.fiquemsabendo.figurinhas.i18n.Pt
import br.com.fiquemsabendo.figurinhas.ocr.CapturePhase
import br.com.fiquemsabendo.figurinhas.scan.DebugInfo
import br.com.fiquemsabendo.figurinhas.scan.ScanFeedback
import br.com.fiquemsabendo.figurinhas.scan.ScanItem
import br.com.fiquemsabendo.figurinhas.scan.ScanViewModel
import br.com.fiquemsabendo.figurinhas.ui.components.FlashOverlay
import br.com.fiquemsabendo.figurinhas.ui.components.FlashState
import br.com.fiquemsabendo.figurinhas.ui.components.MultiResultPanel
import br.com.fiquemsabendo.figurinhas.ui.theme.AppTheme
import kotlin.math.roundToInt

// The camera Scan screen — the Compose port of src/ui/screens/ScanScreen.tsx's VIEW layer. All the
// recognition wiring (camera frame → frame-diff → trigger → burst → confirm → commit) already lives
// in ScanViewModel + CameraFrameSource; this Composable is what the PWA kept in its render/effects:
// the camera permission gate, the PreviewView host + bind/unbind lifecycle, the fill-light + reticle,
// the GUARDAR/REPETIDA flash + multi-result panel timing, the beep + haptic side effects, the
// counters + recent strip, manual entry, and the camera flip. It is otherwise side-effect-free: it
// reads the ViewModel's StateFlows/SharedFlow and renders.

/** Mirrors ScanScreen.tsx's FLASH_MS — how long a single-sticker flash (or a miss) stays up. */
private const val FLASH_MS = 1100L

/** A transient result the UI is currently showing: either a single big flash or the multi panel. */
private sealed interface ScanDisplay {
    data class Single(val state: FlashState) : ScanDisplay
    data class Multi(val items: List<ScanItem>) : ScanDisplay
}

@Composable
fun ScanScreen(
    viewModel: ScanViewModel,
    settings: SettingsRepository,
    onFinish: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // ---------- Camera permission ----------
    // Track grant state in Compose state so the UI flips from the "grant" panel to the camera the
    // moment the permission dialog resolves (mirrors ScanScreen.tsx's 'denied' camera state).
    var granted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    // Whether we've already asked once this session: a second "denied" means the OS won't show the
    // dialog again (the user picked "don't ask"), so the retry button deep-links to app settings.
    var askedOnce by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(RequestPermission()) { ok ->
        granted = ok
        askedOnce = true
    }

    // ---------- ViewModel state ----------
    val ocrReady by viewModel.ocrReady.collectAsStateWithLifecycle()
    val facing by viewModel.facing.collectAsStateWithLifecycle()
    val counters by viewModel.counters.collectAsStateWithLifecycle()
    val recent by viewModel.recent.collectAsStateWithLifecycle()
    // Debug mode is an OPT-IN Ajustes toggle (persisted), mirroring the PWA's ?debug — so it works on
    // ANY build, not just debug builds. The overlay + tap-to-capture + dump below all gate on it.
    val settingsState by settings.settings.collectAsStateWithLifecycle()
    val debugEnabled = settingsState.debug
    val debug by viewModel.debug.collectAsStateWithLifecycle()
    val frameAspect by viewModel.frameAspect.collectAsStateWithLifecycle()

    // ---------- Camera source (one instance for the screen's lifetime) ----------
    val frameSource = remember { CameraFrameSource(context) }
    // A single PreviewView reused across re-binds (flipping the camera only restarts the stream).
    val previewView = remember {
        PreviewView(context).apply {
            scaleType = PreviewView.ScaleType.FIT_CENTER // object-fit:contain — keeps the fill-light frame visible
        }
    }

    // Bind/unbind on granted+facing. A facing flip re-runs this effect, which unbinds the old stream
    // and binds the new one (CameraFrameSource.bind unbinds internally too — belt and suspenders).
    DisposableEffect(granted, facing) {
        if (granted) {
            frameSource.bind(
                lifecycleOwner = lifecycleOwner,
                surfaceProvider = previewView.surfaceProvider,
                facing = facing,
                onLuma = viewModel::onLumaFrame,
            )
        }
        onDispose { frameSource.unbind() }
    }
    // Release the analysis executor when the screen leaves composition for good.
    DisposableEffect(Unit) {
        onDispose { frameSource.shutdown() }
    }

    // ---------- Transient result display + side effects ----------
    var display by remember { mutableStateOf<ScanDisplay?>(null) }
    // Bumped per event so a keyed clear-timer restarts even when the same outcome repeats.
    var displayKey by remember { mutableStateOf(0L) }
    var displayMs by remember { mutableStateOf(FLASH_MS) }

    LaunchedEffect(Unit) {
        viewModel.events.collect { ev ->
            val fb = ev.feedback
            display = toDisplay(fb, ev.key)
            displayKey = ev.key
            displayMs = displayDurationMs(fb)
            // Beep is gated on the sound setting; haptic is the silent feedback and is independent.
            if (!fb.isMiss && settings.settings.value.sound) beep(context, fb.anyNeeded)
            if (!fb.isMiss) haptic(context, fb.anyNeeded)
        }
    }

    // Clear the transient display after its duration. Keyed on displayKey so each new result restarts
    // the timer (mirrors ScanScreen.tsx's clearTimeout/setTimeout on every showFlash/showMulti).
    LaunchedEffect(displayKey) {
        if (displayKey == 0L) return@LaunchedEffect
        kotlinx.coroutines.delay(displayMs)
        display = null
    }

    // ---------- Render ----------
    Box(modifier = modifier.fillMaxSize()) {
        if (!granted) {
            CameraDeniedPanel(
                onRequest = {
                    if (askedOnce) {
                        // The OS won't re-prompt after a hard denial → send the user to app settings.
                        openAppSettings(context)
                    } else {
                        permissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                },
            )
        } else {
            CameraScanContent(
                previewView = previewView,
                frameAspect = frameAspect,
                ocrReady = ocrReady,
                facing = facing,
                idleHintVisible = display == null,
                onFlip = viewModel::toggleFacing,
                // TAP-TO-CAPTURE (debug mode only): tapping the preview forces a one-off recognize +
                // dump of the next frame. Null while the Ajustes toggle is off, so the preview area
                // carries no click handler during ordinary scanning.
                onDebugTap = if (debugEnabled) viewModel::forceCapture else null,
            )
        }

        // The flash / multi panel renders over everything (camera, fill-light) regardless of grant.
        when (val d = display) {
            is ScanDisplay.Single -> FlashOverlay(state = d.state, modifier = Modifier.fillMaxSize())
            is ScanDisplay.Multi -> Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                contentAlignment = Alignment.Center,
            ) {
                MultiResultPanel(items = d.items)
            }
            null -> {}
        }

        // Top bar (counters + Terminar) + bottom controls (recent strip, manual entry) overlay the
        // camera. Drawn last so they sit above the preview but BELOW the flash, which is the loud
        // confirmation the user should not miss.
        if (granted) {
            ScanTopBar(
                newCount = counters.newCount,
                repeatCount = counters.repeatCount,
                finishEnabled = counters.newCount > 0 || counters.repeatCount > 0,
                onFinish = onFinish,
                modifier = Modifier.align(Alignment.TopCenter),
            )
            ScanBottomControls(
                recent = recent,
                onManual = { viewModel.manualEntry(it) },
                modifier = Modifier.align(Alignment.BottomCenter),
            )
        }

        // DEBUG overlay — shown only when the Ajustes "Modo debug" toggle is on (settingsState.debug).
        // A small, semi-transparent monospace readout pinned under the top bar (so it never covers the
        // centered flash). Mirrors ScanScreen.tsx's ?debug box: braille heartbeat + phase, the
        // "Ncr raw → resolved ✓[committed]" line, the perf fps line, and the dump dir for `adb pull`.
        if (debugEnabled) {
            ScanDebugOverlay(
                debug = debug,
                onToggleDump = viewModel::toggleDumpFrames,
                modifier = Modifier.align(Alignment.TopCenter),
            )
        }
    }
}

// ---------- Debug overlay (Ajustes toggle only) ----------

/** The pt-BR phase label for the heartbeat line — EXACTLY mirrors ScanScreen.tsx's onTick mapping. */
private fun debugPhaseLabel(phase: CapturePhase, diffPct: Int, heldMs: Long): String =
    when (phase) {
        CapturePhase.WAITING -> "aguardando figurinha"
        CapturePhase.MOVING -> "movendo ${diffPct}%"
        CapturePhase.HOLDING -> "parado ${heldMs}ms"
        CapturePhase.FIRE -> "lendo…"
        CapturePhase.LOCKED -> "lido ✓ — troque a figurinha"
    }

private const val DEBUG_SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"

/**
 * The live debug readout. Three lines (heartbeat+phase, reads→resolved, dump dir) plus the dump
 * toggle, on a near-opaque black card so it stays legible over the white fill-light. Pinned to the
 * top and offset below the system bars + the counters/Terminar row so it doesn't sit on the flash.
 */
@Composable
private fun ScanDebugOverlay(
    debug: DebugInfo,
    onToggleDump: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val spinner = DEBUG_SPINNER[(debug.tick % 10).toInt()]
    val phaseLabel = debugPhaseLabel(debug.phase, debug.diffPct, debug.heldMs)

    // line 2: "${crops}cr \"reads…\" → resolved[ ✓[committed]] ${lastMs}ms"
    val readsJoined = debug.reads.joinToString(" | ").take(60)
    val resolvedJoined = debug.resolved.joinToString(",").ifEmpty { "—" }
    val committedSuffix =
        if (debug.committed.isNotEmpty()) " ✓[${debug.committed.joinToString(",")}]" else ""
    val readsLine = "${debug.crops}cr \"$readsJoined\" → $resolvedJoined$committedSuffix"
    // line 2b: perf — camera input fps vs OCR throughput (frames actually OCR'd/sec) + last recognize ms.
    val perfLine =
        "câmera ${debug.cameraFps.roundToInt()}fps · ocr ${"%.1f".format(debug.ocrFps)}fps · ${debug.lastMs}ms"

    Column(
        modifier = modifier
            .systemBarsPadding()
            // Drop below the counters/Terminar top bar (≈ 56dp) so the two never overlap.
            .padding(top = 56.dp, start = 8.dp, end = 8.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xCC000000))
            .padding(horizontal = 8.dp, vertical = 6.dp),
    ) {
        // line 1: heartbeat spinner + pt-BR phase label.
        Text(
            text = "$spinner $phaseLabel",
            color = Color.White,
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
        )
        // line 2: crops / raw reads → resolved (✓ committed) / last recognize ms — green like a console.
        Text(
            text = readsLine,
            color = Color(0xFF6CFF8A),
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
        )
        // line 2b: perf — camera input fps · OCR throughput (how many frames actually get OCR'd) · ms.
        Text(
            text = perfLine,
            color = Color(0xFFFFC773),
            fontFamily = FontFamily.Monospace,
            fontSize = 12.sp,
        )
        // line 3 (only when a dump exists): the absolute dir to `adb pull`. Ellipsized to one line.
        debug.lastDumpDir?.let { dir ->
            Text(
                text = "quadros: $dir",
                color = Color.White,
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.height(4.dp))
        // DUMP TOGGLE: flips DebugInfo.dumpEnabled on the ViewModel.
        TextButton(
            onClick = onToggleDump,
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .background(Color(0x33FFFFFF)),
        ) {
            Text(
                text = "Salvar quadros: " + if (debug.dumpEnabled) "ligado" else "desligado",
                color = if (debug.dumpEnabled) Color(0xFF6CFF8A) else Color.White,
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
            )
        }
    }
}

// ---------- Display mapping ----------

/** Map one feedback batch to what the UI shows: an unknown flash on a miss, the big single flash for
 *  one sticker, or the multi panel for several (mirrors handleMatches's items.length branch). */
private fun toDisplay(fb: ScanFeedback, key: Long): ScanDisplay {
    if (fb.isMiss) {
        return ScanDisplay.Single(
            FlashState(outcome = ScanOutcome.UNKNOWN, display = "", teamName = "", key = key),
        )
    }
    if (fb.items.size == 1) {
        val it = fb.items[0]
        val outcome = if (it.owned) ScanOutcome.OWNED else ScanOutcome.NEEDED
        return ScanDisplay.Single(
            FlashState(
                outcome = outcome,
                display = it.display,
                // Team name is only shown for keepers (matches Flash.tsx + handleMatches).
                teamName = if (it.owned) "" else it.teamName,
                key = key,
            ),
        )
    }
    return ScanDisplay.Multi(fb.items)
}

/** How long to keep a result up: FLASH_MS for a single/miss, longer for the multi panel so every row
 *  can be read (mirrors showMulti's min(5000, 1600 + n*500)). */
private fun displayDurationMs(fb: ScanFeedback): Long {
    if (fb.isMiss || fb.items.size == 1) return FLASH_MS
    return minOf(5000L, 1600L + fb.items.size * 500L)
}

// ---------- Beep + haptic (best-effort side effects) ----------

/** A short scanner beep: a bright high tone when something's needed (KEEP), a lower one when it's all
 *  owned (REPEAT). Best-effort — a device without a usable ToneGenerator just stays silent. Mirrors
 *  ScanScreen.tsx's beep(); only called when the sound setting is on. */
private fun beep(@Suppress("UNUSED_PARAMETER") context: Context, anyNeeded: Boolean) {
    try {
        val tone = if (anyNeeded) {
            ToneGenerator.TONE_PROP_BEEP // bright, "you need it" up-cue
        } else {
            ToneGenerator.TONE_PROP_NACK // lower, "already have it" down-cue
        }
        // A fresh generator per beep, released right after: cheap, and avoids holding an audio
        // resource open across the (rare) scan events. Volume is moderate so it's audible on a table.
        val gen = ToneGenerator(AudioManager.STREAM_MUSIC, 70)
        gen.startTone(tone, 150)
        // Release after the tone has played; releasing immediately would cut it off.
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            try {
                gen.release()
            } catch (_: Throwable) {
            }
        }, 200)
    } catch (_: Throwable) {
        // ToneGenerator can throw if the audio system is busy — sound is best-effort.
    }
}

/** A short buzz so the result lands even when the phone is flat on the table and the user is looking
 *  at the sticker, not the screen. KEEP gets a double pulse, REPEAT a single tap. Best-effort and
 *  independent of the sound setting (the silent feedback). Mirrors ScanScreen.tsx's haptic(). */
private fun haptic(context: Context, anyNeeded: Boolean) {
    try {
        val vibrator = vibratorOf(context) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = if (anyNeeded) {
                // double pulse: off 0, on 28, off 45, on 28 (timings mirror the PWA's [28,45,28]).
                VibrationEffect.createWaveform(longArrayOf(0, 28, 45, 28), -1)
            } else {
                VibrationEffect.createOneShot(22, VibrationEffect.DEFAULT_AMPLITUDE)
            }
            vibrator.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            if (anyNeeded) vibrator.vibrate(longArrayOf(0, 28, 45, 28), -1)
            else vibrator.vibrate(22)
        }
    } catch (_: Throwable) {
        // Vibration unsupported / no permission edge — best-effort, like the PWA's navigator.vibrate.
    }
}

private fun vibratorOf(context: Context): Vibrator? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val mgr = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        mgr?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
}

private fun openAppSettings(context: Context) {
    try {
        val intent = Intent(AndroidSettings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    } catch (_: Throwable) {
        // Settings deep-link is best-effort.
    }
}

// ---------- Camera content + fill-light + reticle ----------

@Composable
private fun CameraScanContent(
    previewView: PreviewView,
    frameAspect: Float,
    ocrReady: Boolean,
    facing: CameraFacing,
    idleHintVisible: Boolean,
    onFlip: () -> Unit,
    // Debug-mode tap-to-capture; null while the Ajustes toggle is off so no click handler is attached
    // during ordinary scanning (mirrors the PWA's opt-in debug capture path).
    onDebugTap: (() -> Unit)? = null,
) {
    // FILL-LIGHT: a pure-white background fills the screen and acts as a ring light for the sticker
    // (the documented capture-sharpness trick — ScanScreen.tsx's .scan-frame white box-shadow +
    // object-fit:contain). The PreviewView is FIT_CENTER so the contained feed leaves a white border.
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            // In debug mode, the whole preview area is tap-to-capture. `let` keeps the modifier
            // chain unchanged (no clickable) when onDebugTap is null.
            .let { base -> onDebugTap?.let { tap -> base.clickable(onClick = tap) } ?: base },
    ) {
        AndroidView(
            factory = { previewView },
            modifier = Modifier.fillMaxSize(),
        )

        // The reticle = the OCR target box: it's drawn at EXACTLY the detection ROI (mapped onto the
        // FIT_CENTER preview), so whatever the user places inside the box is precisely what's scanned.
        ScanReticle(frameAspect = frameAspect, modifier = Modifier.fillMaxSize())

        // Idle hint: tell the user to show the back of the sticker (only when nothing is flashing).
        if (ocrReady && idleHintVisible) {
            Text(
                text = Pt.Scan.startHint,
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(horizontal = 24.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0x99000000))
                    .padding(horizontal = 16.dp, vertical = 10.dp),
            )
        }

        // OCR-ready gate: while the native atlas loads, a small spinner + "Preparando o leitor…".
        // The camera still previews underneath; recognition no-ops until ready (the VM gates it).
        if (!ocrReady) {
            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xCC000000))
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator(color = Color.White)
                Spacer(Modifier.height(12.dp))
                // No real percent for the native atlas load — pass 0 (the string still reads fine).
                Text(text = Pt.Scan.preparing(0), color = Color.White, fontSize = 15.sp)
            }
        }

        // Camera flip button (🔄), bottom-right above the controls. The PWA's aria-label/title becomes
        // a semantics contentDescription naming the camera we'd switch FROM (front/back), for TalkBack.
        val flipLabel = if (facing == CameraFacing.FRONT) Pt.Scan.cameraFront else Pt.Scan.cameraBack
        TextButton(
            onClick = onFlip,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 8.dp, bottom = 96.dp)
                .semantics { contentDescription = flipLabel },
        ) {
            Text(
                text = "🔄",
                fontSize = 26.sp,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(Color(0x66000000))
                    .padding(10.dp),
            )
        }
    }
}

/** The reticle = the OCR target box. We map the Config detection ROI (fractions of the
 *  DISPLAY-oriented frame) onto the FIT_CENTER preview rectangle, so the rounded window the user sees
 *  is EXACTLY the region the recognizer scans — line the code up inside it and that's what reads.
 *
 *  Everything OUTSIDE the box is filled solid WHITE: the camera only shows through the box, and the
 *  bright surround acts as a ring-light on the sticker held up to the screen (the documented
 *  capture-sharpness trick — the front camera's real blocker is soft frames, not OCR speed). A thin
 *  border crisps the window edge. */
@Composable
private fun ScanReticle(frameAspect: Float, modifier: Modifier = Modifier) {
    Canvas(modifier = modifier) {
        val cw = size.width
        val ch = size.height
        val aspect = frameAspect.coerceAtLeast(0.01f)
        // FIT_CENTER: scale the frame to fit (cw,ch) preserving aspect, centered → the displayed rect.
        val dispW: Float
        val dispH: Float
        if (cw / aspect <= ch) {
            dispW = cw; dispH = cw / aspect
        } else {
            dispH = ch; dispW = ch * aspect
        }
        val offX = (cw - dispW) / 2f
        val offY = (ch - dispH) / 2f
        // The ROI box within the displayed frame (same fractions findCodeBoxes uses).
        val bx = offX + Config.Detect.ROI_LEFT.toFloat() * dispW
        val by = offY + Config.Detect.ROI_TOP.toFloat() * dispH
        val bw = (Config.Detect.ROI_RIGHT - Config.Detect.ROI_LEFT).toFloat() * dispW
        val bh = (Config.Detect.ROI_BOTTOM - Config.Detect.ROI_TOP).toFloat() * dispH
        val radius = CornerRadius(18.dp.toPx(), 18.dp.toPx())

        // Fill-light mask: the whole surface MINUS the rounded box, drawn solid white via an even-odd
        // path so the box stays a clear window onto the camera while everything around it lights up.
        val mask = Path().apply {
            fillType = PathFillType.EvenOdd
            addRect(Rect(0f, 0f, cw, ch))
            addRoundRect(RoundRect(bx, by, bx + bw, by + bh, radius))
        }
        drawPath(mask, Color.White)

        // A thin dark border crisps the window edge against both the white surround and the camera.
        drawRoundRect(
            color = Color(0x33000000),
            topLeft = Offset(bx, by),
            size = Size(bw, bh),
            cornerRadius = radius,
            style = Stroke(width = 2.dp.toPx()),
        )
    }
}

// ---------- Top bar ----------

@Composable
private fun ScanTopBar(
    newCount: Int,
    repeatCount: Int,
    finishEnabled: Boolean,
    onFinish: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .systemBarsPadding()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        val colors = AppTheme.colors
        Row(verticalAlignment = Alignment.CenterVertically) {
            CounterChip(value = newCount, label = Pt.Scan.Counters.new, color = colors.keep)
            Spacer(Modifier.width(8.dp))
            CounterChip(value = repeatCount, label = Pt.Scan.Counters.repeated, color = colors.repeat)
        }
        Button(
            onClick = onFinish,
            enabled = finishEnabled,
            colors = ButtonDefaults.buttonColors(),
        ) {
            Text(Pt.Scan.finish)
        }
    }
}

@Composable
private fun CounterChip(value: Int, label: String, color: Color) {
    Surface(
        color = Color(0xCC000000),
        shape = RoundedCornerShape(20.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = value.toString(),
                color = color,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp,
            )
            Spacer(Modifier.width(4.dp))
            Text(text = label, color = Color.White, fontSize = 13.sp)
        }
    }
}

// ---------- Bottom controls: recent strip + manual entry ----------

@Composable
private fun ScanBottomControls(
    recent: List<br.com.fiquemsabendo.figurinhas.scan.RecentScan>,
    onManual: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var showManual by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .systemBarsPadding()
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Recent strip: colored chips, green for needed (owned=false), red for repeated (owned=true).
        AnimatedVisibility(visible = recent.isNotEmpty()) {
            val colors = AppTheme.colors
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                recent.forEach { r ->
                    val chipColor = if (r.owned) colors.repeat else colors.keep
                    val onChip = if (r.owned) colors.onRepeat else colors.onKeep
                    Text(
                        text = r.label,
                        color = onChip,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(chipColor)
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                    )
                }
            }
        }

        TextButton(
            onClick = { showManual = true },
            modifier = Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0xCC000000))
                .padding(horizontal = 4.dp),
        ) {
            Text(text = "⌨️ ${Pt.Scan.manualEntry}", color = Color.White)
        }
    }

    if (showManual) {
        ManualEntryDialog(
            onConfirm = {
                onManual(it)
                showManual = false
            },
            onDismiss = { showManual = false },
        )
    }
}

@Composable
private fun ManualEntryDialog(
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var value by remember { mutableStateOf("") }
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface) {
            Column(modifier = Modifier.padding(20.dp)) {
                OutlinedTextField(
                    value = value,
                    onValueChange = { value = it },
                    label = { Text(Pt.Scan.manualPlaceholder) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Characters,
                        imeAction = ImeAction.Done,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = { if (value.isNotBlank()) onConfirm(value) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                ) {
                    Text(Pt.Scan.manualConfirm)
                }
            }
        }
    }
}

// ---------- Camera permission denied panel ----------

@Composable
private fun CameraDeniedPanel(onRequest: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .systemBarsPadding()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = "📷", fontSize = 72.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        Text(
            text = Pt.Scan.cameraDenied,
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = Pt.Scan.cameraDeniedHint,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onRequest,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
        ) {
            Text(text = Pt.Scan.retry, fontSize = 18.sp)
        }
    }
}
