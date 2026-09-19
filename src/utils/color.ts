/**
 * CSS colour helpers for the 3D scenes (graph widget, landing page). The app palette (useAppColors) hands
 * out `rgba(r, g, b, a)` strings; three.js parses those but logs a warning for
 * every one that carries an alpha, so the scenes work in opaque `#rrggbb`.
 */

export type RGB = [number, number, number];

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const hex2 = (n: number) => clamp255(n).toString(16).padStart(2, '0');

/** Parse `rgb(...)`, `rgba(...)` or `#rgb`/`#rrggbb`. Alpha is dropped. Unparseable input becomes black. */
export function parseCssColor(css: string): RGB {
  const s = css.trim();
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
  if (fn) return [clamp255(+fn[1]), clamp255(+fn[2]), clamp255(+fn[3])];
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (short) return [parseInt(short[1] + short[1], 16), parseInt(short[2] + short[2], 16), parseInt(short[3] + short[3], 16)];
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(s);
  if (long) return [parseInt(long[1], 16), parseInt(long[2], 16), parseInt(long[3], 16)];
  return [0, 0, 0];
}

export const rgbToHex = ([r, g, b]: RGB): string => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

export const toHex = (css: string): string => rgbToHex(parseCssColor(css));

/** Linear blend of two colours: amount 0 = `a`, 1 = `b`. Used to fade nodes toward the background. */
export function mixCss(a: string, b: string, amount: number): string {
  const ca = parseCssColor(a);
  const cb = parseCssColor(b);
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * amount,
    ca[1] + (cb[1] - ca[1]) * amount,
    ca[2] + (cb[2] - ca[2]) * amount,
  ]);
}
