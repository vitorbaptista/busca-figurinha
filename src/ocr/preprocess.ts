/**
 * Binarize a frame so Tesseract reads it cleanly: grayscale -> Otsu threshold ->
 * black/white, then auto-flip polarity so the result is dark text on a light
 * background (what Tesseract expects). Mutates and returns the same canvas.
 */
export function preprocess(canvas: HTMLCanvasElement): HTMLCanvasElement {
  // willReadFrequently keeps the canvas CPU-backed so getImageData doesn't force a
  // slow GPU readback on every call — important on low-end phone GPUs.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const pixelCount = pixels.length / 4;

  // Grayscale into a flat buffer + build a 256-bin histogram for Otsu.
  const gray = new Uint8ClampedArray(pixelCount);
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const lum = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) | 0;
    gray[p] = lum;
    histogram[lum]++;
  }

  const threshold = otsuThreshold(histogram, pixelCount);

  // Binarize and count dark pixels to decide polarity.
  let darkCount = 0;
  for (let p = 0; p < pixelCount; p++) {
    const isDark = gray[p] <= threshold;
    if (isDark) darkCount++;
    gray[p] = isDark ? 0 : 255;
  }

  // Tesseract wants dark text on a light background. If most of the image is dark
  // the polarity is inverted (light text on dark mat), so flip it.
  const invert = darkCount > pixelCount / 2;

  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const value = invert ? 255 - gray[p] : gray[p];
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
    pixels[i + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Classic Otsu: pick the threshold that maximizes between-class variance. */
function otsuThreshold(histogram: number[], total: number): number {
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 127;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between =
      weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (between > maxVariance) {
      maxVariance = between;
      threshold = t;
    }
  }

  return threshold;
}
