import { defineDeck } from 'blackboard-deck';

export const title = 'Multiplication as a stretch';
export const language = 'en';

function mountLine({ svg, readout }, values, formula) {
  svg.setAttribute('viewBox', '0 0 600 200');
  const ticks = [0, 2, 4, 6].map(value => {
    const x = 60 + value * 80;
    return `<path d="M${x} 110v12"/><text x="${x}" y="153">${value}</text>`;
  }).join('');
  svg.innerHTML = `<g stroke="#768189" fill="#f7f5ef" text-anchor="middle" font-size="22">
    <path d="M60 116h480"/>${ticks}</g><line x1="60" y1="116" y2="116" stroke-width="5" stroke="#83d8c9"/>
    <circle cy="116" r="7" fill="#83d8c9"/>`;
  const line = svg.querySelector('line');
  const tip = svg.querySelector('circle');
  let animations = [];
  function settle() { animations.forEach(animation => animation.cancel()); }
  return {
    enter(step, { animate }) {
      settle();
      const length = values[step] * 80;
      line.setAttribute('x2', 60 + length);
      tip.setAttribute('cx', 60 + length);
      readout.textContent = formula[step];
      if (!animate || step === 0) return;
      const before = values[step - 1] * 80;
      const timing = { duration: 750, easing: 'ease-in-out' };
      line.style.transformOrigin = '60px 116px';
      animations = [
        line.animate([{ scale: `${before / length} 1` }, { scale: '1 1' }], timing),
        tip.animate([{ translate: `${before - length}px 0` }, { translate: '0 0' }], timing),
      ];
      return Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    },
    settle,
  };
}

const stretch = {
  id: 'stretch', chapter: 'Multiplication', title: 'Stretch a length',
  steps: [
    { primary: 'Start with a length of two units.' },
    { primary: 'Multiply by three. The endpoint moves to six.' },
  ],
  mount: context => mountLine(context, [2, 6], ['x = 2', '3 × 2 = 6']),
};

const undo = {
  id: 'undo', chapter: 'Division', title: 'Recover the original length',
  steps: [
    { primary: 'Keep the stretched length of six on the same scale.' },
    { primary: 'Divide by three to recover the two-unit length.' },
  ],
  mount: context => mountLine(context, [6, 2], ['y = 6', '6 ÷ 3 = 2']),
};

export const { stops, createScene } = defineDeck([stretch, undo]);
