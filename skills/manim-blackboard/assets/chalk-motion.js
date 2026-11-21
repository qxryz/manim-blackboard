// The board stays still. Animate the actual marks so the held frame, hit targets
// and screen-reader tree always belong to the current mathematical state.
const inkSelector = 'path, line, polyline, polygon, circle, ellipse, rect, text';
const easing = 'cubic-bezier(.22,.72,.21,1)';

function visible(element) {
  if (element.closest('defs,clipPath,mask,marker,pattern,symbol,[hidden]')) return false;
  if (element.checkVisibility) {
    return element.checkVisibility({checkOpacity:true, checkVisibilityCSS:true});
  }
  for (let parent = element; parent instanceof SVGElement; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
  }
  return element.getClientRects().length > 0;
}

function marksOnBoard(scene) {
  const plot = scene.querySelector('#plot');
  const shapes = plot?.querySelectorAll(inkSelector);
  // A dense scientific plot should retain its point cloud as one stable field.
  if (!shapes || shapes.length > 160) return [];
  return [...shapes].filter(visible);
}

function anchorsOnBoard(scene) {
  const anchors = new Map();
  for (const element of scene.querySelectorAll('[data-bb-anchor]')) {
    if (!visible(element)) continue;
    let box = element.getBoundingClientRect();
    if (element instanceof HTMLElement && element.textContent.trim()) {
      // A formula may live in a full-width paragraph. Track the ink itself.
      const range = document.createRange();
      range.selectNodeContents(element);
      box = range.getBoundingClientRect();
    }
    const key = element.dataset.bbAnchor;
    // Ambiguous labels make an unreliable match.
    if (key && (box.width || box.height)) {
      anchors.set(key, anchors.has(key) ? null : {element, box});
    }
  }
  return anchors;
}

// Scenes may replace their entire SVG at a stop. Compare the drawn geometry
// instead of node identity so existing axes and operands hold still.
function fingerprint(shape) {
  let key = shape.outerHTML;
  for (let parent = shape.parentElement; parent instanceof SVGGElement; parent = parent.parentElement) {
    key += '|' + (parent.getAttribute('transform') || '');
  }
  return key;
}

export function createChalkMotion(scene, getReadout) {
  let animations = [];
  let source;
  let lastReveal;

  function clear() {
    for (const animation of animations) animation.cancel();
    animations = [];
    source = undefined;
  }

  function reset() {
    clear();
    lastReveal = undefined;
  }

  function prepare({sameSlide, replay}) {
    // Replay uses the original pre-click geometry, including a direct jump's
    // empty baseline when there has been no prior reveal to replay.
    if (replay && lastReveal) source = lastReveal;
    else source = {
      anchors: new Map([...anchorsOnBoard(scene)].map(([key, mark]) => [key, mark?.box])),
      ink: new Set(sameSlide && !replay ? marksOnBoard(scene).map(fingerprint) : []),
      formula: getReadout().textContent,
    };
  }

  function play({newSlide, chapter, reverse, replay, carryOnly}) {
    if (!source || typeof scene.animate !== 'function') { lastReveal = undefined; return; }
    const before = source;
    source = undefined;
    if (!replay) lastReveal = before;
    const duration = newSlide ? chapter ? 610 : 490 : 340;
    function draw(target, frames, id, time, delay = 0) {
      const animation = target.animate(frames, {id, duration:time, delay, easing, fill:'backwards'});
      animations.push(animation);
    }

    const reserved = new Set();
    for (const [key, target] of anchorsOnBoard(scene)) {
      const prior = before.anchors.get(key);
      if (!target || !prior) continue;
      const {element, box} = target;
      reserved.add(element);
      if (!newSlide && before.ink.has(fingerprint(element))) continue;
      const dx = prior.left + prior.width / 2 - box.left - box.width / 2;
      const dy = prior.top + prior.height / 2 - box.top - box.height / 2;
      if (Math.hypot(dx,dy) < 2) continue;
      // CSS translations in an SVG are in its enclosing user coordinate space.
      const parent = element.parentElement;
      const basis = parent instanceof SVGGraphicsElement && parent.getScreenCTM();
      const vector = new DOMPoint(dx, dy, 0, 0);
      const from = basis ? vector.matrixTransform(basis.inverse()) : vector;
      if (!Number.isFinite(from.x) || !Number.isFinite(from.y)) continue;
      draw(element, [{translate:`${from.x}px ${from.y}px`},{translate:'0px 0px'}],
        'bb-carry', duration + 90);
    }
    for (const animation of scene.getAnimations({subtree:true})) {
      if (animation.effect?.target) reserved.add(animation.effect.target);
    }
    const marks = carryOnly ? [] : marksOnBoard(scene);
    let order = 0;
    for (const mark of marks) {
      if (!newSlide && before.ink.has(fingerprint(mark))) continue;
      if ([...reserved].some(element => element.contains(mark))) continue;
      if (mark.localName === 'path' && !mark.getAttribute('d')?.trim()) continue;
      const paint = getComputedStyle(mark);
      if (paint.stroke === 'none' && ['none','rgba(0, 0, 0, 0)'].includes(paint.fill)) continue;
      const isLine = ['line','polyline','path'].includes(mark.localName);
      const delay = Math.min(order++ * 9, newSlide ? 115 : 70);
      const opacity = Number(paint.opacity);
      if (isLine && paint.stroke !== 'none' && paint.strokeDasharray === 'none') {
        const length = mark.pathLength?.baseVal.value || mark.getTotalLength();
        if (length > 0) {
          const dash = String(length);
          draw(mark, [{strokeDasharray:dash, strokeDashoffset:reverse ? -length : length},
            {strokeDasharray:dash, strokeDashoffset:0}], 'bb-trace', duration, delay);
          continue;
        }
      }
      if (mark.localName === 'circle' || mark.localName === 'ellipse') {
        const center = {transformBox:'fill-box', transformOrigin:'center'};
        draw(mark, [{...center, scale:'.52', opacity:.15*opacity}, {...center, scale:'1', opacity}],
          'bb-mark', duration * .7, delay + 45);
      } else {
        const text = mark.localName === 'text';
        draw(mark, [{opacity:0},{opacity}], text ? 'bb-ink' : 'bb-mark',
          duration * .72, delay + (text ? 90 : 12));
      }
    }
    const canvas = scene.querySelector('.bb-plot-frame canvas');
    if (!carryOnly && newSlide && canvas && visible(canvas)) {
      draw(canvas, [{opacity:.24},{opacity:1}], 'bb-ink', duration);
    }
    const readout = getReadout();
    if (!carryOnly && readout.textContent && (newSlide || replay || before.formula !== readout.textContent) &&
        ![...reserved].some(element => readout.contains(element))) {
      draw(readout, [{opacity:.48},{opacity:1}], 'bb-beat', duration*.64, 65);
    }
    if (animations.length) {
      // A second click can settle a drawing or a carry immediately. Cancellation
      // also resolves the wait when the speaker jumps, resizes or changes font.
      return Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    }
  }

  return {prepare, play, clear, reset};
}
