import { useState } from 'preact/hooks';
import { pt } from '../i18n/pt';

interface OnboardingProps {
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps) {
  const [index, setIndex] = useState(0);
  const slides = pt.onboarding.slides;
  const isLast = index === slides.length - 1;
  const slide = slides[index];

  const next = () => (isLast ? onDone() : setIndex(index + 1));

  return (
    <div class="onboarding">
      <button class="onboarding-skip" onClick={onDone}>
        {pt.onboarding.skip}
      </button>

      <div class="onboarding-slide" key={index}>
        <div class="onboarding-emoji" aria-hidden="true">
          {slide.emoji}
        </div>
        <h2 class="onboarding-title">{slide.title}</h2>
        <p class="onboarding-text">{slide.text}</p>
      </div>

      <div class="onboarding-dots" aria-hidden="true">
        {slides.map((_, i) => (
          <span key={i} class={`dot ${i === index ? 'is-active' : ''}`} />
        ))}
      </div>

      <button class="btn btn-primary btn-block" onClick={next}>
        {isLast ? pt.onboarding.start : pt.onboarding.next}
      </button>
    </div>
  );
}
