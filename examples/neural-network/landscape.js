import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMotion, ease } from './motion.js';

const range = { x0: .5, x1: 1.3, z0: 0, z1: .6 };
const learningRates = [0, 0, .025, .05];
const amber = 0xffbf72;
const mint = 0x83dcc8;
const ns = 'http://www.w3.org/2000/svg';

function loss(x, z) {
  const prediction = 2 * Math.max(0, x + 2 * z - 1);
  return (prediction - 1) ** 2 / 2;
}
function world(w1, w2, height) {
  return new THREE.Vector3((w1 - .9) * 4, height * .88, (w2 - .3) * 4);
}
function descent(eta, lift = 0) {
  const w1 = 1 - 2 * eta, w2 = .5 - 4 * eta;
  return world(w1, w2, loss(w1, w2) + lift);
}
function decimal(x) { return String(Number(x.toFixed(3))); }

function makeModel(renderer, canvas, overlay) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 60);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enablePan = false;
  orbit.minDistance = 3.7;
  orbit.maxDistance = 12;
  orbit.minPolarAngle = .14;
  orbit.maxPolarAngle = Math.PI * .48;
  let shortSide = false;
  const homeDirection = new THREE.Vector3(3.4, 4.5, -5.2).normalize();
  function home() {
    orbit.target.set(0, .53, 0);
    camera.position.copy(orbit.target).addScaledVector(homeDirection, shortSide ? 8.3 : 7.5);
    orbit.update();
  }

  function line(points, color, offset = 0) {
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const item = new THREE.Line(geom, new THREE.LineBasicMaterial({ color }));
    item.position.y = offset;
    scene.add(item);
    return item;
  }
  function sampled(f, count = 70) {
    return Array.from({ length: count + 1 }, (_, n) => f(n / count));
  }
  const xyz = [], rgb = [], indices = [];
  const low = new THREE.Color(0x0a2526), high = new THREE.Color(0x46756b), flat = new THREE.Color(0x243336);
  const color = new THREE.Color();
  // The diagonal of each cell follows constant w1 + 2w2. This preserves the ReLU crease.
  const nx = 40, nz = 60;
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      const x = range.x0 + (range.x1 - range.x0) * i / nx;
      const z = range.z0 + (range.z1 - range.z0) * j / nz;
      const h = loss(x, z);
      xyz.push(...world(x, z, h).toArray());
      color.copy(low).lerp(high, Math.min(1, h / 1.4)).lerp(flat, x + 2 * z <= 1 ? .85 : 0);
      rgb.push(color.r, color.g, color.b);
      if (i < nx && j < nz) {
        const a = i * (nz + 1) + j, b = a + (nz + 1), c = a + 1, d = b + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  }
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
  surface.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
  surface.setIndex(indices);
  scene.add(new THREE.Mesh(surface, new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1 })));
  for (let i = 0; i <= 10; i++) {
    const x = range.x0 + (range.x1 - range.x0) * i / 10;
    line(sampled(t => { const z = range.z0 + (range.z1 - range.z0) * t; return world(x, z, loss(x, z)); }), 0x4c7772, .001);
  }
  for (let i = 0; i <= 10; i++) {
    const z = range.z0 + (range.z1 - range.z0) * i / 10;
    line(sampled(t => { const x = range.x0 + (range.x1 - range.x0) * t; return world(x, z, loss(x, z)); }), 0x4c7772, .001);
  }
  // Draw the zero contour outward from the point the descent actually reaches.
  const valley = [[.5,.5],[1.3,.1]].map(([x,z]) => line(sampled(t => world(.9+(x-.9)*t,.3+(z-.3)*t,0)),mint,.013));
  const path = line(sampled(t => descent(.125*t,.012),120),amber);
  const heightProbe = line(sampled(t => world(1,.5,.5*t),60),0xb89164);
  heightProbe.material.depthTest = false;
  heightProbe.material.transparent = true;
  heightProbe.material.opacity = .72;
  heightProbe.material.depthWrite = false;
  heightProbe.renderOrder = 2;
  function reveal(stroke, progress) {
    const count = stroke.geometry.attributes.position.count;
    stroke.geometry.setDrawRange(0, 1 + Math.round((count-1)*progress));
  }
  const point = new THREE.Mesh(new THREE.SphereGeometry(.064, 20, 14), new THREE.MeshBasicMaterial({ color: amber }));
  scene.add(point);
  // A marker must remain identifiable even when the viewer has orbited behind the sheet.
  const halo = new THREE.Mesh(new THREE.SphereGeometry(.08, 20, 14), new THREE.MeshBasicMaterial({ color: amber, transparent:true, opacity:.19, depthTest:false, depthWrite:false }));
  halo.renderOrder = 4;
  scene.add(halo);

  const origin = world(.5,0,-.12);
  const ends = [world(1.36,0,-.12), world(.5,.65,-.12), world(.5,0,2.15)];
  ends.forEach(end => line([origin, end], 0xb7bcb1));
  const labels = [];
  function label(text, position, dx, dy, axis = false) {
    const node = document.createElementNS(ns,'text');
    node.textContent = text;
    node.setAttribute('fill',axis ? '#efece0' : '#afb9b1');
    node.setAttribute('font-size',axis ? '20' : '15');
    node.setAttribute('text-anchor','middle');
    node.setAttribute('paint-order','stroke');
    node.setAttribute('stroke','#000'); node.setAttribute('stroke-width','2.5');
    overlay.append(node);
    labels.push({node, position, dx, dy});
  }
  label('w₁', ends[0], -13, -3, true); label('w₂', ends[1], -12, -4, true); label('L', ends[2], 0, -8, true);
  [1,2].forEach(h => {
    const p = world(.5,0,h); line([p, p.clone().add(new THREE.Vector3(0,0,-.06))],0xb7bcb1); label(String(h),p,13,4);
  });
  const projected = new THREE.Vector3();
  let width = 0, height = 0;
  function draw() {
    if (!width || !height) return;
    renderer.render(scene,camera);
    for (const {node, position, dx, dy} of labels) {
      projected.copy(position).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      node.style.visibility = x < -8 || y < -8 || x > width + 8 || y > height + 8 ? 'hidden' : 'visible';
      node.setAttribute('x', THREE.MathUtils.clamp(x + dx, 14, width - 14));
      node.setAttribute('y', THREE.MathUtils.clamp(y + dy, 17, height - 5));
    }
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width; height = rect.height;
    const compact = width/height < 1.13;
    if (compact !== shortSide) {camera.position.sub(orbit.target).multiplyScalar(compact ? 8.3/7.5 : 7.5/8.3).add(orbit.target);shortSide = compact;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
    renderer.setSize(width,height,false);
    overlay.setAttribute('viewBox',`0 0 ${width} ${height}`);
    camera.aspect = width/height; camera.updateProjectionMatrix(); draw();
  }
  function keydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const offset = camera.position.clone().sub(orbit.target);
    const polar = new THREE.Spherical().setFromVector3(offset);
    switch (event.key) {
      case 'ArrowLeft': polar.theta -= .16; break;
      case 'ArrowRight': polar.theta += .16; break;
      case 'ArrowUp': polar.phi = Math.max(orbit.minPolarAngle, polar.phi-.12); break;
      case 'ArrowDown': polar.phi = Math.min(orbit.maxPolarAngle, polar.phi+.12); break;
      case '+': case '=': polar.radius = Math.max(orbit.minDistance,polar.radius/1.14); break;
      case '-': polar.radius = Math.min(orbit.maxDistance,polar.radius*1.14); break;
      case 'Home': event.preventDefault(); home(); return;
      default: return;
    }
    event.preventDefault();
    camera.position.setFromSpherical(polar).add(orbit.target); orbit.update();
  }
  orbit.addEventListener('change', draw);
  canvas.addEventListener('keydown',keydown);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  home(); resize();
  return {
    update(eta, heightShare, pathShare, valleyShare) {
      point.position.copy(descent(eta,.027)); halo.position.copy(point.position);
      reveal(heightProbe,heightShare);
      reveal(path,pathShare);
      for (const side of valley) reveal(side,valleyShare);
      draw();
    },
    dispose() {
      observer.disconnect(); canvas.removeEventListener('keydown',keydown);
      orbit.removeEventListener('change',draw); orbit.dispose();
      scene.traverse(obj => {obj.geometry?.dispose();obj.material?.dispose();});
      renderer.dispose(); renderer.forceContextLoss();
    }
  };
}

function fallback(svg) {
  // The same parameterized path, shown in profile if WebGL is unavailable.
  const x=t=>56+t/.125*526, y=h=>256-h*310;
  svg.setAttribute('viewBox','0 0 640 330');
  const d=Array.from({length:101},(_,i)=>{const t=.125*i/100;return `${i?'L':'M'}${x(t)} ${y(loss(1-2*t,.5-4*t))}`;}).join(' ');
  svg.innerHTML=`<g stroke="#778782" fill="none"><path d="M56 55V256H610"/><path d="M51 101h10 M267 251v10"/></g><g fill="#d2d5c9" font-size="22"><text x="33" y="54">L</text><text x="4" y="108">0.5</text><text x="247" y="291">0.05</text><text x="592" y="283">η</text></g><path d="${d}" fill="none" stroke="#557672" stroke-width="2"/><line x1="56" x2="56" y1="256" stroke="#b89164" stroke-width="3"/><path class="loss-trace" d="${d}" fill="none" stroke="#ffbf72" stroke-width="3" pathLength="1" stroke-dasharray="1 1"/><circle class="loss-minimum" cx="${x(.05)}" cy="${y(0)}" fill="none" stroke="#83dcc8" stroke-width="2"/><circle class="loss-point" r="7" fill="#ffbf72"/>`;
  const dot=svg.querySelector('.loss-point'), probe=svg.querySelector('line');
  const trace=svg.querySelector('.loss-trace'), minimum=svg.querySelector('.loss-minimum');
  return {
    update(t, heightShare, pathShare, valleyShare) {
      probe.setAttribute('y2',y(.5 * heightShare));
      trace.setAttribute('stroke-dashoffset',1 - pathShare);
      minimum.setAttribute('r',11 * valleyShare);
      dot.setAttribute('cx',x(t));
      dot.setAttribute('cy',y(loss(1-2*t,.5-4*t)));
    },
    dispose(){}
  };
}

export const landscapeSlide = {
  id:'loss-landscape', chapter:'Backward pass', chapterZh:'反向传播', title:'A step on the loss surface',titleZh:'损失曲面上的一步',
  steps:[
    {primary:'Freeze b, v and c. At weights (1, 0.5), read the height of the amber point. Its loss is 0.5.',secondary:'固定 b、v 和 c。权重取 (1, 0.5) 时，看琥珀色点的高度，损失为 0.5。'},
    {primary:'The gradient here is (2, 4). Follow its opposite direction. The amber curve shows where each possible step lands.',secondary:'起点的梯度是 (2, 4)。沿反方向走，不同步长的落点连成这条琥珀色曲线。'},
    {primary:'With η = 0.025, changing just these two weights gives a loss of 0.125. Drag the step length to test another point.',secondary:'取 η = 0.025，只更新这两个权重，损失变为 0.125。拖动步长，看看其他落点。'},
    {primary:'At η = 0.05 we reach the floor. Loss is zero wherever w₁ + 2w₂ = 1.5. A longer step can climb the other side.',secondary:'取 η = 0.05 就能到达谷底。只要 w₁ + 2w₂ = 1.5，损失都为零。步子再大，就可能爬上另一侧。'}
  ],
  mount({svg,plotHost,readout,controls}) {
    const frame = document.createElement('div');
    frame.className = 'loss-viewport';
    frame.innerHTML=`<style>
      .loss-viewport{position:relative;width:100%;height:min(61dvh,42vw);min-height:130px;}
      .loss-viewport canvas,.loss-viewport svg{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .loss-viewport canvas{touch-action:none;cursor:grab;}.loss-viewport canvas:active{cursor:grabbing;}
      .loss-viewport svg{pointer-events:none;overflow:hidden;}
      .loss-details p{margin:.18em 0;}.loss-details .loss-result{color:#ffbf72;font-size:1.22em;}
      .loss-details .loss-fixed{color:#b7c2bb;font-size:.8em;}.loss-step{display:grid;grid-template-columns:auto minmax(38px,1fr) auto;gap:.5em;align-items:center;}.loss-step input{width:100%;min-width:0;}.loss-step output{width:6.8ch;text-align:end;font-variant-numeric:tabular-nums;}
      @media(max-aspect-ratio:1/1){.loss-viewport{height:min(40dvh,76vw);}}
      @media(orientation:portrait) and (max-height:650px){.loss-viewport{height:30dvh;}}
      @media(orientation:landscape) and (max-height:520px){.loss-viewport{height:64dvh;}}
    </style><canvas data-interact tabindex="0" role="img"></canvas><svg aria-hidden="true"></svg>`;
    plotHost.append(frame);
    const canvas=frame.querySelector('canvas');
    const overlay=frame.querySelector('svg');
    let renderer;
    try {renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});} catch { /* Use the profile view below. */ }
    let visual;
    if(renderer){svg.setAttribute('hidden','');visual=makeModel(renderer,canvas,overlay);}
    else {frame.hidden=true;visual=fallback(svg);}
    readout.innerHTML=`<div class="loss-details"><p class="loss-fixed">b = −1　v = 2　c = 0</p><p class="loss-law"></p><p class="loss-weights"></p><p class="loss-result"></p></div>`;
    controls.innerHTML=`<label class="loss-step"><span></span><input type="range" min="0" max="0.125" step="0.001" data-interact><output></output></label>`;
    const slider=controls.querySelector('input'), value=controls.querySelector('output');
    const law=readout.querySelector('.loss-law'), weights=readout.querySelector('.loss-weights'), result=readout.querySelector('.loss-result');
    const motion=createMotion();
    let eta=0, step=0;
    function paint(t, heightShare=1, pathShare=step>=1?1:0, valleyShare=step>=3?1:0) {
      eta=t; const w1=1-2*t,w2=.5-4*t;
      const exactWeights = [w1, w2].every(w => Math.abs(w - Number(decimal(w))) < 1e-9);
      law.textContent = step === 0 ? 'L = ½(2 ReLU(z) − 1)²' : 'w′ = (1 − 2η, 0.5 − 4η)';
      weights.textContent = step === 0 ? 'z = w₁ + 2w₂ − 1' : `w′ ${exactWeights ? '=' : '≈'} (${decimal(w1)}, ${decimal(w2)})`;
      result.textContent=`L ${Math.abs(loss(w1,w2)-Number(decimal(loss(w1,w2))))<1e-9?'=':'≈'} ${decimal(loss(w1,w2))}`;
      if (t === 0) result.dataset.bbAnchor = 'original-network-loss';
      else delete result.dataset.bbAnchor;
      slider.value=String(t);
      value.textContent=Math.abs(t-Number(decimal(t)))<1e-9?decimal(t):`≈ ${decimal(t)}`;
      visual.update(t,heightShare,pathShare,valleyShare);
    }
    function languageChanged(dual) {
      controls.querySelector('span').textContent=dual?'Step η · 步长':'Step η';
      canvas.setAttribute('aria-label',dual?'Loss surface. Drag or use arrow keys to orbit. Use + and − to zoom; Home resets the view. 损失曲面，拖动或用方向键旋转。':'Loss surface. Drag or use arrow keys to orbit. Use + and − to zoom; Home resets the view.');
      if(!renderer) svg.setAttribute('aria-label',dual?'Loss along the selected descent direction · 沿下降方向的损失':'Loss along the selected descent direction');
    }
    slider.addEventListener('input',()=>{
      const chosen=slider.valueAsNumber;
      motion.settle();
      paint(chosen);
    });
    return {
      enter(local,opts) {
        motion.settle();
        const target=learningRates[local];
        const previous=opts.reason==='replay' || eta===target ? learningRates[Math.max(0,local-1)] : eta;
        step=local;
        languageChanged(opts.bilingual);
        slider.disabled=step<2;
        controls.style.visibility=step<2?'hidden':'visible';
        return motion.play({animate:opts.animate,duration:[1150,1550,1450,1850][step]},t=>{
          if(step===0) {paint(0,ease(t),0,0);return;}
          if(step===1) {paint(0,1,ease(t),0);return;}
          const travel=ease(step===3?t/.74:t);
          const current=travel===1?target:previous+(target-previous)*travel;
          const valleyShare=step===3?ease((t-.72)/.28):0;
          paint(current,1,1,valleyShare);
        });
      },
      settle:motion.settle, languageChanged,
      dispose(){motion.settle();visual.dispose();frame.remove();svg.removeAttribute('hidden');}
    };
  }
};
