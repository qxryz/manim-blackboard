export const title = 'From the unit circle to sine';
export const language = 'en';
export const secondaryLanguage = 'zh-Hans';

export const stops = [
  {
    primary: 'Drag the point around the circle. The sine curve records its height. Select the angle value to switch units.',
    secondary: '沿着单位圆拖动圆点，正弦曲线记录它的高度。点角度数值可切换单位。',
  },
  {
    primary: 'Compare the top of the circle with nearby points. One quarter turn gives the greatest height, 1.',
    secondary: '比较圆的顶点和旁边的点。转过四分之一圈时，高度达到最大值 1。',
  },
  {
    primary: 'Where does the height cross zero? At half a turn the point passes through the horizontal axis.',
    secondary: '高度在哪里过零？转到半圈时，圆点经过水平轴，高度和正弦值都等于零。',
  },
  {
    primary: 'Below the axis, height is negative. At three quarters of a turn, the curve reaches −1.',
    secondary: '到了水平轴下方，高度变成负数。转过四分之三圈，曲线达到最低值 −1。',
  },
  {
    primary: 'One full turn returns the point to its position at 0°. Every further turn repeats this wave.',
    secondary: '转满一圈，圆点回到 0° 时的位置。以后每多转一圈，这段波形就重复一次。',
  },
];

const stopAngles = [30, 90, 180, 270, 360];
const centerX = 129, centerY = 145, radius = 91;
const graphStart = 284, graphWidth = 316;
const radians = degrees => degrees * Math.PI / 180;
const heightAt = degrees => Math.sin(radians(degrees));
const graphX = degrees => graphStart + degrees / 360 * graphWidth;
const screenY = height => centerY - radius * height;

function onCircle(degrees, distance = radius) {
  return [centerX + distance * Math.cos(radians(degrees)), centerY - distance * heightAt(degrees)];
}

function waveThrough(degrees) {
  const points = [];
  for (let angle = 0; angle < degrees; angle += 2) {
    points.push(`${graphX(angle).toFixed(2)},${screenY(heightAt(angle)).toFixed(2)}`);
  }
  points.push(`${graphX(degrees).toFixed(2)},${screenY(heightAt(degrees)).toFixed(2)}`);
  return `M${points.join(' L')}`;
}

function angleArc(degrees) {
  const start = onCircle(0, 20).join(' ');
  const middle = onCircle(degrees / 2, 20).join(' ');
  const end = onCircle(degrees, 20).join(' ');
  return `M ${start} A 20 20 0 0 0 ${middle} A 20 20 0 0 0 ${end}`;
}

function formatRadians(degrees) {
  if (degrees === 0) return '0';
  // Use an exact multiple of π for familiar angles and a decimal elsewhere.
  for (const denominator of [1, 2, 3, 4, 6, 8, 12]) {
    const numerator = degrees * denominator / 180;
    if (Number.isInteger(numerator)) {
      const pi = numerator === 1 ? 'π' : `${numerator}π`;
      return denominator === 1 ? pi : `${pi}/${denominator}`;
    }
  }
  return `${Number(radians(degrees).toFixed(3))} rad`;
}

export function createScene({ svg, readout }) {
  svg.setAttribute('viewBox', '0 0 640 296');
  svg.setAttribute('aria-label', 'A point on a unit circle and a sine curve share the same height.');
  svg.innerHTML = `
    <style>
      .uc-axis { fill: none; stroke: #6a7371; stroke-width: 1.35; }
      .uc-label { fill: #c5cbc6; font-family: var(--bb-font, Georgia, serif); font-size: 19px; text-anchor: middle; }
      .uc-value { paint-order: stroke; stroke: #000; stroke-width: 5px; stroke-linejoin: round; }
      .uc-hit { cursor: grab; touch-action: none; outline: none; }
      .uc-hit:active { cursor: grabbing; }
      .uc-hit:focus-visible { stroke: #eaece5; stroke-width: 1.6px; stroke-dasharray: 4 5; }
      @media (max-width: 560px) { .uc-label { font-size: 22px; } }
    </style>
    <g aria-hidden="true">
      <g class="uc-axis">
        <path d="M 22 145 H 240 M 129 38 V 252 M 278 145 H 615 M 284 39 V 249"/>
        <path d="M 280 54 h 8 M 280 236 h 8"/>
      </g>
      <g fill="none">
        <circle cx="129" cy="145" r="91" stroke="#b3b9b4" stroke-width="2.2"/>
        <path d="${waveThrough(360)}" stroke="#4b5956" stroke-width="2.3"/>
        <path data-wave stroke="#86ddca" stroke-width="3.5" stroke-linecap="round"/>
        <path data-triangle fill="#86ddca" fill-opacity=".09"/>
        <line data-guide stroke="#86ddca" stroke-width="1.65" stroke-dasharray="3 6" opacity=".75"/>
        <line data-height stroke="#86ddca" stroke-width="3.3" stroke-linecap="round"/>
        <line data-radius x1="129" y1="145" stroke="#eeece2" stroke-width="2.3" stroke-linecap="round"/>
        <path data-arc stroke="#c7c5b7" stroke-width="1.4"/>
      </g>
      <circle cx="129" cy="145" r="2.8" fill="#e9e9df"/>
      <g class="uc-label">
        <text x="129" y="26" font-style="italic">y</text>
        <text class="uc-value" x="265" y="60">1</text>
        <text class="uc-value" x="261" y="242">−1</text>
        <g data-ticks></g>
      </g>
      <circle data-point r="7.3" stroke="#86ddca" stroke-width="3.3" fill="#000"/>
      <circle data-graph-point r="5.8" fill="#86ddca" stroke="#000" stroke-width="2.0"/>
    </g>
    <circle class="uc-hit" data-wheel data-interact cx="129" cy="145" r="112" fill="transparent" tabindex="0" role="slider"
      aria-label="Angle on the unit circle" aria-valuemin="0" aria-valuemax="360"/>
    <rect class="uc-hit" data-graph data-interact x="284" y="43" width="316" height="207" fill="transparent" aria-hidden="true"/>`;
  const q = name => svg.querySelector(`[data-${name}]`);
  const wheel = q('wheel'), graph = q('graph');
  const line = q('radius'), point = q('point'), graphPoint = q('graph-point');
  const triangle = q('triangle');
  const height = q('height'), guide = q('guide'), wave = q('wave'), arc = q('arc');
  const ticks = q('ticks');
  for (const angle of [0, 90, 180, 270, 360]) {
    const x = graphX(angle);
    ticks.insertAdjacentHTML('beforeend', `<path d="M ${x} 141 v 8" class="uc-axis"/><text x="${x}" y="275"></text>`);
  }
  readout.innerHTML = `
    <div class="uc-equations" style="line-height:1.32;font-variant-numeric:tabular-nums;white-space:nowrap">
      <style>
        .uc-angle { color:inherit; font:inherit; font-style:inherit; background:transparent; padding:0; border:0; cursor:pointer; }
        .uc-angle [data-angle-output] { text-decoration: underline dotted #778883 .045em; text-underline-offset:.18em; }
        .uc-angle:focus-visible { outline:2px solid #86ddca; outline-offset:2px; }
      </style>
      <div><button type="button" class="uc-angle"><i>θ</i> <span data-angle-equals>=</span> <span data-angle-output></span></button></div>
      <div><i>y</i> = sin <i>θ</i> <span data-sine-equals>=</span> <span data-sine-output style="color:#86ddca"></span></div>
    </div>`;
  const angleEquals = readout.querySelector('[data-angle-equals]');
  const sineEquals = readout.querySelector('[data-sine-equals]');
  const angleOutput = readout.querySelector('[data-angle-output]');
  const sineOutput = readout.querySelector('[data-sine-output]');
  const unitButton = readout.querySelector('.uc-angle');
  const tickLabels = [...ticks.querySelectorAll('text')];
  let degrees = 30, unit = 'degrees', motion = null;
  let drag = null, dual = false;
  const formatAngle = value => unit === 'degrees' ? `${value}°` : formatRadians(value);

  function render(angle) {
    degrees = Math.round(Math.min(360, Math.max(0, angle)));
    const theta = degrees;
    const sine = heightAt(degrees);
    const [cx, cy] = onCircle(degrees);
    const gx = graphX(degrees);
    triangle.setAttribute('d', `M ${centerX} ${centerY} H ${cx} V ${cy} Z`);
    line.setAttribute('x2', cx); line.setAttribute('y2', cy);
    height.setAttribute('x1', cx); height.setAttribute('x2', cx);
    height.setAttribute('y1', centerY); height.setAttribute('y2', cy);
    guide.setAttribute('x1', cx); guide.setAttribute('x2', gx);
    guide.setAttribute('y1', cy); guide.setAttribute('y2', cy);
    point.setAttribute('cx', cx); point.setAttribute('cy', cy);
    graphPoint.setAttribute('cx', gx); graphPoint.setAttribute('cy', cy);
    wave.setAttribute('d', waveThrough(degrees));
    arc.setAttribute('d', angleArc(degrees));
    const angleText = formatAngle(theta);
    angleEquals.textContent = angleText.endsWith(' rad') ? '≈' : '=';
    angleOutput.textContent = angleText;
    const exactHalf = Math.abs(2 * sine - Math.round(2 * sine)) < 1e-10;
    sineEquals.textContent = exactHalf ? '=' : '≈';
    sineOutput.textContent = String(Number(sine.toFixed(3))).replace('-', '−');

    wheel.setAttribute('aria-valuenow', theta);
    const spoken = unit === 'degrees' ? theta + (dual ? ' 度' : ' degrees')
      : Number(radians(degrees).toFixed(3)) + (dual ? ' 弧度' : ' radians');
    wheel.setAttribute('aria-valuetext', spoken);
    const switchTo = unit === 'degrees'
      ? (dual ? '切换为弧度' : 'Switch to radians')
      : (dual ? '切换为角度' : 'Switch to degrees');
    unitButton.title = switchTo;
    unitButton.setAttribute('aria-label', spoken + (dual ? '。' : '. ') + switchTo);
  }

  function stopTween() {
    if (!motion) return;
    cancelAnimationFrame(motion.raf);
    motion.resolve();
    motion = null;
  }

  function updateScale() {
    tickLabels.forEach((label, i) => { label.textContent = formatAngle(i * 90); });
    render(degrees);
  }
  unitButton.addEventListener('click', () => {
    unit = unit === 'degrees' ? 'radians' : 'degrees';
    updateScale();
  });
  wheel.addEventListener('keydown', event => {
    const nudge = event.shiftKey ? 15 : 1;
    const angles = { ArrowRight: degrees + nudge, ArrowUp: degrees + nudge,
      ArrowLeft: degrees - nudge, ArrowDown: degrees - nudge, Home: 0, End: 360 };
    if (!Object.hasOwn(angles, event.key)) return;
    event.preventDefault(); event.stopPropagation();
    stopTween(); render(Math.round(angles[event.key]));
  });

  function dragTo(event, target) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    if (target === graph) {
      render(Math.round((p.x - graphStart) / graphWidth * 360));
      return;
    }
    const dx = p.x - centerX, dy = centerY - p.y;
    if (Math.hypot(dx, dy) < 7) return;
    let value = Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360);
    if (value === 0 && degrees > 180) value = 360;
    render(value);
  }
  for (const target of [wheel, graph]) {
    target.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      stopTween(); drag = event.pointerId; target.setPointerCapture(drag); dragTo(event, target);
    });
    target.addEventListener('pointermove', event => { if (drag === event.pointerId) dragTo(event, target); });
    const end = event => { if (drag === event.pointerId) drag = null; };
    target.addEventListener('pointercancel', end);
    target.addEventListener('lostpointercapture', end);
    target.addEventListener('pointerup', end);
  }

  updateScale();
  return {
    enter(index, { animate, reason }) {
      stopTween();
      const target = stopAngles[index];
      if (animate && reason === 'replay') render(index ? stopAngles[index - 1] : 0);
      if (!animate || degrees === target) { render(target); return; }
      const start = degrees;
      return new Promise(resolve => {
        const began = performance.now();
        motion = { target, resolve, raf: 0 };
        function tick(now) {
          const t = Math.min(1, (now - began) / 850);
          render(start + (target - start) * t * t * (3 - 2 * t));
          if (t === 1) stopTween();
          else motion.raf = requestAnimationFrame(tick);
        }
        motion.raf = requestAnimationFrame(tick);
      });
    },
    settle() { if (motion) { render(motion.target); stopTween(); } },
    languageChanged(bilingual) {
      dual = bilingual;
      wheel.setAttribute('aria-label', dual ? '单位圆上的角度' : 'Angle on the unit circle');
      render(degrees);
    },
  };
}
