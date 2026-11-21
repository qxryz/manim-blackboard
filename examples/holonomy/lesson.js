/*! Adapted from HolonomyBlueprint in Math-To-Manim.
https://github.com/HarleyCoops/Math-To-Manim/blob/963353c269e9e8023309c3ba25c2167c7dba6fcf/examples/mathematics/geometry/blueprint_holonomy.py

MIT License

Copyright (c) 2025-2026 Christian H. Cooper

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import poses from './transport-samples.json';

export const title = 'Holonomy · Parallel transport';
export const language = 'en';
export const secondaryLanguage = 'zh-Hans';

export const stops = [
  ['The sphere has radius one. Its curvature is the same everywhere.', '这个球的半径为一，球面上各处的高斯曲率相同。'],
  ['Two meridians and the equator bound one eighth of the sphere.', '两条经线和赤道围出八分之一的球面。'],
  ['Leave a blue copy at A. Slide the north-pointing arrow without turning it in its tangent plane.', '在 A 点留下蓝色初始箭头。移动朝北的箭头时，保持它在切平面内不自行转动。'],
  ['Carry the arrow east along the equator. It still points north at B.', '沿赤道向东移动箭头。到达 B 点时，它依旧指向北方。'],
  ['Follow the meridian to N. The arrow stays tangent all the way to the pole.', '沿经线到达北极 N。箭头始终沿着经线的切向，到达北极时仍指向前方。'],
  ['Return to A on the other meridian. The arrow now points along the equator.', '沿另一条经线回到 A 点。现在箭头沿着赤道的切向。'],
  ['Compare the two arrows at A. Parallel transport has produced a quarter turn.', '比较 A 点的两支箭头。经过一周平行移动，方向相差四分之一圈。'],
  ['The octant encloses just enough curvature to give a turn of π/2.', '这个八分球面区域内的曲率积分恰好等于转角 π/2。'],
  ['Try the same transport rule around a square on flat paper.', '在平纸上沿正方形走一圈，仍按同样的规则平行移动箭头。'],
  ['Slide along two sides. At the corner the path turns, but the arrow keeps its bearing.', '沿两条边移动。路径在拐角处转弯，箭头仍指向原来的方向。'],
  ['Follow the last two sides. The returning arrow covers its blue starting copy.', '沿剩下两条边回到起点。返回的箭头与蓝色的初始箭头重合。'],
  ['Both paths close. The flat loop gives zero turn, and the spherical octant gives π/2.', '两条路径都已闭合。平面回路的转角为零，球面八分区回路的转角为 π/2。'],
].map(([primary, secondary], value) => ({primary, secondary, value}));

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const quarter = Math.PI / 2;
const palette = { amber: 0xffb65d, stamp: 0xa46933, ice: 0xa5e8fa, white: 0xe4f1f4, grid: 0x6498ac };

function layOutBoard(annotation) {
  const css = document.createElement('style');
  css.textContent = `
    #board { grid-template-rows: minmax(0,1fr) 17%; }
    #scene { grid-template: minmax(0,1fr) 3.8em / 1fr; padding: 1% 4% 0; width:100%; height:100%; }
    #visual { width:100%; height:100%; min-height:0; }
    #annotation { container-type:normal; display:grid; place-content:center; align-self:stretch; text-align:center;
      padding:0 .25rem; font-size:clamp(18px,2.2vw,34px); color:#e6ecee; font-variant-numeric:tabular-nums; }
    #annotation strong { font-weight:500; color:#ffc47a; }
    #annotation .hint { font-size:clamp(10px,.94vw,14px); color:#8daab2; margin-top:.24em; }
    #subtitles { max-width:58em; color:#ebeff0; }
    #secondary { color:#a5b6bd; }
    @media (orientation:portrait) {
      #stage { padding:0; align-content:center; }
      #board { height:min(100dvh,156vw); grid-template-rows: minmax(0,1fr) max(23%,7.7rem); }
      #scene { padding:0 2%; grid-template: minmax(0,1fr) 3.2rem / 1fr; }
      #annotation { font-size:clamp(17px,4.8vw,26px); }
    }
    @media (orientation:landscape) and (max-height:500px) {
      #board { grid-template-rows:minmax(0,1fr) 24%; }
      #scene { grid-template-rows:minmax(0,1fr) 2.2rem; }
      #annotation { font-size:16px; }
      #annotation .hint { display:none; }
    }
  `;
  document.head.append(css);
  const help = document.querySelector('#controls-help');
  help.append(' Use A and D to orbit horizontally, W and S to orbit vertically, and 0 to reset the view.');
  document.querySelector('#visual canvas').title = 'Drag to rotate · WASD to orbit · 0 to reset';
  annotation.setAttribute('aria-label', 'Geometry');
}

// Unit-vector spherical interpolation retains the exact great-circle tangent
// between two native Manim samples. On the plane the position is linear.
function sampleLeg(THREE, samples, tau, spherical) {
  const bounded = clamp(tau, 0, samples.length);
  const leg = Math.min(Math.floor(bounded), samples.length - 1);
  const frames = samples[leg], scaled = (bounded - leg) * (frames.length - 1);
  const index = Math.min(Math.floor(scaled), frames.length - 2);
  const frac = scaled - index;
  const interpolate = (slot) => {
    const a = new THREE.Vector3(...frames[index][slot]);
    const b = new THREE.Vector3(...frames[index + 1][slot]);
    if (!spherical) return a.lerp(b, frac);
    a.normalize(); b.normalize();
    const angle = Math.acos(clamp(a.dot(b), -1, 1));
    if (angle < 1e-7) return a;
    const den = Math.sin(angle);
    return a.multiplyScalar(Math.sin((1 - frac) * angle) / den)
      .addScaledVector(b, Math.sin(frac * angle) / den).normalize();
  };
  return {p: interpolate(0), v: interpolate(1)};
}

export function createScene({THREE, scene, camera, controls, annotation, invalidate}) {
  layOutBoard(annotation);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // Cyclic axis permutation keeps the original right-handed frame and puts north on screen.
  const toWorld = (v) => V(v.y, v.z, v.x);
  const spherePose = (t) => {
    const {p, v} = sampleLeg(THREE, poses.sphere, t, true);
    return {p: toWorld(p), v: toWorld(v)};
  };
  const flatPose = (t) => sampleLeg(THREE, poses.plane, t, false);
  const sphere = new THREE.Group(), plane = new THREE.Group();
  scene.add(sphere, plane);
  plane.rotation.x = -.92;
  const view = V(.36, .79, 2.65);
  camera.up.set(0, 1, 0);
  camera.position.copy(view);
  controls.target.set(0, 0, 0);
  controls.update();
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.target.closest('input,select,textarea,button,dialog')) return;
    const key = e.key.toLowerCase();
    if (!['a', 'd', 'w', 's', '0'].includes(key)) return;
    e.preventDefault();
    if (key === '0') {
      camera.position.copy(view);
      camera.zoom = 1; camera.updateProjectionMatrix();
    } else {
      const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if (key === 'a') s.theta -= .15;
      if (key === 'd') s.theta += .15;
      if (key === 'w') s.phi = Math.max(.08, s.phi - .15);
      if (key === 's') s.phi = Math.min(Math.PI - .08, s.phi + .15);
      camera.position.setFromSpherical(s).add(controls.target);
    }
    controls.update(); invalidate();
  });

  const fades = [];
  function mat(group, color, alpha, options = {}) {
    const m = new THREE.MeshBasicMaterial({color, transparent:true, opacity:alpha, depthWrite:false,
      side:THREE.DoubleSide, ...options});
    fades.push({group, material:m, alpha});
    return m;
  }
  function mesh(group, geom, material, order = 0) {
    const m = new THREE.Mesh(geom, material); m.renderOrder = order; group.add(m); return m;
  }
  function lines(group, coords, color, alpha, depthTest = true, order = 0) {
    const g = new THREE.BufferGeometry().setFromPoints(coords);
    const m = new THREE.LineBasicMaterial({color, transparent:true, opacity:alpha, depthTest, depthWrite:false});
    fades.push({group, material:m, alpha});
    const item = new THREE.LineSegments(g, m); item.renderOrder=order; group.add(item); return item;
  }
  function segments(fn, n) {
    const points = [];
    for (let i=0; i<n; i++) points.push(fn(i/n), fn((i+1)/n));
    return points;
  }
  function tube(group, fn, color, alpha, radius, count = 64, order = 3) {
    class Stroke extends THREE.Curve { getPoint(t) { return fn(t); } }
    const geometry = new THREE.TubeGeometry(new Stroke(), count, radius, 6, false);
    return mesh(group, geometry, mat(group,color,alpha), order);
  }
  function reveal(item, part) {
    const n = item.geometry.index?.count ?? item.geometry.attributes.position.count;
    const stride = item.isMesh ? 6 * 6 : 2;
    item.geometry.setDrawRange(0, Math.max(0,Math.round(clamp(part)*n/stride)*stride));
    item.visible = part > 0;
  }
  function marker(group, point) {
    const dot = mesh(group,new THREE.SphereGeometry(.018,12,8),mat(group,palette.white,1),5);
    dot.position.copy(point); return dot;
  }
  function letter(group, text, at, offset) {
    const c = document.createElement('canvas'); c.width=128; c.height=128;
    const ctx = c.getContext('2d');
    ctx.font='italic 85px Georgia, serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.strokeStyle='#02070b'; ctx.lineWidth=10; ctx.strokeText(text,64,65);
    ctx.fillStyle='#e4f1f4'; ctx.fillText(text,64,65);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    const m = new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,depthTest:true});
    fades.push({group, material:m, alpha:1});
    const s = new THREE.Sprite(m); s.scale.setScalar(.175); s.position.copy(at);
    s.center.set(...offset); s.renderOrder=7; group.add(s); return s;
  }
  function arrow(group, color, alpha, thick, length=.43, order=6) {
    const object = new THREE.Group(); group.add(object);
    const ink = mat(group,color,alpha);
    object.userData.ink=ink;
    const headLength=.10, radius=.040;
    const shaft = mesh(object,new THREE.CylinderGeometry(thick,thick,length-headLength,10),ink,order);
    shaft.position.y=(length-headLength)/2;
    const head=mesh(object,new THREE.ConeGeometry(radius,headLength,12),ink,order);
    head.position.y=length-headLength/2;
    return object;
  }
  function seat(object, pose) {
    object.position.copy(pose.p);
    object.quaternion.setFromUnitVectors(V(0,1,0),pose.v.clone().normalize());
  }

  // Ink on the visible hemisphere, plus lightly ghosted back-side graticules.
  const globe = mesh(sphere,new THREE.SphereGeometry(.996,96,48),
    mat(sphere,0x040c12,1,{depthWrite:true}),0);
  const graticule=[];
  const locationOnGlobe = (lon,lat,r=1) => toWorld(V(Math.cos(lat)*Math.cos(lon),
    Math.cos(lat)*Math.sin(lon),Math.sin(lat))).multiplyScalar(r);
  for(let k=0;k<24;k++) graticule.push(...segments(t=>locationOnGlobe(k*Math.PI/12,(t-.5)*Math.PI),72));
  for(let k=1;k<12;k++) graticule.push(...segments(t=>locationOnGlobe(t*Math.PI*2,(k-6)*Math.PI/12),120));
  lines(sphere,graticule,palette.grid,.18,false,1);
  lines(sphere,graticule,palette.grid,.49,true,2);
  const outline = new THREE.Group(); sphere.add(outline);
  const rim = segments(t=>V(Math.cos(t*Math.PI*2), Math.sin(t*Math.PI*2),0),180);
  const rimItem = lines(sphere,rim,0x8bb2c1,.74,false,2);
  outline.add(rimItem);
  function faceCamera() { outline.quaternion.copy(sphere.quaternion).invert().multiply(camera.quaternion); }
  controls.addEventListener('change',faceCamera); faceCamera();

  // Each surface's guideline, solid tracing, moving instrument and timestamped copies
  // share the same pose function. The curve can be paused and reversed at any step.
  function tracking(group, pose, legCount, marksPerLeg) {
    const dashes = [], trails = [], stamps = [], vertices = [];
    for(let i=0;i<legCount;i++){
      const edge = t => pose(i+t).p;
      const coords=[];
      for(let j=0;j<24;j++) coords.push(edge(j/24),edge((j+.57)/24));
      dashes.push(lines(group,coords,palette.white,.93,true,3));
      trails.push(tube(group,edge,palette.amber,1,.0075,80,4));
      vertices.push(marker(group,edge(0)));
      for(const f of marksPerLeg) {
        const a=arrow(group,palette.stamp,.80,.006,.38,5); seat(a,pose(i+f));
        stamps.push({tau:i+f, model:a});
      }
    }
    // The wider blue shaft outlines the coincident arrows when the flat loop closes.
    const ghost=arrow(group,palette.ice,.95,.017,.43,5);
    const active=arrow(group,palette.amber,1,.010,.43,6);
    seat(ghost,pose(0));
    return function set(progress, construction, instrumentAlpha) {
      dashes.forEach((s,i)=>reveal(s,construction*legCount-i));
      trails.forEach((s,i)=>reveal(s,progress-i));
      vertices.forEach((v,i)=>v.visible=construction>i/legCount);
      for (const stamp of stamps) {
        const strength=clamp((progress-stamp.tau)/.06);
        stamp.model.visible=strength>0;
        stamp.model.userData.ink.opacity*=strength;
      }
      for (const a of [ghost,active]) {
        a.visible=instrumentAlpha>0;
        a.userData.ink.opacity*=instrumentAlpha;
      }
      if(instrumentAlpha>0) seat(active,pose(progress));
    };
  }
  const setSphere = tracking(sphere,spherePose,3,[.25,.5,.75]);
  const setPlane = tracking(plane,flatPose,4,[.5]);
  const globeLabels = ['A','B','N'].map((c,i)=>letter(sphere,c,spherePose(i).p,[[.95,1.19],[-.1,.9],[.5,-.04]][i]));
  const home = spherePose(0).p;
  const tangentAngle = tube(sphere,t=>home.clone().add(V(-Math.sin(t*quarter)*.277,Math.cos(t*quarter)*.277,0)),
    palette.amber,1,.006,56,6);

  const octantVertices=[], indices=[], n=32;
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++) {
    octantVertices.push(...locationOnGlobe(quarter*i/n,quarter*j/n,1.003).toArray());
    if(i<n && j<n){ const a=j*(n+1)+i; indices.push(a,a+1,a+n+2,a,a+n+2,a+n+1); }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(octantVertices,3)); geo.setIndex(indices);
  const amberWash=mat(sphere,0xe39843,.23);
  const octant=mesh(sphere,geo,amberWash,2.5);
  const grid=[];
  for(let i=-4;i<=4;i++){
    const k=i*.32;
    grid.push(V(k,-1.28,0),V(k,1.28,0),V(-1.28,k,0),V(1.28,k,0));
  }
  lines(plane,grid,palette.grid,.48);
  const flatA=letter(plane,'A',flatPose(0).p,[1.0,1.12]);

  const formula = [
    'K = 1/R² <span aria-hidden="true"> · </span> R = 1<div class="hint">Drag to rotate · WASD　<span lang="zh-Hans">拖动或按 WASD 旋转</span></div>',
    'A → B → N → A', 'v₀ ↑', 'A → B', 'B → N', 'N → A',
    '<strong>α = 90° = π/2</strong>',
    'α = ∫<sub>Δ</sub> K dA = area(Δ)/R² = <strong>π/2</strong>',
    'K = 0', 'v = v₀', '<strong>α = 0</strong>',
    'α<sub>plane</sub> = 0　 <strong>α<sub>sphere</sub> = π/2</strong>',
  ];
  let lastFormula=-1;
  return {
    update(value) {
      // Drafting view slowly orbits during the journey and moves toward A on return.
      // An audience member's independent OrbitControls position is retained throughout.
      sphere.rotation.y=.105-.31*clamp((value-1)/4)+.205*clamp(value-5);
      sphere.scale.setScalar(.96+.085*clamp(value-5));
      faceCamera();
      const swap=clamp(value-7);
      const globeOpacity=clamp(1-1.9*swap);
      const paperOpacity=clamp((swap-.35)/.65);
      sphere.visible=globeOpacity>0; plane.visible=paperOpacity>0;
      for(const item of fades) item.material.opacity = item.alpha*(item.group===sphere?globeOpacity:paperOpacity);
      globe.material.depthWrite=globeOpacity>.80;
      setSphere(clamp(value-2,0,3),clamp(value),clamp(value-1));
      globeLabels.forEach((s,i)=>s.visible=value>(i+.15)/3);
      reveal(tangentAngle,value-5);
      octant.visible=value>6;
      amberWash.opacity=.26*clamp(value-6)*globeOpacity;
      flatA.visible=paperOpacity>.5;
      setPlane(clamp((value-8)*2,0,4),clamp((swap-.35)/.65),clamp((swap-.70)/.30));
      const i=Math.min(stops.length-1,Math.floor(value+.5));
      if(i!==lastFormula){ annotation.innerHTML=`<div>${formula[i]}</div>`; lastFormula=i; }
    },
    resize(width,height) {
      const aspect=width/height;
      const half=Math.max(1.32,1.42/aspect);
      camera.top=half; camera.bottom=-half; camera.left=-half*aspect; camera.right=half*aspect;
      camera.updateProjectionMatrix();
    }
  };
}
