import { qrSvgPath } from './qr';

interface QrCodeProps {
  /** The text/URL to encode (here: the trade deep link). */
  value: string;
  /** Accessible label for the QR image (pt-BR). */
  ariaLabel: string;
  class?: string;
}

/** Renders `value` as a crisp, scalable QR code: dark modules on a white quiet zone, as a single
 *  `<path>` inside one `<svg>` so it stays sharp at any CSS size with a light DOM footprint. */
export function QrCode({ value, ariaLabel, class: className }: QrCodeProps) {
  const { size, path } = qrSvgPath(value);
  return (
    <svg
      class={className}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel}
      shape-rendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
