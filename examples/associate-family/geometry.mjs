// Coordinates use the same length scale along all three mathematical axes.
export const halfPi = Math.PI / 2;
export const uLimit = Math.PI;
export const vLimit = 1.35;

export function conjugatePair(u, v) {
  const s = Math.sinh(v), c = Math.cosh(v);
  const a = Math.sin(u), b = Math.cos(u);
  return [[s * a, -s * b, u], [c * b, c * a, v]];
}

export function associatePoint(u, v, theta) {
  const [h, c] = conjugatePair(u, v);
  return h.map((component, i) => Math.cos(theta) * component + Math.sin(theta) * c[i]);
}

// On v=0 a parameter interval of width 2a has unit speed for every theta.
// Shifting its midpoint changes neither its arc nor its endpoint distance.
export function witness(theta, a = halfPi) {
  const ds = 2 * a;
  const chord = Math.hypot(2 * a * Math.cos(theta), 2 * Math.sin(a) * Math.sin(theta));
  return { length: ds, chord };
}
