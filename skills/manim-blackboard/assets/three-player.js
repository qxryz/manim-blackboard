import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as lesson from 'blackboard-lesson';

const { title, language, secondaryLanguage, stops, createScene } = lesson;
if (typeof title !== 'string' || !title.trim() || typeof language !== 'string' || !language.trim() ||
    !Array.isArray(stops) || !stops.length || typeof createScene !== 'function') {
  throw new TypeError('A 3D lesson needs a title, language, nonempty stops and createScene.');
}
for (const stop of stops) {
  if (!Number.isFinite(stop.value) || typeof stop.primary !== 'string' || !stop.primary.trim() ||
      (secondaryLanguage && (typeof stop.secondary !== 'string' || !stop.secondary.trim()))) {
    throw new TypeError('Each stop needs a finite value and a caption in each declared language.');
  }
}

const byId = id => document.getElementById(id);
const stage = byId('stage');
const visual = byId('visual');
const canvas = visual.querySelector('canvas');
const annotation = byId('annotation');
const primary = byId('primary');
const secondary = byId('secondary');
const message = byId('render-message');
const state = document.body.dataset;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

document.title = title;
document.documentElement.lang = language;
stage.setAttribute('aria-label', title);
canvas.setAttribute('aria-label', title);
primary.lang = language;
secondary.lang = secondaryLanguage || '';
byId('language-help').hidden = !secondaryLanguage;
if (secondaryLanguage) reservePrimaryCaption(stops.map(stop => stop.primary));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.05, 100);
camera.position.set(3, 2.25, 4.25);
const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.minZoom = 0.6;
controls.maxZoom = 3.5;
controls.update();

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
} catch {
  // The equations, captions and step controls remain usable without a GPU.
}
let contextLost = false;
let bilingual = false;
let step = 0;
let transition = null;
let frameRequest = 0;
let fallbackHash = '';

function renderMessage() {
  message.hidden = Boolean(renderer) && !contextLost;
  if (message.hidden) return;
  message.lang = 'en';
  message.textContent = 'A WebGL 2 browser is needed to display the 3D drawing.';
  if (bilingual && /^zh(?:-|$)/i.test(secondaryLanguage)) {
    const translation = document.createElement('span');
    translation.lang = secondaryLanguage;
    translation.textContent = '请使用支持 WebGL 2 的浏览器查看三维图形。';
    message.append(translation);
  }
}

function invalidate() {
  if (!document.hidden && !frameRequest) frameRequest = requestAnimationFrame(render);
}
const model = createScene({ THREE, scene, camera, controls, annotation, invalidate });
if (typeof model?.update !== 'function') throw new TypeError('createScene must return an update(value) function.');

function displayValue(value) {
  model.update(value);
  state.value = String(value);
}
function settle() {
  transition = null;
  state.animating = 'false';
  displayValue(stops[step].value);
  invalidate();
}
function render(now) {
  frameRequest = 0;
  if (transition) {
    const clip = transition;
    clip.start ??= now - clip.elapsed;
    clip.elapsed = now - clip.start;
    const t = Math.min(clip.elapsed / 850, 1);
    if (t === 1) {
      settle();
    } else {
      const eased = t * t * (3 - 2 * t);
      displayValue(clip.from + (stops[step].value - clip.from) * eased);
      invalidate();
    }
  }
  if (renderer && !contextLost) renderer.render(scene, camera);
}

function resize() {
  const width = visual.clientWidth;
  const height = visual.clientHeight;
  if (!width || !height) return;
  const aspect = width / height;
  const halfHeight = 1.6 * Math.max(1, 1 / aspect);
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.right = halfHeight * aspect;
  camera.left = -camera.right;
  camera.updateProjectionMatrix();
  if (renderer && !contextLost) {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
  }
  model.resize?.(width, height);
  invalidate();
}
new ResizeObserver(resize).observe(visual);
window.addEventListener('resize', resize);
controls.addEventListener('change', invalidate);
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  contextLost = true;
  renderMessage();
});
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false;
  renderMessage();
  resize();
});

function captions() {
  primary.textContent = stops[step].primary;
  secondary.textContent = bilingual ? stops[step].secondary : '';
  secondary.hidden = !bilingual;
  byId('subtitles').dataset.dual = state.bilingual = String(bilingual);
}
function savePosition() {
  const hash = '#step-' + (step + 1) + (bilingual ? '-dual' : '');
  if (location.hash === hash) return;
  try {
    history.replaceState(null, '', hash);
  } catch {
    fallbackHash = hash;
    location.replace(hash);
  }
}
function go(destination, animate = false, save = true) {
  step = Math.max(0, Math.min(stops.length - 1, destination));
  state.step = String(step);
  captions();
  if (save) savePosition();
  if (!animate || step === 0 || reduced.matches) {
    settle();
    return;
  }
  transition = { from: stops[step - 1].value, elapsed: 0, start: null };
  state.animating = 'true';
  displayValue(transition.from);
  invalidate();
}
function advance() {
  if (transition) settle();
  else if (step + 1 < stops.length) go(step + 1, true);
}
function toggleLanguage() {
  if (!secondaryLanguage) return;
  bilingual = !bilingual;
  captions();
  renderMessage();
  savePosition();
}
function restore() {
  if (fallbackHash && location.hash === fallbackHash) {
    fallbackHash = '';
    return;
  }
  const match = /^#step-(\d+)(-dual)?$/.exec(location.hash);
  bilingual = Boolean(secondaryLanguage && (match?.[2] || location.hash === '#dual'));
  renderMessage();
  go(match ? Number(match[1]) - 1 : 0, false, false);
}
window.addEventListener('hashchange', restore);
reduced.addEventListener('change', () => { if (reduced.matches && transition) settle(); });

// Qualify a tap from the entire pointer path, not the distance between its ends.
// OrbitControls captures its canvas pointer and releases it before the browser emits click.
const pointers = new Set();
let tap = null;
let allowedClick = false;
let longPress = 0;
function cancelTap() {
  clearTimeout(longPress);
  tap = null;
  allowedClick = false;
}
function modified(event) {
  return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;
}
stage.addEventListener('pointerdown', event => {
  cancelTap();
  pointers.add(event.pointerId);
  if (pointers.size !== 1 || !event.isPrimary || event.button !== 0 || modified(event)) return;
  tap = { id: event.pointerId, x: event.clientX, y: event.clientY,
    tolerance: event.pointerType === 'mouse' ? 3 : 7 };
  if (event.pointerType === 'touch' && secondaryLanguage) {
    longPress = setTimeout(() => { cancelTap(); toggleLanguage(); }, 600);
  }
}, true);
function followsTap(event) {
  return Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= tap.tolerance;
}
window.addEventListener('pointermove', event => {
  if (tap?.id !== event.pointerId) return;
  if (!followsTap(event) || modified(event)) cancelTap();
  else if (event.target === canvas) event.stopPropagation(); // Ignore sub-threshold tremor before orbiting.
}, true);
window.addEventListener('pointerup', event => {
  pointers.delete(event.pointerId);
  allowedClick = Boolean(tap?.id === event.pointerId && followsTap(event) &&
    !modified(event) && event.button === 0 && stage.contains(document.elementFromPoint(event.clientX, event.clientY)));
  clearTimeout(longPress);
  tap = null;
}, true);
window.addEventListener('pointercancel', event => {
  pointers.delete(event.pointerId);
  cancelTap();
}, true);
window.addEventListener('blur', () => { pointers.clear(); cancelTap(); });
stage.addEventListener('wheel', cancelTap, { capture: true, passive: true });
stage.addEventListener('contextmenu', event => event.preventDefault());
stage.addEventListener('click', event => {
  const accessibleActivation = event.detail === 0 && !event.pointerType;
  if ((allowedClick || accessibleActivation) && !modified(event) && event.button === 0) advance();
  allowedClick = false;
});

async function fullscreen() {
  const root = document.documentElement;
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      await (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      await (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
    }
  } catch { /* Some embedded browsers control fullscreen themselves. */ }
}
const keys = new Map([
  [' ', advance], ['enter', advance], ['arrowright', advance], ['pagedown', advance],
  ['arrowleft', () => go(step - 1)], ['pageup', () => go(step - 1)],
  ['r', () => go(step, true)], ['l', toggleLanguage], ['f', fullscreen],
  ['home', () => go(0)], ['end', () => go(stops.length - 1)]
]);
document.addEventListener('keydown', event => {
  if (modified(event) || event.repeat || event.isComposing) return;
  const action = keys.get(event.key.toLowerCase());
  if (action) { event.preventDefault(); action(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    if (transition) transition.start = null;
    pointers.clear();
    cancelTap();
  } else invalidate();
});
resize();
restore();
