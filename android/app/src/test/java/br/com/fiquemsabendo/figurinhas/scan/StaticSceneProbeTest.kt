package br.com.fiquemsabendo.figurinhas.scan

import br.com.fiquemsabendo.figurinhas.Config
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class StaticSceneProbeTest {
    private val still = 0.0
    private val moving = Config.Capture.STILL_THRESHOLD
    private val rearm = Config.Capture.REARM_THRESHOLD

    @Test fun still_scene_waits_for_stability_before_probe() {
        val probe = StaticSceneProbe()
        var checked = false

        assertFalse(probe.maybeStartBurst(still, 1_000L) { checked = true; true })
        assertFalse(checked)

        assertFalse(probe.maybeStartBurst(still, 1_000L + Config.Capture.STABILITY_MS - 1) {
            checked = true
            true
        })
        assertFalse(checked)

        assertTrue(probe.maybeStartBurst(still, 1_000L + Config.Capture.STABILITY_MS) {
            checked = true
            true
        })
        assertTrue(checked)
    }

    @Test fun empty_still_scene_is_checked_once_until_real_motion() {
        val probe = StaticSceneProbe()
        var checks = 0

        probe.maybeStartBurst(still, 1_000L) { checks++; false }
        assertFalse(probe.maybeStartBurst(still, 1_000L + Config.Capture.STABILITY_MS) {
            checks++
            false
        })
        assertFalse(probe.maybeStartBurst(still, 1_000L + Config.Capture.STABILITY_MS * 2) {
            checks++
            true
        })
        assertTrue(checks == 1, "empty static scene must not be probed repeatedly; checks=$checks")

        assertFalse(probe.maybeStartBurst(rearm, 2_000L) { checks++; true })
        assertFalse(probe.maybeStartBurst(still, 2_016L) { checks++; true })
        assertTrue(probe.maybeStartBurst(still, 2_016L + Config.Capture.STABILITY_MS) {
            checks++
            true
        })
        assertTrue(checks == 2, "real motion re-arms one more static probe; checks=$checks")
    }

    @Test fun small_movement_restarts_stability_without_rearming_done_probe() {
        val probe = StaticSceneProbe()
        var checks = 0

        probe.maybeStartBurst(still, 1_000L) { checks++; true }
        assertTrue(probe.maybeStartBurst(still, 1_000L + Config.Capture.STABILITY_MS) {
            checks++
            true
        })
        assertTrue(checks == 1)

        assertFalse(probe.maybeStartBurst(moving, 2_000L) { checks++; true })
        assertFalse(probe.maybeStartBurst(still, 2_016L + Config.Capture.STABILITY_MS) {
            checks++
            true
        })
        assertTrue(checks == 1, "only rearm-threshold motion may reset a completed probe")
    }
}
