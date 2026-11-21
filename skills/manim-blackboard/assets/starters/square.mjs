export const title = 'How does a square grow?';
export const language = 'en';
export const stops = [
  { primary: 'Choose a side length and count the unit squares.' },
  { primary: 'Double the side. How many copies of the original square fit?' },
];

export function createScene({ svg, controls, readout }) {
  svg.setAttribute('viewBox', '0 0 220 220');
  svg.innerHTML = `<defs><pattern id="units" patternUnits="userSpaceOnUse" x="10" y="10" width="50" height="50"><rect width="50" height="50" fill="#214c48" stroke="#89daca" stroke-width="2"/></pattern></defs><rect id="square" x="10" y="10" fill="url(#units)" stroke="#89daca" stroke-width="2"/>`;
  const square = svg.querySelector('#square');
  const label = document.createElement('label');
  label.textContent = 'Side length ';
  const side = document.createElement('input');
  Object.assign(side, { type: 'range', min: '1', max: '4', step: '1' });
  label.append(side);
  controls.append(label);
  function draw() {
    const a = side.valueAsNumber;
    square.setAttribute('width', 50 * a);
    square.setAttribute('height', 50 * a);
    readout.textContent = `A = ${a} × ${a} = ${a * a}`;
  }
  side.addEventListener('input', draw);
  return { enter(step) { side.value = step === 0 ? '2' : '4'; draw(); } };
}
