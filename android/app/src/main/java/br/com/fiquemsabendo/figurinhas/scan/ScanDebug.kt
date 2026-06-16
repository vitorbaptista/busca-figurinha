package br.com.fiquemsabendo.figurinhas.scan

import br.com.fiquemsabendo.figurinhas.ocr.CapturePhase

/** Live debug snapshot the Scan screen renders when the Ajustes debug toggle is on. */
data class DebugInfo(
    val tick: Long = 0,                         // increments every camera frame (heartbeat)
    val phase: CapturePhase = CapturePhase.WAITING,
    val diffPct: Int = 0,                       // last frame-diff, 0..100
    val heldMs: Long = 0,                       // ms the sticker has been held still
    val reads: List<String> = emptyList(),      // raw OCR texts from the last recognize (RecognizeOutcome.reads)
    val resolved: List<String> = emptyList(),   // checklist codes the last frame resolved
    val committed: List<String> = emptyList(),  // codes that actually committed (post confirm+cooldown)
    val crops: Int = 0,                         // crops OCR'd last recognize (RecognizeOutcome.crops)
    val lastMs: Long = 0,                        // wall-clock ms the last recognize took
    val cameraFps: Double = 0.0,                 // camera frame-delivery rate (input, ~30 fps)
    val ocrFps: Double = 0.0,                    // recognitions completed per second (OCR throughput)
    val dumpEnabled: Boolean = false,           // is frame/crop dumping on?
    val lastDumpDir: String? = null,            // absolute dir of the last dump (for "adb pull")
)
