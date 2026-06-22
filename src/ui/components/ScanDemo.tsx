import { useEffect, useState } from 'preact/hooks';
import { pt } from '../../i18n/pt';
// The official FIFA World Cup 2026 mark (the "26" with the trophy), traced to a monochrome vector and
// cropped to drop its baked-in code pill — so the demo can overlay its own changing code pill.
import fifa26 from './fifa26.svg';

/** The onboarding value-prop demo: a looping re-creation of the real scan→verdict moment, built
 *  from the app's own Banca visual language (the mira slot + gold sweep + the verdict ticket). It
 *  proves "show the back → instant GUARDAR/REPETIDA" in ~2.5s, with zero bundle weight and no
 *  camera. Purely decorative (aria-hidden); the headline beside it carries the message for AT. */

interface Beat {
  code: string;
  /** needed → green GUARDAR; owned → red REPETIDA. Shows the whole decision the app makes. */
  outcome: 'needed' | 'owned';
}

// One of each outcome, so the loop teaches the full value prop (keep AND discard), not just half.
const BEATS: Beat[] = [
  { code: 'MEX 3', outcome: 'needed' },
  { code: 'BRA 7', outcome: 'owned' },
];

const BEAT_MS = 2600;

const REDUCED =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ScanDemo() {
  const [i, setI] = useState(0);

  useEffect(() => {
    // Reduced motion: hold the first (GUARDAR) frame, no cycling — the CSS also stills the sweep.
    if (REDUCED) return;
    const id = setInterval(() => setI((n) => (n + 1) % BEATS.length), BEAT_MS);
    return () => clearInterval(id);
  }, []);

  const beat = BEATS[i];
  const rep = beat.outcome === 'owned';

  return (
    <div class="scan-demo" aria-hidden="true">
      <div class="scan-demo-stage">
        {/* the sticker slot — a back showing its little code, with the gold reading sweep */}
        <div class="demo-mira" key={`m${i}`}>
          <span class="corner tl" />
          <span class="corner tr" />
          <span class="corner bl" />
          <span class="corner br" />
          <div class="demo-back">
            <span class="demo-back-pill">{beat.code}</span>
            <img class="demo-back-logo" src={fifa26} alt="" />
          </div>
          <div class="demo-sweep" />
        </div>

        {/* the verdict ticket, docked at the bottom of the stage — the hero */}
        <div class={`demo-verdict${rep ? ' rep' : ''}`} key={`v${i}`}>
          <span class="demo-mark" aria-hidden="true">
            {rep ? '✕' : '✓'}
          </span>
          <span class="demo-word">{rep ? pt.onboarding.demoOwned : pt.onboarding.demoNeeded}</span>
          <span class="demo-chip">{beat.code}</span>
        </div>
      </div>
    </div>
  );
}
