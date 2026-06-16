package br.com.fiquemsabendo.figurinhas.scan

import br.com.fiquemsabendo.figurinhas.Config

/**
 * One-shot bootstrap for a scene that is already still when the scanner opens. The normal trigger
 * requires motion before the first burst so an empty table does not scan forever; this probe keeps
 * that invariant by asking for one cheap "is there a code box?" check before opening a normal burst.
 */
internal class StaticSceneProbe {
    private var stillSince: Long? = null
    private var done = false

    fun maybeStartBurst(diff: Double, nowMs: Long, hasCodeBox: () -> Boolean): Boolean {
        when {
            diff >= Config.Capture.REARM_THRESHOLD -> {
                reset()
                return false
            }
            diff >= Config.Capture.STILL_THRESHOLD -> {
                stillSince = null
                return false
            }
            stillSince == null -> {
                stillSince = nowMs
                return false
            }
        }

        if (done) return false
        val since = stillSince ?: return false
        if (nowMs - since < Config.Capture.STABILITY_MS) return false

        done = true
        return hasCodeBox()
    }

    fun reset() {
        stillSince = null
        done = false
    }
}
