import sample from './qkv-pen.json';

const clamp = (t) => Math.max(0, Math.min(1, t));

// Affine image of the dot's trajectory in the authored Manim MoveAlongPath.
export function carryPoint(progress, source, target, lift = 24) {
  const frame = clamp(progress) * (sample.arc.length - 1);
  const i = Math.floor(frame),
    mix = frame - i;
  const left = sample.arc[i],
    right = sample.arc[Math.min(i + 1, sample.arc.length - 1)];
  const u = left[0] + mix * (right[0] - left[0]);
  const v = left[1] + mix * (right[1] - left[1]);
  return [source[0] + (target[0] - source[0]) * u, source[1] + (target[1] - source[1]) * u - lift * v];
}

export function penOutline(t) {
  return sample.outline[Math.round(clamp(t) * (sample.outline.length - 1))];
}

// The visible row/mark is the control. If it is redrawn during a keyboard
// selection, return focus to that mark in the new diagram.
export function diagramChoices(host, selector, active, choose, describe) {
  host.setAttribute('role', 'group');
  function bind(item) {
    const id = item.dataset.choice;
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', describe(id));
    item.setAttribute('aria-pressed', String(id === active));
    item.setAttribute('data-interact', '');
    item.style.cursor = 'pointer';
    function select(event) {
      event.stopPropagation();
      const keyboard = event.type === 'keydown';
      if (keyboard) event.preventDefault();
      choose(id);
      if (keyboard)
        [...host.querySelectorAll(selector)]
          .find((node) => node.dataset.choice === id)
          ?.focus({ preventScroll: true });
    }
    item.addEventListener('click', select);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') select(event);
    });
  }
  host.querySelectorAll(selector).forEach(bind);
}
