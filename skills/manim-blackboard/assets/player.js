'use strict';
(() => {
  const byId = id => document.getElementById(id);
  const data = JSON.parse(byId('lesson').textContent);
  const board = data.boards[0];
  const stage = byId('stage');
  const art = byId('art');
  const subtitles = byId('subtitles');
  const primary = byId('primary');
  const secondary = byId('secondary');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const svg = name => document.createElementNS('http://www.w3.org/2000/svg', name);

  document.title = data.title;
  document.documentElement.lang = data.language;
  stage.setAttribute('aria-label', data.title);
  primary.lang = data.language;
  secondary.lang = data.secondaryLanguage || '';
  byId('language-help').hidden = !data.secondaryLanguage;
  if (data.secondaryLanguage) reservePrimaryCaption(data.captions.map(([line]) => line));
  byId('picture').setAttribute('viewBox', board.viewBox.join(' '));

  // Rebuild vector primitives through SVG properties. Lesson text always uses textContent.
  const paintNames = new Set(['fill', 'stroke', 'fill-opacity', 'stroke-opacity', 'stroke-width',
    'stroke-linecap', 'stroke-linejoin']);
  const paints = data.paint.map(attributes => {
    const result = [];
    for (const [, name, value] of attributes.matchAll(/([\w-]+)="([^"]*)"/g)) {
      if (!paintNames.has(name)) continue;
      if ((name === 'fill' || name === 'stroke') && !/^(none|#[\da-f]{6}|url\(#[\w-]+\))$/i.test(value)) continue;
      result.push([name, value]);
    }
    return result;
  });
  const gradientNodes = new Map();
  function makeGradientDefinitions(markup) {
    if (gradientNodes.has(markup)) return gradientNodes.get(markup).cloneNode(true);
    const source = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
    const defs = svg('defs');
    for (const input of source.children) {
      if (input.localName !== 'linearGradient') continue;
      const gradient = svg('linearGradient');
      for (const name of ['id', 'gradientUnits', 'x1', 'y1', 'x2', 'y2']) {
        if (input.hasAttribute(name)) gradient.setAttribute(name, input.getAttribute(name));
      }
      for (const item of input.children) {
        if (item.localName !== 'stop') continue;
        const stop = svg('stop');
        for (const name of ['offset', 'stop-opacity']) {
          if (item.hasAttribute(name)) stop.setAttribute(name, item.getAttribute(name));
        }
        const color = item.getAttribute('stop-color');
        if (/^#[\da-f]{6}$/i.test(color)) stop.setAttribute('stop-color', color);
        gradient.append(stop);
      }
      defs.append(gradient);
    }
    gradientNodes.set(markup, defs);
    return defs.cloneNode(true);
  }
  function makeMark(id) {
    const item = data.items[id];
    if (typeof item === 'string') return makeGradientDefinitions(item);
    const [geometry, paint] = item;
    const path = svg('path');
    path.setAttribute('d', data.geometry[geometry]);
    for (const [name, value] of paints[paint]) path.setAttribute(name, value);
    return path;
  }
  let previous = [];
  function draw(frame) {
    for (let i = 0; i < frame.length; i++) {
      if (frame[i] === previous[i]) continue;
      const node = makeMark(frame[i]);
      if (art.children[i]) art.children[i].replaceWith(node);
      else art.append(node);
    }
    while (art.childElementCount > frame.length) art.lastElementChild.remove();
    previous = frame;
  }

  let step = 0;
  let bilingual = false;
  let playing = false;
  let raf = 0;
  let elapsed = 0;
  let started;
  let lastFrame = -1;
  let ownHash = null;
  function captions() {
    const [line, translation] = data.captions[step];
    primary.textContent = line;
    secondary.textContent = translation || '';
    secondary.hidden = !bilingual || !translation;
    subtitles.dataset.dual = String(!secondary.hidden);
    document.body.dataset.bilingual = String(bilingual);
    byId('description').textContent = line;
  }
  function savePosition() {
    const hash = '#step-' + (step + 1) + (bilingual ? '-dual' : '');
    if (location.hash === hash) return;
    try {
      history.replaceState(null, '', hash);
    } catch {
      ownHash = hash;
      location.replace(hash);
    }
  }
  function hold() {
    cancelAnimationFrame(raf);
    playing = false;
    raf = 0;
    document.body.dataset.animating = 'false';
    const frames = step > 0 && board.beats[step - 1].frames;
    draw(frames ? frames[frames.length - 1] : board.initial);
  }
  function tick(now) {
    raf = 0;
    if (!playing || document.hidden) return;
    if (started === undefined) started = now - elapsed;
    elapsed = now - started;
    const beat = board.beats[step - 1];
    const fraction = elapsed / (1000 * beat.duration);
    if (fraction >= 1) { hold(); return; }
    const index = Math.floor(fraction * (beat.frames.length - 1));
    if (index !== lastFrame) {
      draw(beat.frames[index]);
      lastFrame = index;
    }
    raf = requestAnimationFrame(tick);
  }
  function enter(destination, animate = true, save = true) {
    cancelAnimationFrame(raf);
    step = Math.min(board.beats.length, Math.max(0, destination));
    document.body.dataset.step = String(step);
    captions();
    if (save) savePosition();
    if (!animate || !step || motion.matches) { hold(); return; }
    playing = true;
    elapsed = 0;
    started = undefined;
    lastFrame = 0;
    document.body.dataset.animating = 'true';
    draw(board.beats[step - 1].frames[0]);
    if (!document.hidden) raf = requestAnimationFrame(tick);
  }
  function next() {
    if (playing) hold();
    else if (step < board.beats.length) enter(step + 1);
  }
  function back() { if (step > 0) enter(step - 1, false); }
  function language() {
    if (!data.secondaryLanguage) return;
    bilingual = !bilingual;
    captions();
    savePosition();
  }
  async function fullscreen() {
    try {
      const root = document.documentElement;
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      } else {
        await (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
      }
    } catch { /* Fullscreen availability depends on the browser and its embedding context. */ }
  }

  let contact = null;
  let longPress = 0;
  let suppressClick = false;
  function endContact() {
    clearTimeout(longPress);
    contact = null;
  }
  stage.addEventListener('pointerdown', event => {
    endContact();
    suppressClick = false;
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    contact = {id: event.pointerId, x: event.clientX, y: event.clientY};
    if (data.secondaryLanguage) {
      longPress = setTimeout(() => { suppressClick = true; language(); }, 600);
    }
  });
  stage.addEventListener('pointermove', event => {
    if (contact?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - contact.x, event.clientY - contact.y) > 12) clearTimeout(longPress);
  });
  stage.addEventListener('pointerup', event => {
    if (contact?.id !== event.pointerId) return;
    const dx = event.clientX - contact.x;
    const dy = event.clientY - contact.y;
    if (!suppressClick && Math.abs(dx) > 55 && Math.abs(dx) > 1.6 * Math.abs(dy)) {
      suppressClick = true;
      if (dx < 0) next();
      else back();
    }
    endContact();
  });
  stage.addEventListener('pointercancel', endContact);
  stage.addEventListener('contextmenu', event => { if (contact || suppressClick) event.preventDefault(); });
  stage.addEventListener('click', event => {
    if (suppressClick && event.detail) { suppressClick = false; return; }
    next();
  });
  const keys = new Map([
    [' ', next], ['enter', next], ['arrowright', next], ['pagedown', next],
    ['arrowleft', back], ['pageup', back], ['r', () => enter(step)], ['l', language],
    ['f', fullscreen], ['home', () => enter(0, false)], ['end', () => enter(board.beats.length, false)]
  ]);
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    const action = keys.get(event.key.toLowerCase());
    if (action) { event.preventDefault(); action(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      started = undefined;
      endContact();
    } else if (playing && !raf) {
      raf = requestAnimationFrame(tick);
    }
  });
  motion.addEventListener?.('change', () => { if (playing && motion.matches) hold(); });
  function restore() {
    if (ownHash && location.hash === ownHash) { ownHash = null; return; }
    const match = /^#step-(\d+)(-dual)?$/.exec(location.hash);
    bilingual = Boolean(data.secondaryLanguage && (match?.[2] || location.hash === '#dual'));
    enter(match ? Number(match[1]) - 1 : 0, false, false);
  }
  window.addEventListener('hashchange', restore);
  restore();
})();
