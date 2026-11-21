import * as lesson from 'blackboard-lesson';

const { title, language, secondaryLanguage, stops, createScene } = lesson;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
if (!nonempty(title) || !nonempty(language) || !Array.isArray(stops) || !stops.length || typeof createScene !== 'function') {
  throw new TypeError('A lesson needs a title, language, nonempty stops and createScene.');
}
for (const stop of stops) {
  if (!stop || !nonempty(stop.primary) || (secondaryLanguage && !nonempty(stop.secondary))) {
    throw new TypeError('Each stop needs a caption in each declared language.');
  }
}

const byId = id => document.getElementById(id);
const stage = byId('stage');
const primary = byId('primary');
const secondary = byId('secondary');
const state = document.body.dataset;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let step = 0;
let bilingual = false;
let transition = null;
let fallbackHash = '';
let renderRequest = 0;

function invalidate() {
  if (renderRequest || document.hidden) return;
  renderRequest = requestAnimationFrame(now => {
    renderRequest = 0;
    model.render?.(now);
  });
}
function getState() { return { step, bilingual, animating: Boolean(transition) }; }
const model = createScene({ svg: byId('plot'), controls: byId('scene-controls'), readout: byId('readout'),
  invalidate, getState, goToStep: (target, reason = 'jump') => enter(target, false, reason) });
if (typeof model?.enter !== 'function') throw new TypeError('createScene must return enter(step, options).');

document.title = byId('lesson-title').textContent = title;
document.documentElement.lang = primary.lang = language;
secondary.lang = secondaryLanguage || '';
byId('language-help').hidden = !secondaryLanguage;
if (secondaryLanguage) reservePrimaryCaption(stops.map(stop => stop.primary));

function captions() {
  primary.textContent = stops[step].primary;
  secondary.textContent = bilingual ? stops[step].secondary : '';
  secondary.hidden = !bilingual;
  byId('subtitles').dataset.dual = state.bilingual = String(bilingual);
}
function remember() {
  const hash = `#step-${step + 1}${bilingual ? '-dual' : ''}`;
  if (location.hash === hash) return;
  try {
    history.replaceState(null, '', hash);
  } catch {
    fallbackHash = hash;
    location.replace(hash);
  }
}
function finish() {
  model.clearMotion?.();
  if (!transition) return;
  transition = null;
  state.animating = 'false';
  model.settle();
}
// Changes to viewport, type or language can move an in-flight mark's target.
function resetDrawing() {
  finish();
  model.resetMotion?.();
}
if (model.resetMotion) {
  window.addEventListener('resize', resetDrawing);
  window.addEventListener('bb-typefacechange', resetDrawing);
}
function enter(destination, animate = false, reason = 'navigate', save = true) {
  finish();
  step = Math.max(0, Math.min(destination, stops.length - 1));
  const options = { animate: animate && !reduced.matches, bilingual, reason,
    pageMotion: !reduced.matches && (animate || reason === 'previous' || reason === 'page') };
  model.beforeEnter?.(step, options);
  state.step = String(step);
  state.animating = 'false';
  captions();
  const running = model.enter(step, options);
  if (running && typeof running.then === 'function') {
    if (typeof model.settle !== 'function') throw new TypeError('A scene returning an animation promise needs a settle() function.');
    transition = running;
    state.animating = 'true';
    running.then(() => {
      if (transition !== running) return;
      transition = null;
      state.animating = 'false';
    });
  }
  if (save) remember();
  invalidate();
}
function advance() {
  if (transition) finish();
  else if (step < stops.length - 1) enter(step + 1, true);
}
function notifyLanguage() {
  model.languageChanged?.(bilingual);
  document.dispatchEvent(new CustomEvent('blackboard:language', { detail: { bilingual } }));
}
function toggleLanguage() {
  if (!secondaryLanguage) return;
  if (model.resetMotion) resetDrawing();
  bilingual = !bilingual;
  captions();
  notifyLanguage();
  remember();
}
function restore() {
  if (fallbackHash && fallbackHash === location.hash) { fallbackHash = ''; return; }
  const match = /^#step-(\d+)(-dual)?$/.exec(location.hash);
  bilingual = Boolean(secondaryLanguage && (match?.[2] || location.hash === '#dual'));
  enter(match ? Number(match[1]) - 1 : 0, false, 'init', false);
  notifyLanguage();
}

const interactive = '[data-interact],#scene-controls,a,button,input,select,textarea,label,summary,[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="button"]';
const ownsInput = element => element instanceof Element && Boolean(element.closest(interactive));
const modified = event => event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;

// A pointer may leave a handle, cross the stage and end where it started. Only a
// short, uninterrupted press that starts and ends on the background advances.
let tap = null;
let swipeStart = null;
let clickReady = false;
let longPress = 0;
const pointers = new Set();
function clearTap() {
  clearTimeout(longPress);
  tap = null;
  clickReady = false;
}
function withinTap(event) {
  return Math.hypot(tap.x - event.clientX, tap.y - event.clientY) <= tap.tolerance;
}
stage.addEventListener('pointerdown', event => {
  clearTap();
  swipeStart = null;
  pointers.add(event.pointerId);
  if (pointers.size !== 1 || !event.isPrimary || event.button !== 0 || modified(event) || ownsInput(event.target)) return;
  tap = { id: event.pointerId, x: event.clientX, y: event.clientY, tolerance: event.pointerType === 'mouse' ? 4 : 8 };
  if (event.pointerType === 'touch' && model.jumpSlide) swipeStart = tap;
  if (event.pointerType === 'touch' && secondaryLanguage) {
    longPress = setTimeout(() => { clearTap(); swipeStart = null; toggleLanguage(); }, 600);
  }
}, true);
window.addEventListener('pointermove', event => {
  if (tap?.id === event.pointerId && (!withinTap(event) || modified(event))) clearTap();
}, true);
window.addEventListener('pointerup', event => {
  pointers.delete(event.pointerId);
  const target = document.elementFromPoint(event.clientX, event.clientY);
  if (swipeStart?.id === event.pointerId && !modified(event) && stage.contains(target) && !ownsInput(target)) {
    const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y;
    if (Math.abs(dx) > 65 && Math.abs(dx) > 1.6 * Math.abs(dy)) {
      if (dx < 0) advance();
      else enter(step - 1, false, 'previous');
    }
  }
  swipeStart = null;
  clickReady = Boolean(tap?.id === event.pointerId && withinTap(event) && !modified(event) && stage.contains(target) && !ownsInput(target));
  tap = null;
  clearTimeout(longPress);
}, true);
window.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); swipeStart = null; clearTap(); }, true);
window.addEventListener('blur', () => {
  pointers.clear(); swipeStart = null; clearTap();
  if (model.resetMotion) resetDrawing();
});
stage.addEventListener('contextmenu', event => { if (!ownsInput(event.target)) event.preventDefault(); });
stage.addEventListener('click', event => {
  const accessible = event.detail === 0 && !event.pointerType;
  if ((clickReady || accessible) && event.button === 0 && !modified(event) && !ownsInput(event.target)) advance();
  clickReady = false;
});

async function fullscreen() {
  const root = document.documentElement;
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      await (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else await (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
  } catch { /* Browser controls fullscreen in some embedded frames. */ }
}
const keys = new Map([
  [' ', advance], ['enter', advance], ['arrowright', advance], ['pagedown', model.jumpSlide ? () => model.jumpSlide(1) : advance],
  ['arrowleft', () => enter(step - 1, false, 'previous')], ['pageup', model.jumpSlide ? () => model.jumpSlide(-1) : () => enter(step - 1)],
  ['r', () => enter(step, true, 'replay')], ['f', fullscreen], ['l', toggleLanguage],
  ['home', () => enter(0)], ['end', () => enter(stops.length - 1)]
]);
if (model.openContents) keys.set('g', model.openContents);
document.addEventListener('keydown', event => {
  if (modified(event) || event.isComposing || event.repeat || event.defaultPrevented) return;
  // The type picker handles Space/Enter on its trigger. Navigation shortcuts
  // still work after a mouse user closes the picker and focus returns there.
  if (event.target.id !== 'bb-type-trigger' && event.target.id !== 'bb-contents-trigger') {
    if (ownsInput(event.target)) {
      if (event.key === 'Escape' && stage.contains(event.target)) stage.focus({ preventScroll: true });
      return;
    }
    if (event.target instanceof Element && event.target !== document.body && !stage.contains(event.target)) return;
  }
  if (event.target.id === 'bb-contents-trigger' && ['Enter', ' '].includes(event.key)) return;
  const action = keys.get(event.key.toLowerCase());
  if (action) { event.preventDefault(); action(); }
});
reduced.addEventListener('change', () => { if (reduced.matches) resetDrawing(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pointers.clear(); swipeStart = null; clearTap(); finish();
    cancelAnimationFrame(renderRequest); renderRequest = 0;
  } else invalidate();
});
window.addEventListener('hashchange', restore);
restore();
