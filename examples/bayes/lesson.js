export const title = 'What does a flag tell us?';
export const language = 'en';
export const secondaryLanguage = 'zh-Hans';

export const stops = [
  {
    primary: 'The batch starts with 1,000 parts. Each amber diamond is defective. Each blue circle is sound.',
    secondary: '整批共有 1,000 个零件。琥珀色菱形代表次品，蓝色圆点代表合格品。'
  },
  {
    primary: 'The scanner flags 80% of defective parts and 10% of sound ones. The flagged parts stay bright.',
    secondary: '扫描仪会标记 80% 的次品，也会误标 10% 的合格品。仍然亮着的就是被标记的零件。'
  },
  {
    primary: 'Keep only the flags. To find the chance that a flagged part is defective, divide the diamonds by all the marks left.',
    secondary: '只留下被标记的零件。用其中的菱形数除以剩下的零件总数，就得到被标记后确实是次品的概率。'
  },
  {
    primary: 'As defects get rarer, a larger share of the flags are false alarms. Change the defect rate to see why.',
    secondary: '次品越少，被标记的零件里误报占的比例就越高。拖动次品率，看看为什么会这样。'
  }
];

const batchSize = 1000;
const fullRows = 25;
const colors = { defect: '#f1b077', sound: '#83bed2', dimDefect: '#5e4431', dimSound: '#2a3d42' };
const number = new Intl.NumberFormat('en-US');
const percentage = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

function svgNode(name, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function position(index, rows, columns, size) {
  const x = 30 + (Math.floor(index / rows) + 0.5) * 580 / columns;
  const y = 49 + (index % rows + 0.5) * 290 / rows;
  return `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${size.toFixed(2)})`;
}

export function createScene({ svg, controls, readout, getState }) {
  let step = 0;
  let bilingual = false;
  let endMotion;
  svg.setAttribute('viewBox', '0 0 640 400');
  svg.innerHTML = `
    <style>
      .lot-mark { transform-origin: 0 0; }
      @media (prefers-reduced-motion: no-preference) {
        .lot-easing .lot-mark { transition: transform .52s cubic-bezier(.25,.7,.21,1), opacity .28s ease, fill .32s ease; }
      }
      .lot-text { fill: #e3e3d9; font-size: 25px; }
      .lot-key { font-size: 22px; }
      #readout .lot-rate-name { margin: 0 0 .06em; font-size: .79em; color: #c8cfcd; }
      #readout .lot-rate { margin: 0; font-size: 1.23em; font-variant-numeric: tabular-nums; white-space: nowrap; }
      #readout .lot-numerator { color: ${colors.defect}; }
      #scene-controls .lot-prior { display: flex; gap: .6em; align-items: center; }
      #scene-controls .lot-prior input { flex: 1; min-width: 2em; max-width: 7.3em; margin: 0; height: 1.6em; cursor: pointer; accent-color: ${colors.defect}; }
      #scene-controls .lot-prior output { font-variant-numeric: tabular-nums; min-width: 3ch; }
    </style>
    <defs>
      <path id="lot-defect" d="M 0,-1.24 1.18,0 0,1.24 -1.18,0 Z"></path>
      <circle id="lot-sound" r="1"></circle>
    </defs>`;

  const heading = svgNode('text', { x: 30, y: 31, class: 'lot-text' });
  const points = svgNode('g', { 'aria-hidden': true });
  const defectKey = svgNode('use', { href: '#lot-defect', transform: 'translate(40,374) scale(6)', fill: colors.defect });
  const soundKey = svgNode('use', { href: '#lot-sound', transform: 'translate(324,374) scale(6)', fill: colors.sound });
  const defectCount = svgNode('text', { x: 55, y: 381, class: 'lot-text lot-key', fill: colors.defect });
  const soundCount = svgNode('text', { x: 339, y: 381, class: 'lot-text lot-key', fill: colors.sound });
  svg.append(heading, points, defectKey, defectCount, soundKey, soundCount);
  const marks = Array.from({ length: batchSize }, () => svgNode('use', { class: 'lot-mark' }));
  points.append(...marks);

  readout.innerHTML = `
    <p class="lot-rate-name"></p>
    <p class="lot-rate"><span class="lot-numerator"></span> / <span class="lot-denominator"></span> <span class="lot-relation"></span> <strong class="lot-percentage"></strong></p>`;
  const rateName = readout.querySelector('.lot-rate-name');
  const numerator = readout.querySelector('.lot-numerator');
  const denominator = readout.querySelector('.lot-denominator');
  const relation = readout.querySelector('.lot-relation');
  const result = readout.querySelector('.lot-percentage');
  controls.innerHTML = `
    <div class="lot-prior">
      <label for="lot-base-rate">Defect rate</label>
      <input id="lot-base-rate" type="range" min="5" max="50" step="5" value="20">
      <output for="lot-base-rate"></output>
    </div>`;
  const prior = controls.querySelector('input');
  const priorOutput = controls.querySelector('output');
  const priorLabel = controls.querySelector('label');

  function draw(animate = false, labelsOnly = false) {
    const defects = batchSize * Number(prior.value) / 100;
    const flaggedDefects = defects * 4 / 5;
    const flaggedSound = (batchSize - defects) / 10;
    const flags = flaggedDefects + flaggedSound;
    const inspecting = step >= 1;
    const flaggedOnly = step >= 2;
    const rows = flaggedOnly ? Math.round(Math.sqrt(flags * 0.54)) : fullRows;
    const columns = flaggedOnly ? Math.ceil(flags / rows) : batchSize / fullRows;
    const size = Math.min(580 / columns, 290 / rows) * 0.3;
    let selectedIndex = 0;
    if (!labelsOnly) points.classList.toggle('lot-easing', animate);
    if (!labelsOnly) marks.forEach((mark, i) => {
      const defective = i < defects;
      // Whole cycles of five defective parts and ten sound parts give exact counts at every slider stop.
      const flagged = defective ? i % 5 < 4 : (i - defects) % 10 === 0;
      const show = !flaggedOnly || flagged;
      mark.setAttribute('href', defective ? '#lot-defect' : '#lot-sound');
      const bright = !inspecting || flagged;
      mark.setAttribute('fill', defective ? (bright ? colors.defect : colors.dimDefect) : (bright ? colors.sound : colors.dimSound));
      mark.style.opacity = show ? '1' : '0';
      if (show) mark.style.transform = position(selectedIndex++, rows, columns, size);
    });

    // The chart key counts the bright marks. The label on the fraction states its denominator.
    const shownDefects = inspecting ? flaggedDefects : defects;
    const shownSound = inspecting ? flaggedSound : batchSize - defects;
    const total = shownDefects + shownSound;
    const ratio = percentage.format(100 * shownDefects / total) + '%';
    const quantity = number.format(flaggedOnly ? flags : batchSize);
    heading.textContent = bilingual
      ? (flaggedOnly ? `${quantity} 个被标记的零件` : `整批 ${quantity} 个零件`)
      : (flaggedOnly ? `${quantity} flagged parts` : `Batch of ${quantity} parts`);
    if (bilingual) {
      defectCount.textContent = `${shownDefects} 个${inspecting ? '被标记的次品' : '次品'}`;
      soundCount.textContent = `${shownSound} 个${inspecting ? '被误标的合格品' : '合格品'}`;
    } else {
      defectCount.textContent = `${shownDefects} ${inspecting ? 'flagged defects' : 'defective'}`;
      soundCount.textContent = `${shownSound} ${inspecting ? 'false alarms' : 'sound'}`;
    }
    rateName.textContent = bilingual
      ? (inspecting ? '被标记的零件中，次品占比' : '整批零件中，次品占比')
      : (inspecting ? 'Defects among flagged parts' : 'Defects in the batch');
    numerator.textContent = String(shownDefects);
    denominator.textContent = number.format(total);
    relation.textContent = (1000 * shownDefects) % total === 0 ? '=' : '≈';
    result.textContent = ratio;
    priorOutput.textContent = prior.value + '%';
    prior.setAttribute('aria-valuetext', priorOutput.textContent);
  }

  function setLanguage(dual) {
    bilingual = dual;
    for (const element of [heading, defectCount, soundCount, priorLabel, rateName]) {
      element.setAttribute('lang', bilingual ? 'zh-Hans' : 'en');
    }
    priorLabel.textContent = bilingual ? '次品率' : 'Defect rate';
  }

  function settle() {
    points.classList.remove('lot-easing');
    endMotion?.();
  }

  prior.addEventListener('input', () => { settle(); draw(); });
  return {
    enter(next, { animate }) {
      step = next;
      prior.value = next === 3 ? '5' : '20';
      setLanguage(getState().bilingual);
      draw(animate);
      if (animate) {
        return new Promise(resolve => {
          const timer = setTimeout(settle, 530);
          endMotion = () => { clearTimeout(timer); endMotion = null; resolve(); };
        });
      }
    },
    languageChanged(dual) {
      setLanguage(dual);
      draw(false, true);
    },
    settle
  };
}
