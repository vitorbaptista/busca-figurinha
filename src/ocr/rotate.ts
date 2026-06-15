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
