import qrcode from 'qrcode-generator';

/** Encode `value` as a QR code and return an SVG-ready description: the viewBox `size` (the module
 *  count plus a 4-module quiet zone on every side) and a single SVG `path` `d` string covering every
 *  dark module. One `<path>` instead of thousands of `<rect>`s keeps the DOM light on low-end phones.
 *  Auto type number (0) picks the smallest version that fits; EC level L maximises capacity AND module
 *  size, which scans best phone-screen-to-phone-screen (no print damage to recover from). */
export function qrSvgPath(value: string): { size: number; path: string } {
  const qr = qrcode(0, 'L');
  qr.addData(value); // Byte mode auto-detected
  qr.make();

  const count = qr.getModuleCount();
  const margin = 4;
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
  }
  return { size: count + margin * 2, path };
}
