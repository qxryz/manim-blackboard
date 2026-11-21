import deckStyles from './deck.css' with { type: 'text' };
import { createChalkMotion } from './chalk-motion.js';

function makeContents(slides, navigate) {
  const trigger = document.createElement('button');
  trigger.id = 'bb-contents-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-label', 'Slide contents');
  trigger.setAttribute('aria-controls', 'bb-contents');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-keyshortcuts', 'G');
  trigger.title = 'Slide contents (G)';
  trigger.innerHTML = '<svg aria-hidden="true" viewBox="0 0 22 22" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5.5h16M3 11h16M3 16.5h11"/></svg>';

  const dialog = document.createElement('dialog');
  dialog.id = 'bb-contents';
  dialog.setAttribute('aria-labelledby', 'bb-contents-title');
  dialog.innerHTML = '<header><h2 id="bb-contents-title">Contents<span lang="zh-Hans"> · 目录</span></h2><button type="button" aria-label="Close contents" title="Close (Esc)">×</button></header><nav aria-label="Slides"></nav>';
  const nav = dialog.querySelector('nav');
  const buttons = [];
  let section;
  function translated(element, en, zh) {
    element.textContent = en;
    if (!zh) return;
    const translation = document.createElement('span');
    translation.lang = 'zh-Hans';
    translation.textContent = ` · ${zh}`;
    element.append(translation);
  }
  for (const [i, slide] of slides.entries()) {
    if (!i || slides[i - 1].chapter !== slide.chapter) {
      section = document.createElement('section');
      const heading = document.createElement('h3');
      translated(heading, slide.chapter, slide.chapterZh);
      section.append(heading);
      nav.append(section);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.targetSlide = slide.id;
    translated(button, slide.title, slide.titleZh);
    button.addEventListener('click', () => { close(); navigate(slide.id); });
    buttons.push(button);
    section.append(button);
  }
  document.body.append(trigger, dialog);
  let current = 0;
  function close() {
    dialog.close();
    trigger.setAttribute('aria-expanded', 'false');
    document.getElementById('stage').focus({ preventScroll: true });
  }
  function open() {
    if (dialog.open) { close(); return; }
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    buttons[current].focus();
  }
  trigger.addEventListener('click', open);
  dialog.querySelector('header button').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.key.toLowerCase() === 'g') {
      event.preventDefault(); event.stopPropagation(); close();
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  let hideTimer;
  function reveal() {
    clearTimeout(hideTimer);
    trigger.dataset.revealed = '';
    hideTimer = setTimeout(() => trigger.removeAttribute('data-revealed'), 2100);
  }
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse' && !event.buttons && event.clientX < 95 && event.clientY < 70) reveal();
  }, {passive:true});
  window.addEventListener('pointerup', event => { if (event.pointerType === 'touch') reveal(); }, {passive:true});
  if (matchMedia('(hover:none)').matches) reveal();
  return {
    open,
    select(index) {
      buttons[current].removeAttribute('aria-current');
      current = index;
      buttons[current].setAttribute('aria-current', 'page');
    }
  };
}

/** Compose independently mounted scenes into the interactive player's click timeline. */
export function defineDeck(slides) {
  if (!Array.isArray(slides) || !slides.length) throw new TypeError('A deck needs at least one slide.');
  const starts = new Map();
  const stops = [];
  const location = [];
  for (const [index, slide] of slides.entries()) {
    if (!slide || typeof slide.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(slide.id) || starts.has(slide.id) ||
        typeof slide.title !== 'string' || !slide.title.trim() || typeof slide.chapter !== 'string' || !slide.chapter.trim() ||
        !Array.isArray(slide.steps) || !slide.steps.length || typeof slide.mount !== 'function') {
      throw new TypeError(`Slide ${index + 1} needs a unique slug, chapter, title, steps and mount function.`);
    }
    if (slide.layout !== undefined && !['blackboard', 'default', 'wide', 'title'].includes(slide.layout)) {
      throw new TypeError(`Unknown layout on slide ${slide.id}.`);
    }
    starts.set(slide.id, stops.length);
    slide.steps.forEach((step, local) => { stops.push(step); location.push([index, local]); });
  }

  function createScene(context) {
    const { getState, invalidate, goToStep } = context;
    const style = document.createElement('style');
    style.textContent = deckStyles;
    document.head.append(style);
    const plotHost = document.createElement('div');
    plotHost.className = 'bb-plot-host';
    context.svg.replaceWith(plotHost);
    const title = document.getElementById('lesson-title');
    const titleText = document.createElement('span');
    const titleGuides = new Map();
    const sceneElement = document.getElementById('scene');
    const notes = document.getElementById('notes');
    const help = document.getElementById('help');
    help.append(' Press G for the slide contents. Page Up and Page Down change slides. Swipe across a blank area for the previous or next step.');
    let index = -1;
    let mounted;
    let readout = context.readout;
    let controls = context.controls;
    const motion = createChalkMotion(sceneElement, () => readout);
    function navigate(id, local = 0) {
      const first = starts.get(id);
      if (first === undefined || !Number.isInteger(local) || location[first + local]?.[0] !== location[first][0]) {
        throw new RangeError('Unknown slide or local step.');
      }
      goToStep(first + local);
    }
    const contents = makeContents(slides, navigate);
    function beforeEnter(step, options) {
      const [next] = location[step];
      if (index < 0 || !options.pageMotion || Math.abs(index - next) > 1) return;
      if (index === next && !options.animate) return;
      motion.prepare({sameSlide:index === next, replay:options.reason === 'replay'});
    }
    function enter(step, options) {
      const [next, local] = location[step];
      const changed = next !== index;
      const reverse = next < index;
      const chapter = index >= 0 && slides[index].chapter !== slides[next].chapter;
      if (changed) {
        mounted?.dispose?.();
        index = next;
        const slide = slides[index];
        const layout = slide.layout || 'blackboard';
        document.body.dataset.layout = layout;
        if (layout === 'title') sceneElement.prepend(title);
        else notes.prepend(title);
        titleText.textContent = slide.title;
        if (layout === 'blackboard') title.replaceChildren(titleText);
        else {
          if (!titleGuides.has(layout)) {
            const peers = slides.filter(item => item.layout === layout);
            titleGuides.set(layout, makeBlackboardLineGuide(peers.map(item => item.title)));
          }
          title.replaceChildren(titleText, titleGuides.get(layout));
        }
        const chart = context.svg.cloneNode(false);
        if (layout === 'blackboard') chart.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        const host = document.createElement('div');
        host.className = 'bb-plot-frame';
        host.append(chart);
        plotHost.replaceChildren(host);
        // Fresh nodes remove listeners, per-slide styling and captured pointers together.
        const nextReadout = context.readout.cloneNode(false);
        const nextControls = context.controls.cloneNode(false);
        readout.replaceWith(nextReadout);
        controls.replaceWith(nextControls);
        readout = nextReadout;
        controls = nextControls;
        document.body.dataset.slide = slide.id;
        contents.select(index);
        mounted = slide.mount({ svg:chart, plotHost:host, readout, controls, getState, invalidate, navigate });
        if (typeof mounted?.enter !== 'function') throw new TypeError(`Slide ${slide.id} must return enter().`);
      }
      document.body.dataset.localStep = String(local);
      // A forward page turn can open with an authored calculation. Jump links
      // and backward navigation still reconstruct the requested settled state.
      const forwardPage = changed && !reverse && options.pageMotion && options.reason === 'page';
      const running = mounted.enter(local, forwardPage ? {...options, animate:true} : options);
      if (typeof running?.then === 'function' && typeof mounted.settle !== 'function') {
        throw new TypeError(`Animated slide ${slides[index].id} must provide settle().`);
      }
      if (running && !changed) return running;
      const ink = motion.play({newSlide:changed, chapter, reverse, replay:options.reason === 'replay', carryOnly:Boolean(running)});
      return running && ink ? Promise.all([running, ink]) : running || ink;
    }
    function jumpSlide(direction) {
      const next = index + direction;
      if (next >= 0 && next < slides.length) goToStep(starts.get(slides[next].id), 'page');
    }
    return {
      beforeEnter, enter, jumpSlide, openContents:contents.open, clearMotion:motion.clear, resetMotion:motion.reset,
      settle() { mounted?.settle?.(); },
      render(now) { mounted?.render?.(now); },
      languageChanged(dual) { mounted?.languageChanged?.(dual); }
    };
  }
  return { stops, createScene };
}
