/** Return a copy of the canvas rotated by a right-angle multiple (0/90/180/270).
 *  Used to read sticker codes that aren't upright: OCR only recognizes upright
 *  text, so we OCR the frame at each rotation and union the results. */
export function rotateCanvas(src: HTMLCanvasElement, angle: 0 | 90 | 180 | 270): HTMLCanvasElement {
  if (angle === 0) return src;

  const out = document.createElement('canvas');
  const swap = angle === 90 || angle === 270;
  out.width = swap ? src.height : src.width;
  out.height = swap ? src.width : src.height;

  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;

  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

/** Rotate a canvas by an ARBITRARY angle (degrees, clockwise) about its centre,
 *  growing the output so no content is clipped. Real handheld stickers are always
 *  slightly tilted, so we OCR a crop at a few small off-axis angles to bring the
 *  text upright — Tesseract only reads near-horizontal text. The freed corners are
 *  filled neutral grey (not black) so they don't read as ink after binarization. */
export function rotateCanvasDeg(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const norm = ((deg % 360) + 360) % 360;
  if (norm === 0) return src;
  if (norm === 90 || norm === 180 || norm === 270) {
    return rotateCanvas(src, norm as 90 | 180 | 270);
  }

  const rad = (norm * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = src.width;
  const h = src.height;
  const nw = Math.max(1, Math.ceil(w * cos + h * sin));
  const nh = Math.max(1, Math.ceil(w * sin + h * cos));

  const out = document.createElement('canvas');
  out.width = nw;
  out.height = nh;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;

  // Neutral grey corners: prepForOcr's border-flood removes them, and grey never
  // binarizes to ink the way black corners would.
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, nw, nh);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(nw / 2, nh / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -w / 2, -h / 2);
  return out;
}
