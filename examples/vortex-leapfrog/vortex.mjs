/*! Adapted from VortexLeapfrog in Math-To-Manim.
https://github.com/HarleyCoops/Math-To-Manim/blob/963353c269e9e8023309c3ba25c2167c7dba6fcf/examples/physics/fluid_dynamics/vortex_leapfrog.py

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
import {
  singleTime, release, firstPass, violetLead, secondPass, cyanLead, ringsAt,
  frameOrigin, createTracers, carriedCount, particleCount
} from './filaments.mjs';

export const title = 'Vortex leapfrog';
export const language = 'en';
export const secondaryLanguage = 'zh-Hans';
export const stops = [
  {value: 0, primary: 'The axis runs through ring A. Each dot marks a parcel of fluid.',
    secondary: '轴线穿过涡环 A 的中心。每个光点标出一个流体微团的位置。'},
  {value: singleTime, primary: 'A drives itself forward. Fluid parcels curl through its opening.',
    secondary: 'A 在自身诱导下向前移动。流体微团沿弯曲的轨迹穿过环口。'},
  {value: release, primary: 'Ring B starts behind A with the same radius and circulation.',
    secondary: '从 A 后方释放涡环 B。两环的初始半径和环量相同。'},
  {value: release + (firstPass - release) * 0.58, primary: 'A draws B inward. The smaller B moves faster and closes the gap.',
    secondary: 'A 产生的流场使 B 收缩。变小的 B 移动得更快，逐渐追上 A。'},
  {value: firstPass, primary: 'The centers align. B passes through the opening in A.',
    secondary: '两环的中心重合。B 从 A 的环口穿过。'},
  {value: violetLead, primary: 'B has opened back out. The rings match in size again, with B in front.',
    secondary: 'B 重新扩张。两环的半径再次相等，此时 B 在前方。'},
  {value: violetLead + (secondPass - violetLead) * 0.58, primary: 'Now A is behind. It contracts and catches B.',
    secondary: '现在 A 在后方。它收缩并追赶 B。'},
  {value: secondPass, primary: 'At the second crossing, the smaller A passes through B.',
    secondary: '第二次相遇时，小环 A 从 B 的环口穿过。'},
  {value: cyanLead, primary: 'A leads again. The original sizes and spacing return farther along the axis.',
    secondary: 'A 再次领先。两环向前移动了一个周期，又恢复到最初的大小和间距。'}
];

const cyan = 0x59f2d6, violet = 0xb98cff;

function boardUI(host) {
  const style = document.createElement('style');
  style.textContent = `
    #board { grid-template-rows:minmax(0,1fr) 20%; }
    #scene { grid-template-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr) auto; padding:3% 4% 1.7%; gap:.4em; }
    #annotation { width:100%; align-self:start; padding:0; text-align:center; }
    #vortex-readout { min-height:1.6em; color:#d7dbd9; font:400 clamp(17px,1.85vw,30px)/1.5 var(--bb-font); font-variant-numeric:tabular-nums; }
    #vortex-readout .a { color:#7cead9; }
    #vortex-readout .b { color:#c7a6ff; }
    #vortex-readout [data-reading="radii"] span + span { margin-left:1.4em; }
    #vortex-readout sub { font-size:.7em; }
    .vortex-label { position:absolute; z-index:1; transform:translate(-50%,-50%); pointer-events:none; font:400 clamp(15px,1.4vw,23px)/1 var(--bb-mono); text-shadow:0 0 4px #000; }
    #visual { overflow:hidden; }
    #subtitles { padding:0; width:90%; }
    #subtitles #secondary { padding-top:.3em; }
    @media (orientation:portrait) {
      #board { height:min(100dvh,210vw); grid-template-rows:minmax(0,1fr) max(25%,8.7em); }
      #scene { grid-template-columns:1fr; grid-template-rows:minmax(0,1fr) auto; padding:4% 3% 5%; gap:0; }
      #vortex-readout { font-size:clamp(17px,5.1vw,26px); }
      .vortex-label {font-size:17px;}
    }
    @media (orientation:landscape) and (max-height:500px) {
      #board {grid-template-rows:minmax(0,1fr) max(23%,4.6rem);}
      #scene {padding:0 3% 1%; gap:0;}
      #vortex-readout {font-size:16px; line-height:1.15; min-height:1.2em;}
      .vortex-label {font-size:14px;}
    }`;
  document.head.append(style);
  host.innerHTML = `<div id="vortex-readout">
    <div data-reading="solo" aria-label="Axial position of ring A"><i>x</i><sub class="a">A</sub> = <output></output></div>
    <div data-reading="radii" aria-label="Ring radii"><span><i>R</i><sub class="a">A</sub> = <output></output></span><span><i>R</i><sub class="b">B</sub> = <output></output></span></div>
    <div data-reading="gap" aria-label="Signed gap between ring centers"><i>x</i><sub class="b">B</sub> − <i>x</i><sub class="a">A</sub> = <output></output></div>
  </div>`;
  const solo=host.querySelector('[data-reading=solo]');
  const radii=host.querySelector('[data-reading=radii]');
  const gap=host.querySelector('[data-reading=gap]');
  const [xA,rA,rB,delta]=host.querySelectorAll('output');
  return (state,reveal) => {
    const [xa,ra,xb,rb]=state;
    const step=Number(document.body.dataset.step);
    solo.hidden=step>1;
    gap.hidden=![2,5,8].includes(step);
    radii.hidden=!solo.hidden || !gap.hidden;
    xA.textContent=xa.toFixed(2);
    rA.textContent=ra.toFixed(2); rB.textContent=rb.toFixed(2);
    const dx=xb-xa;
    delta.textContent=reveal===0 ? '—' : (dx<-.005?'−':dx>.005?'+':'')+Math.abs(dx).toFixed(2);
    host.dataset.xa=xa; host.dataset.ra=ra;
    host.dataset.xb=xb; host.dataset.rb=rb; host.dataset.violet=reveal;
  };
}
function circle(THREE, scene, color) {
  const group = new THREE.Group();
  const layers = [[.037,.075],[.023,.15],[.010,1]];
  for (const [width, opacity] of layers) {
    const mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity,
      depthWrite:opacity === 1, blending:opacity === 1 ? THREE.NormalBlending : THREE.AdditiveBlending});
    // Order triangles around the centerline so ring B is drawn around its
    // circumference at release while its physical radius stays fixed.
    const sides = 12, arcCount = 160;
    const geometry = new THREE.TorusGeometry(1, width, sides, arcCount);
    const indices = geometry.index.array;
    const ordered = new Uint16Array(indices.length);
    for (let arc = 0; arc < arcCount; arc++) {
      for (let side = 0; side < sides; side++) {
        const from = 6 * (side * arcCount + arc);
        ordered.set(indices.subarray(from, from + 6), 6 * (arc * sides + side));
      }
    }
    geometry.setIndex(new THREE.BufferAttribute(ordered, 1));
    const base = geometry.getAttribute('position');
    const radial = new Float32Array(base.count * 3);
    for (let vertex = 0; vertex < base.count; vertex++) {
      const x = base.getX(vertex), y = base.getY(vertex);
      const length = Math.hypot(x, y);
      radial[vertex*3] = x / length;
      radial[vertex*3+1] = y / length;
    }
    geometry.morphAttributes.position = [new THREE.BufferAttribute(radial,3)];
    geometry.morphTargetsRelative = true;
    const ring = new THREE.Mesh(geometry, mat);
    ring.frustumCulled = false;
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
  }
  scene.add(group);
  return group;
}

function addAxis(THREE, scene) {
  const length = 2.55;
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-length, 0, 0), new THREE.Vector3(length, 0, 0)
  ]), new THREE.LineBasicMaterial({color:0x343d3d}));
  scene.add(line);
  const geometry = new THREE.ConeGeometry(.036,.115,12);
  const tip = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color:0x788483}));
  tip.rotation.z = -Math.PI/2; tip.position.x = length;
  scene.add(tip);
  // Half-unit laboratory ticks move left when the camera follows the pair.
  const count = 12, ticks = new Float32Array(count*6);
  const tickBuffer = new THREE.BufferGeometry();
  tickBuffer.setAttribute('position',new THREE.BufferAttribute(ticks,3));
  const tickMarks = new THREE.LineSegments(tickBuffer, new THREE.LineBasicMaterial({color:0x505d5b}));
  tickMarks.frustumCulled=false; scene.add(tickMarks);
  return origin => {
    let tick = Math.ceil((origin-length)*2);
    for (let i=0; i<count; i++,tick++) {
      const x=tick/2-origin, h=x<=length ? (tick%2 === 0 ? .047 : .026) : 0;
      ticks.set([x,-h,0,x,h,0],i*6);
    }
    tickBuffer.attributes.position.needsUpdate=true;
  };
}

function dotsAndTraces(THREE,scene) {
  const fluid = createTracers();
  const points = new Float32Array(particleCount*3);
  const colors = new Float32Array(points.length);
  const ink = new THREE.Color();
  for(let i=0;i<particleCount;i++) {
    ink.set(i<carriedCount ? 0x7de1d4 : 0x427f9e).toArray(colors,i*3);
  }
  const textureCanvas=document.createElement('canvas');
  textureCanvas.width=textureCanvas.height=32;
  const ctx=textureCanvas.getContext('2d');
  const gradient=ctx.createRadialGradient(16,16,0,16,16,16);
  gradient.addColorStop(0,'#fff');gradient.addColorStop(.48,'#fff');
  gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient; ctx.fillRect(0,0,32,32);
  const pointGeometry=new THREE.BufferGeometry();
  pointGeometry.setAttribute('position',new THREE.BufferAttribute(points,3));
  pointGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const cloud=new THREE.Points(pointGeometry,new THREE.PointsMaterial({
    vertexColors:true, size:4.2, sizeAttenuation:false, map:new THREE.CanvasTexture(textureCanvas),
    transparent:true, opacity:.92, depthWrite:false
  }));
  cloud.frustumCulled=false; scene.add(cloud);
  const segmentCount=32, duration=1.65;
  const positions=new Float32Array(carriedCount*segmentCount*6);
  const traceColors=new Float32Array(positions.length);
  const tint=new THREE.Color(0x62caba);
  for(let i=0;i<carriedCount;i++) for(let j=0;j<segmentCount;j++){
    for(let k=0;k<2;k++){
      ink.copy(tint).multiplyScalar(.025+.46*(1-(j+1-k)/segmentCount)**1.5)
        .toArray(traceColors,(i*segmentCount+j)*6+k*3);
    }
  }
  const traces=new THREE.BufferGeometry();
  traces.setAttribute('position',new THREE.BufferAttribute(positions,3));
  traces.setAttribute('color',new THREE.BufferAttribute(traceColors,3));
  const strands=new THREE.LineSegments(traces,new THREE.LineBasicMaterial({
    vertexColors:true, transparent:true, opacity:.76, depthWrite:false
  }));
  strands.frustumCulled=false; scene.add(strands);
  return time => {
    for (let i=0;i<particleCount;i++) fluid.project(time,i,points,i*3);
    for (let i=0;i<carriedCount;i++) {
      for (let j=0;j<segmentCount;j++) {
        const at=(i*segmentCount+j)*6;
        // Injection takes no simulation time; keep the existing trails intact.
        const now=time<=singleTime ? time : time<release ? singleTime : time-(release-singleTime);
        const a=now-(j+1)*duration/segmentCount, b=now-j*duration/segmentCount;
        fluid.project(a<=singleTime ? a : a+release-singleTime,i,positions,at);
        fluid.project(b<=singleTime ? b : b+release-singleTime,i,positions,at+3);
      }
    }
    pointGeometry.attributes.position.needsUpdate=true;
    traces.attributes.position.needsUpdate=true;
  };
}

export function createScene({THREE,scene,camera,controls,annotation,invalidate}) {
  const display=boardUI(annotation);
  camera.position.set(3.5,1.04,5.95); controls.target.set(0,0,0); controls.update();
  const rings=[circle(THREE,scene,cyan),circle(THREE,scene,violet)];
  const positions=[new THREE.Vector3(),new THREE.Vector3()];
  const visual=document.getElementById('visual');
  visual.querySelector('canvas').title = 'Drag to rotate · Shift + arrow keys to rotate';
  document.getElementById('controls-help').append(' Shift and the arrow keys rotate the drawing. Press 0 to reset the view.');
  const direction = new THREE.Vector3();
  const angles = new THREE.Spherical();
  const startPosition = camera.position.clone();
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]')) return;
    if (event.key === '0' && !event.shiftKey) {
      camera.position.copy(startPosition); camera.zoom = 1; camera.updateProjectionMatrix();
    } else {
      const turns = { ArrowLeft:[-.14,0], ArrowRight:[.14,0], ArrowUp:[0,-.14], ArrowDown:[0,.14] };
      const turn = turns[event.key];
      if (!event.shiftKey || !turn) return;
      angles.setFromVector3(direction.copy(camera.position).sub(controls.target));
      angles.theta += turn[0]; angles.phi += turn[1]; angles.makeSafe();
      camera.position.copy(direction.setFromSpherical(angles)).add(controls.target);
    }
    event.preventDefault(); controls.update(); invalidate();
  });
  const labels=['A','B'].map((name,i) => {
    const label=document.createElement('span');
    label.textContent=name; label.className='vortex-label';
    label.style.color=i===0 ? '#7cead9' : '#c7a6ff';
    label.setAttribute('aria-hidden','true'); visual.append(label); return label;
  });
  let width=0,height=0;
  const project=new THREE.Vector3();
  function placeLabels() {
    camera.updateMatrixWorld();
    for(let i=0;i<2;i++){
      project.copy(positions[i]).project(camera);
      labels[i].style.left=((project.x+1)*width/2)+'px';
      labels[i].style.top=((1-project.y)*height/2)+'px';
    }
  }
  controls.addEventListener('change',placeLabels);
  const axis=addAxis(THREE,scene), flow=dotsAndTraces(THREE,scene);
  function update(time) {
    const state=ringsAt(time), origin=frameOrigin(time,state);
    const reveal=Math.min(1,Math.max(0,(time-singleTime)/(release-singleTime)));
    for(let i=0;i<2;i++){
      const strength=i===0 ? 1 : reveal, r=state[i*2+1], x=state[i*2]-origin;
      rings[i].position.x=x; rings[i].visible=strength>0;
      for (const layer of rings[i].children) {
        layer.morphTargetInfluences[0]=r-1;
        const arcCount = Math.ceil(160 * strength);
        layer.geometry.setDrawRange(0, arcCount * 12 * 6);
      }
      const sign=i===0 ? 1 : -1;
      positions[i].set(x,sign*(r+.10),0);
      labels[i].style.opacity=String(strength);
    }
    placeLabels(); axis(origin); flow(time); display(state,reveal);
  }
  function resize(w,h) {
    width=w;height=h;
    // The entire loop stays in view on a portrait phone, including its labels.
    const aspect=w/h, halfHeight=Math.max(1.72,2.48/aspect);
    camera.top=halfHeight; camera.bottom=-halfHeight;
    camera.right=halfHeight*aspect; camera.left=-camera.right;
    camera.updateProjectionMatrix(); placeLabels(); invalidate();
  }
  return {update,resize};
}
