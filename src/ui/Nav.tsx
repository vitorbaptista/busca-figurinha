import { pt } from '../i18n/pt';

export type Screen =
  | 'scan'
  | 'report'
  | 'collection'
  | 'trade'
  | 'repeats'
  | 'conferir'
  | 'settings';

interface NavProps {
  current: Screen;
  onNavigate: (screen: Screen) => void;
}

const ITEMS: { screen: Screen; label: string; emoji: string }[] = [
  { screen: 'scan', label: pt.nav.scan, emoji: '📷' },
  { screen: 'collection', label: pt.nav.collection, emoji: '📚' },
  { screen: 'repeats', label: pt.nav.repeats, emoji: '🔁' },
  { screen: 'trade', label: pt.nav.trade, emoji: '🤝' },
  { screen: 'settings', label: pt.nav.settings, emoji: '⚙️' },
];

export function Nav({ current, onNavigate }: NavProps) {
  // Report lives "inside" the scan flow (Escanear tab); Conferir is launched from Trocar (Trocar tab).
  const active = current === 'report' ? 'scan' : current === 'conferir' ? 'trade' : current;

  return (
    <nav class="nav">
      {ITEMS.map((item) => (
        <button
          key={item.screen}
          class={`nav-btn ${active === item.screen ? 'is-active' : ''}`}
          onClick={() => onNavigate(item.screen)}
          aria-current={active === item.screen ? 'page' : undefined}
        >
          <span class="nav-emoji" aria-hidden="true">
            {item.emoji}
          </span>
          <span class="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
