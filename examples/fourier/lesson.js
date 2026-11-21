export const title = 'Building a square wave';
export const language = 'en';
export const secondaryLanguage = 'zh-Hans';

export const stops = [
  {
    primary: 'Start with one sine wave. Its peaks are round. Can a sum of smooth waves make a flat top?',
    secondary: '从一条正弦曲线开始，它的波峰是圆的。把光滑的波叠起来，能拼出平顶吗？',
  },
  {
    primary: 'Add the third harmonic. It makes three cycles in one period and pulls down the middle of the peak.',
    secondary: '加入三次谐波。它在同一段时间里振动三次，恰好把原来波峰的中间压低。',
  },
  {
    primary: 'Add the fifth harmonic. Its amplitude is one fifth of the first, so it makes a finer correction.',
    secondary: '加入五次谐波。它的振幅只有基波的五分之一，能更细地修整波形。',
  },
  {
    primary: 'Add the seventh. As more odd harmonics enter, the ripples crowd toward the jumps. The overshoot persists.',
    secondary: '加入七次谐波。随着更多奇次谐波叠加，波纹逐渐集中到跳变处，越过目标高度的现象依然存在。',
  },
  {
    primary: 'Which frequency gives the pulse its broad shape? Tap the first spectral line to compare the sum with and without the fundamental.',
    secondary: '哪一个频率决定了脉冲宽阔的形状？点最左边的谱线，对比有基波和没有基波时的波形。',
  },
];

const orders = [1, 3, 5, 7];
const presets = [[1], [1, 3], [1, 3, 5], [1, 3, 5, 7], [3, 5, 7]];
const left = 52, right = 618, mid = 145, unit = 68;
const halfSpan = 1.12 * Math.PI;
const xAt = angle => left + (right - left) * (angle + halfSpan) / (2 * halfSpan);
const samples = Array.from({length: 477}, (_, i) => {
  const angle = -halfSpan + (2 * halfSpan) * i / 476;
  return {
    x: xAt(angle).toFixed(2),
    terms: orders.map(n => 4 * Math.sin(n * angle) / (Math.PI * n)),
  };
});

function curve(weights, center, scale) {
  return samples.map(({x, terms}, i) => {
    const value = terms.reduce((sum, term, j) => sum + weights[j] * term, 0);
    return `${i ? 'L' : 'M'}${x},${(center - scale * value).toFixed(2)}`;
  }).join(' ');
}

export function createScene({svg, readout, getState}) {
  const namespace = 'http://www.w3.org/2000/svg';
  const sumColor = '#77dace', termColor = '#efbe77', guideColor = '#c6c3b9', axisColor = '#565d5d';
  svg.setAttribute('viewBox', '0 0 640 390');
  svg.setAttribute('role', 'group');
  function put(tag, attributes, text, host = svg) {
    const item = document.createElementNS(namespace, tag);
    for (const [key, value] of Object.entries(attributes)) item.setAttribute(key, value);
    if (text !== undefined) item.textContent = text;
    host.append(item);
    return item;
  }
  function label(x, y, size, text, more = {}, host) {
    return put('text', {x, y, fill: guideColor, 'font-size': size, ...more}, text, host);
  }
  function line(d, color, width, more = {}, host) {
    return put('path', {d, fill: 'none', stroke: color, 'stroke-width': width, ...more}, undefined, host);
  }

  // The dashed plateaus stop at each discontinuity. A vertical segment would
  // assign several values to the target function at the same angle.
  line(`M${left},${mid}H${right} M${xAt(0)},42V234`, axisColor, 1.15);
  for (const [angle, text] of [[-Math.PI, '−π'], [0, '0'], [Math.PI, 'π']]) {
    line(`M${xAt(angle)},${mid - 4}v8`, '#a8acab', 1.2);
    label(xAt(angle), 250, 19, text, {'text-anchor': 'middle'});
  }
  label(left - 11, mid - unit + 6, 20, '+1', {'text-anchor': 'end'});
  label(left - 11, mid + unit + 6, 20, '−1', {'text-anchor': 'end'});
  const breaks = [-halfSpan, -Math.PI, 0, Math.PI, halfSpan];
  const target = breaks.slice(0, -1).map((a, i) => {
    const b = breaks[i + 1];
    const level = Math.sign(Math.sin((a + b) / 2));
    return `M${xAt(a)},${mid - unit * level}H${xAt(b)}`;
  }).join(' ');
  line(target, guideColor, 1.8, {'stroke-dasharray': '6 7'});
  const sumCurve = line('', sumColor, 3.6, {'stroke-linejoin': 'round', 'data-curve': 'sum'});
  line(`M${left},22h26`, sumColor, 3.6);
  const sumLabel = label(left + 36, 28, 20, '', {fill: sumColor});
  line('M335,22h26', guideColor, 1.8, {'stroke-dasharray':'6 5'});
  const targetLabel = label(371, 28, 20, '');

  const termPlot = put('g', {});
  const termLabel = label(left, 290, 19, '', {fill: termColor}, termPlot);
  const componentMiddle = 335;
  line(`M${left},${componentMiddle}H${right}`, axisColor, 1.15, {}, termPlot);
  const componentScale = 31;
  for (const value of [-1, 1]) {
    const y = componentMiddle - value * componentScale;
    line(`M${left - 4},${y}h8`, axisColor, 1.15, {}, termPlot);
    label(left - 11, y + 6, 18, value === 1 ? '+1' : '−1', {'text-anchor': 'end'}, termPlot);
  }
  const component = line('', termColor, 2.8, {'stroke-linejoin':'round', 'data-curve':'component'}, termPlot);

  readout.innerHTML = `
    <style>
      .fourier-eq { display: flex; align-items: center; gap: .16em; color: #f4f0e6; font-size: clamp(24px,3.05vw,48px); line-height: 1.4; white-space: nowrap; }
      .fourier-frac { display: inline-grid; text-align: center; align-items: center; font-size: .82em; line-height: 1.15; }
      .fourier-frac > span:first-child { padding: 0 .12em .10em; border-bottom: 1px solid currentColor; }
      .fourier-frac > span + span { padding-top: .08em; }
      .fourier-sum { display: inline-grid; text-align: center; margin: 0 .05em; line-height: 1; transform: translateY(.15em); }
      .fourier-sum small { font-size: .37em; line-height: 1.5; }
      .fourier-active { margin-top: .65em; font-size: .82em; color: #b9bfbb; }
      .fourier-stem { cursor: pointer; }
      .fourier-stem:focus-visible { outline: 2px solid #e2e7de; }
      @media (orientation: portrait) { .fourier-eq { font-size: clamp(23px,6.1vw,32px); } }
    </style>
    <div class="fourier-eq" role="math" aria-label="S of x equals four over pi times the sum over active harmonics n of sine n x divided by n">
      <i>S(x)</i><span>=</span><span class="fourier-frac"><span>4</span><span>π</span></span>
      <span class="fourier-sum">∑<small>n ∈ H</small></span>
      <span class="fourier-frac"><span>sin(<i>nx</i>)</span><span><i>n</i></span></span>
    </div><div class="fourier-active" data-series></div>`;
  const activeTerms = readout.querySelector('[data-series]');
  let selected = new Set();
  let weights = orders.map(() => 0);
  let step = 0, frame = 0, finish = null;
  let dual = Boolean(getState().bilingual);
  const media = matchMedia('(prefers-reduced-motion: reduce)');

  // A stem is a Fourier coefficient. The hollow tip keeps the frequency
  // addressable when its actual coefficient has fallen to zero.
  const spectrum = put('g', {'data-spectrum':''});
  const baseline = 349, scale = 54, xs = orders.map(n => 79 + n * 66);
  line(`M${left},${baseline}H${right - 24}`, axisColor, 1.2, {}, spectrum);
  label(left - 3, 283, 23, 'bₙ', {fill:termColor}, spectrum);
  label(right, baseline + 7, 22, 'n', {'text-anchor':'end'}, spectrum);
  const stems = orders.map((n, i) => {
    const x = xs[i], height = 4 * scale / (Math.PI * n), peak = baseline - height;
    const g = put('g', {class:'fourier-stem', 'data-interact':'', 'data-harmonic':n, tabindex:'0', role:'button'}, undefined, spectrum);
    put('rect', {x:x-36, y:270, width:72, height:114, fill:'transparent'}, undefined, g);
    line(`M${x},${baseline} V${peak}`, '#8e7861', 1.5, {'stroke-dasharray':'2 4'}, g);
    put('circle', {cx:x, cy:peak, r:4.6, fill:'#000', stroke:termColor, 'stroke-width':1.5}, undefined, g);
    const stem = line('', termColor, 3.1, {'stroke-linecap':'round'}, g);
    const dot = put('circle', {cx:x, r:4.3, fill:termColor}, undefined, g);
    label(x, 378, 21, String(n), {'text-anchor':'middle'}, g);
    function toggle(event) {
      event.preventDefault(); event.stopPropagation();
      const next = new Set(selected);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      change(next, true);
    }
    g.addEventListener('click', toggle);
    g.addEventListener('keydown', e => {
      if (!e.repeat && (e.key === ' ' || e.key === 'Enter')) toggle(e);
    });
    return {g, stem, dot, x, height};
  });

  function annotate() {
    const highest = orders.filter(n => selected.has(n)).at(-1);
    const explore = step === presets.length - 1;
    spectrum.style.display = explore ? '' : 'none';
    termPlot.style.display = explore ? 'none' : '';
    sumLabel.textContent = dual ? 'Sum · 叠加' : 'Sum';
    targetLabel.textContent = dual ? 'Square wave · 方波' : 'Square wave';
    activeTerms.textContent = selected.size ? `H = { ${orders.filter(n => selected.has(n)).join(', ')} }` : 'H = ∅';
    if (explore) {
      svg.setAttribute('aria-label', dual ? '叠加波形与可点选的频谱' : 'Fourier sum and selectable spectrum');
      stems.forEach(({g}, i) => {
        g.setAttribute('aria-label', dual ? `第 ${orders[i]} 次谐波` : `Harmonic ${orders[i]}`);
        g.setAttribute('aria-pressed', String(selected.has(orders[i])));
      });
    } else {
      svg.setAttribute('aria-label', dual ? '叠加波形与新加入的谐波' : 'Fourier sum and the newly added harmonic');
      termLabel.textContent = dual ? `Harmonic · 谐波   n = ${highest}` : `Harmonic   n = ${highest}`;
      component.setAttribute('d', curve(orders.map(n => Number(n === highest)), componentMiddle, componentScale));
    }
  }
  function paint() {
    sumCurve.setAttribute('d', curve(weights, mid, unit));
    if (step !== presets.length - 1) return;
    stems.forEach(({stem, dot, x, height}, i) => {
      const y = baseline - weights[i] * height;
      stem.setAttribute('d', `M${x},${baseline}V${y}`);
      dot.setAttribute('cy', y);
    });
  }
  function stopMotion() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (finish) { finish(); finish = null; }
  }
  function settle() {
    stopMotion();
    weights = orders.map(n => Number(selected.has(n)));
    paint();
  }
  function change(next, animate) {
    stopMotion();
    selected = next;
    const goal = orders.map(n => Number(selected.has(n)));
    const start = weights.slice();
    annotate();
    if (!animate || media.matches || start.every((v,i) => v === goal[i])) {
      weights = goal;
      paint();
      return;
    }
    const begin = performance.now();
    return new Promise(resolve => {
      finish = resolve;
      function tick(now) {
        const t = Math.min(1, (now - begin) / 390);
        const eased = t * t * (3 - 2 * t);
        weights = goal.map((v,i) => start[i] + (v - start[i]) * eased);
        paint();
        if (t < 1 && !media.matches) frame = requestAnimationFrame(tick);
        else settle();
      }
      frame = requestAnimationFrame(tick);
    });
  }
  return {
    enter(next, {animate, bilingual, reason}) {
      step = next;
      dual = bilingual;
      if (reason === 'replay') {
        const previous = step > 0 ? presets[step - 1] : [];
        weights = orders.map(n => Number(previous.includes(n)));
      }
      return change(new Set(presets[step]), animate);
    },
    languageChanged(bilingual) { dual = bilingual; annotate(); },
    settle,
  };
}
