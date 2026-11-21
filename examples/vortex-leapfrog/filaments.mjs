// Coaxial filament model adapted from the VortexLeapfrog scene. The fluid
// has no azimuthal velocity, so every passive particle stays in one meridian.
export const circulation = 1.6;
export const core = 0.12;
export const initialRadius = 1.1;
export const spacing = 1.05;
export const singleTime = 3;
export const revealTime = 0.55;
export const release = singleTime + revealTime;
const segments = 64;
const factor = circulation / (2 * segments);
const cosines = Float64Array.from({ length: segments / 2 + 1 },
  (_, i) => Math.cos(i * 2 * Math.PI / segments));

export function selfSpeed(r) {
  return circulation / (4 * Math.PI * r) * (Math.log(8 * r / core) - 0.25);
}

// dl × (p−s) projected onto x and radial directions, integrated around the
// source circle. Angles +θ and −θ contribute equal axial and radial terms.
export function field(x, rho, center, r, result) {
  const dx = x - center;
  const fixed = dx * dx + rho * rho + r * r + core * core;
  const separation = 2 * rho * r;
  let axial = 0, radial = 0;
  for (let j = 0; j < cosines.length; j++) {
    const c = cosines[j];
    const squaredDistance = fixed - separation * c;
    const weight = (j === 0 || j === segments / 2 ? 1 : 2) /
      (squaredDistance * Math.sqrt(squaredDistance));
    axial += (r - rho * c) * weight;
    radial += c * weight;
  }
  result[0] = axial * factor * r;
  result[1] = radial * dx * factor * r;
}

const scratch = new Float64Array(2);
function rates(state) {
  const [xa, ra, xb, rb] = state;
  field(xa, ra, xb, rb, scratch);
  const aX = selfSpeed(ra) + scratch[0], aR = scratch[1];
  field(xb, rb, xa, ra, scratch);
  return [aX, aR, selfSpeed(rb) + scratch[0], scratch[1]];
}

function shift(state, slope, h) {
  return state.map((v, i) => v + h * slope[i]);
}

export function ringStep(state, dt) {
  const a = rates(state);
  const b = rates(shift(state, a, dt / 2));
  const c = rates(shift(state, b, dt / 2));
  const d = rates(shift(state, c, dt));
  return state.map((v, i) => v + dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
}

const dt = 1 / 100;
const soloSpeed = selfSpeed(initialRadius);
const launchX = singleTime * soloSpeed;
const launchState = [launchX, initialRadius, launchX - spacing, initialRadius];

function makeOrbit() {
  const orbit = [launchState];
  const events = [];
  let current = launchState;
  for (let frame = 1; events.length < 4 && frame <= 15000; frame++) {
    const next = ringStep(current, dt);
    // In a coplanar passage track the axial gap; at maximum separation the
    // radii match. Detect each alternating event by a sign change.
    const gap = events.length % 2 === 0 ? s => s[0] - s[2] : s => s[1] - s[3];
    const oldGap = gap(current), newGap = gap(next);
    if (oldGap * newGap <= 0) {
      events.push(dt * (frame - 1 + oldGap / (oldGap - newGap)));
    }
    orbit.push(next);
    current = next;
  }
  if (events.length !== 4) throw new Error('Incomplete leapfrog cycle.');
  return {orbit, events};
}
const { orbit, events } = makeOrbit();
export const [firstPass, violetLead, secondPass, cyanLead] = events.map(t => release + t);

export function ringsAt(t) {
  if (t <= release) {
    const x = Math.min(t, singleTime) * soloSpeed;
    return [x, initialRadius, x - spacing, initialRadius];
  }
  const index = Math.min(orbit.length - 1, (t - release) / dt);
  const i = Math.floor(index), k = index - i;
  const a = orbit[i], b = orbit[Math.min(i + 1, orbit.length - 1)];
  return a.map((v, j) => v + (b[j] - v) * k);
}

export function frameOrigin(t, rings) {
  const midAtLaunch = (launchState[0] + launchState[2]) / 2;
  if (t < singleTime) return t / singleTime * midAtLaunch;
  return t <= release ? midAtLaunch : (rings[0] + rings[2]) / 2;
}

export const carriedCount = 22;
export const streamCount = 38;
export const particleCount = carriedCount + streamCount;
const sampleRate = 40;
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createTracers() {
  const random = seededRandom(3);
  const stride = particleCount * 2;
  const frames = Math.ceil(cyanLead * sampleRate) + 1;
  const samples = new Float32Array(frames * stride);
  const phi = new Float64Array(particleCount);
  const previous = new Float64Array(stride);
  for (let i = 0; i < particleCount; i++) {
    const carried = i < carriedCount;
    previous[2 * i] = carried ? -0.3 + 0.8 * random() : -3 + 12 * random();
    previous[2 * i + 1] = carried ? 0.55 + 0.50 * random() : 0.3 + 1.9 * random();
    phi[i] = random() * Math.PI * 2;
  }
  samples.set(previous);
  const va = new Float64Array(2), vb = new Float64Array(2);
  function flow(x, r, rings, paired, velocity) {
    field(x, r, rings[0], rings[1], velocity);
    if (paired) {
      field(x, r, rings[2], rings[3], vb);
      velocity[0] += vb[0];
      velocity[1] += vb[1];
    }
    const speed = Math.hypot(velocity[0], velocity[1]);
    if (speed > 4) { velocity[0] *= 4 / speed; velocity[1] *= 4 / speed; }
  }
  for (let i = 1; i < frames; i++) {
    const time = (i - 1) / sampleRate;
    // Both edges of the injection interval lie on sample boundaries.
    if (time < singleTime || time >= release) {
      const step = 1 / sampleRate / 2;
      for (let j = 0; j < 2; j++) {
        const start = time + step * j;
        const early = ringsAt(start), middle = ringsAt(start + step / 2);
        const paired = start >= release;
        for (let n = 0; n < particleCount; n++) {
          const p = n * 2, x = previous[p], r = previous[p + 1];
          flow(x, r, early, paired, va);
          const mx = x + step * va[0] / 2, mr = r + step * va[1] / 2;
          flow(mx, mr, middle, paired, va);
          previous[p] += step * va[0];
          previous[p + 1] += step * va[1];
        }
      }
    }
    const origin = frameOrigin(time, ringsAt(time));
    for (let n = carriedCount; n < particleCount; n++) {
      if (previous[n * 2] - origin < -6.5) {
        previous[n * 2] = origin + 5.5 + 2.5 * random();
        previous[n * 2 + 1] = 0.3 + 1.9 * random();
      }
    }
    samples.set(previous, i * stride);
  }
  const cy = Array.from(phi, Math.cos), cz = Array.from(phi, Math.sin);
  const origins = Float32Array.from({length: frames}, (_, i) => {
    const t = i / sampleRate;
    return frameOrigin(t, ringsAt(t));
  });
  function project(t, n, target, offset) {
    const at = Math.max(0, Math.min(frames - 1, t * sampleRate));
    const a = Math.floor(at), b = Math.min(a + 1, frames - 1), u = at - a;
    const ia = a * stride + n * 2, ib = b * stride + n * 2;
    const xa = samples[ia], xb = samples[ib];
    const x = Math.abs(xa - xb) > 6 ? (u < 1 ? xa : xb) : xa + u * (xb - xa);
    const r = samples[ia + 1] + u * (samples[ib + 1] - samples[ia + 1]);
    target[offset] = x - (origins[a] + u * (origins[b] - origins[a]));
    target[offset + 1] = r * cy[n];
    target[offset + 2] = r * cz[n];
  }
  return {project};
}
