/*! Adapted from AssociateFamilyRiso in Math-To-Manim.
https://github.com/HarleyCoops/Math-To-Manim/blob/963353c269e9e8023309c3ba25c2167c7dba6fcf/examples/mathematics/geometry/riso_associate_family.py

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
import { halfPi, uLimit, vLimit, conjugatePair, associatePoint, witness } from './geometry.mjs';
import { mountPlate } from './plate-layout.mjs';

export const title = 'Plate VII · The Associate Family';
export const language = 'en';
export const secondaryLanguage = 'zh-Hans';
export const stops = [
  { value: -1, primary: 'The helicoid winds around a straight axis.', secondary: '螺旋面绕着一条直轴盘旋。' },
  { value: 0, primary: 'Mark a length of π on the axis. Its two ends are π apart.', secondary: '在轴上标出长为 π 的一段。它的两个端点相距 π。' },
  { value: Math.PI / 4, primary: 'Halfway, the surface is still minimal. The marked path bends and its ends draw closer.', secondary: '变形过半，曲面仍是极小曲面。标出的路径弯曲，两端靠拢。' },
  { value: halfPi, primary: 'On the catenoid the path is a semicircle. Every curve carried by the surface keeps its length.', secondary: '到了悬链面上，这条路径成为半圆。随曲面变形的每条曲线都保持原长。' }
];

const columns = 42;
const rows = 14;
const witnessCenter = -0.4;

function surfaceMesh(THREE) {
  const nu = columns * 3, nv = rows * 3;
  const count = (nu + 1) * (nv + 1);
  const helicoid = new Float32Array(count * 3), catenoid = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  const indices = [];
  for (let j = 0; j <= nv; j++) {
    const v = (2 * j / nv - 1) * vLimit;
    for (let i = 0; i <= nu; i++) {
      const u = (2 * i / nu - 1) * uLimit, vertex = j * (nu + 1) + i;
      const [h, c] = conjugatePair(u, v);
      // A rigid rotation takes mathematical z up to Three.js y up.
      helicoid.set([h[0], h[2], -h[1]], vertex * 3);
      catenoid.set([c[0], c[2], -c[1]], vertex * 3);
      normal.set([Math.cos(u) / Math.cosh(v), -Math.tanh(v), -Math.sin(u) / Math.cosh(v)], vertex * 3);
      uv.set([i / nu, j / nv], vertex * 2);
      if (i < nu && j < nv) {
        const k = vertex, next = k + nu + 1;
        indices.push(k, k + 1, next, k + 1, next + 1, next);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  const coordinates = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', coordinates);
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      darkInk: {value: new THREE.Color('#368d83')},
      paleInk: {value: new THREE.Color('#a1d0be')},
      ruleInk: {value: new THREE.Color('#285f5b')},
      cells: {value: new THREE.Vector2(columns, rows)}
    },
    vertexShader: `
      varying vec2 vGrid;
      varying vec3 vLightNormal;
      void main() {
        vGrid = uv;
        vLightNormal = normalMatrix * normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vGrid;
      varying vec3 vLightNormal;
      uniform vec2 cells;
      uniform vec3 darkInk, paleInk, ruleInk;
      void main() {
        vec2 tile = vGrid * cells;
        vec2 fw = max(fwidth(tile), vec2(0.0001));
        vec2 phase = sign(sin(3.14159265 * tile));
        vec2 edge = min(fract(tile), 1.0-fract(tile)) / fw;
        vec2 aa = clamp(edge * 2.0, 0.0, 1.0);
        float ink = 0.5 + 0.5 * phase.x * phase.y * aa.x * aa.y;
        float margin = smoothstep(0.03, 0.75, min(edge.x,edge.y));
        vec3 color = mix(ruleInk, mix(darkInk, paleInk, ink), 0.65+0.35*margin);
        vec3 n = normalize(vLightNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        float light = 0.55 + 0.49 * max(dot(n, normalize(vec3(-0.52,0.70,0.67))), 0.0);
        gl_FragColor = vec4(color * light, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  function update(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    for (let i = 0; i < helicoid.length; i++) coordinates.array[i] = c * helicoid[i] + s * catenoid[i];
    coordinates.needsUpdate = true;
  }
  return { mesh, update };
}

function materialCurve(THREE) {
  const group = new THREE.Group();
  const curveMaterial = new THREE.MeshBasicMaterial({ color: '#ff926d' });
  const dotMaterial = new THREE.MeshBasicMaterial({ color: '#ffe0c6' });
  const chordMaterial = new THREE.MeshBasicMaterial({ color: '#dfdccd' });
  const segments = 84, sides = 8, thickness = 0.038;
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(new Float32Array((segments + 1) * sides * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const index = [];
  for (let i = 0; i < segments; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k, b = i * sides + (k + 1) % sides;
      index.push(a, b, a + sides, b, b + sides, a + sides);
    }
  }
  geometry.setAttribute('position', position);
  geometry.setIndex(index);
  // A two-sided material keeps both the exterior and the intersection with the surface legible.
  curveMaterial.side = THREE.DoubleSide;
  const curve = new THREE.Mesh(geometry, curveMaterial);
  curve.frustumCulled = false;
  group.add(curve);
  // A fine dashed trace identifies the part of the material path behind the visible sheet.
  const behindGeometry = new THREE.BufferGeometry();
  const hiddenPath = new THREE.BufferAttribute(new Float32Array((segments + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const distances = new THREE.BufferAttribute(new Float32Array(segments + 1), 1).setUsage(THREE.DynamicDrawUsage);
  behindGeometry.setAttribute('position', hiddenPath);
  behindGeometry.setAttribute('lineDistance', distances);
  const behind = new THREE.Line(behindGeometry, new THREE.LineDashedMaterial({
    color: '#ee9979', dashSize: 0.06, gapSize: 0.035, depthFunc: THREE.GreaterDepth, depthWrite: false
  }));
  behind.frustumCulled = false;
  behind.renderOrder = 3;
  group.add(behind);

  const dotGeometry = new THREE.SphereGeometry(0.078, 20, 12);
  const ends = [new THREE.Mesh(dotGeometry, dotMaterial), new THREE.Mesh(dotGeometry, dotMaterial)];
  const cylinder = new THREE.CylinderGeometry(0.017, 0.017, 1, 8);
  const dashes = Array.from({length: 13}, () => new THREE.Mesh(cylinder, chordMaterial));
  group.add(...ends, ...dashes);
  const vertical = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3(), tangent = new THREE.Vector3(), radial = new THREE.Vector3(), binormal = new THREE.Vector3();
  // The straight chord can pass inside the opaque surface. Use a subdued x-ray line there.
  const buriedMaterial = new THREE.MeshBasicMaterial({color: '#ead9c9', depthTest: true, depthFunc: THREE.GreaterDepth, depthWrite: false});
  const buried = dashes.map(() => {
    const part = new THREE.Mesh(cylinder, buriedMaterial);
    part.renderOrder = 2;
    group.add(part);
    return part;
  });
  function update(theta, reveal) {
    group.visible = reveal > 0.002;
    if (!group.visible) return;
    const a = reveal * halfPi, st = Math.sin(theta), ct = Math.cos(theta);
    for (let i = 0; i <= segments; i++) {
      const u = witnessCenter + a * (2 * i / segments - 1), cu = Math.cos(u), su = Math.sin(u);
      const x = st * cu, y = ct * u, z = -st * su;
      hiddenPath.setXYZ(i, x, y, z);
      distances.setX(i, a * 2 * i / segments);
      radial.set(cu, 0, -su);
      tangent.set(-st * su, ct, -st * cu);
      binormal.crossVectors(tangent, radial);
      for (let k = 0; k < sides; k++) {
        const angle = 2 * Math.PI * k / sides, m = thickness * Math.cos(angle), n = thickness * Math.sin(angle);
        position.setXYZ(i * sides + k, x + m * radial.x + n * binormal.x, y + m * radial.y + n * binormal.y, z + m * radial.z + n * binormal.z);
      }
    }
    position.needsUpdate = hiddenPath.needsUpdate = distances.needsUpdate = true;
    for (let i = 0; i < 2; i++) {
      const [x,y,z] = associatePoint(witnessCenter + (i ? 1 : -1) * a, 0, theta);
      ends[i].position.set(x,z,-y);
    }
    direction.subVectors(ends[1].position, ends[0].position);
    const chordLength = direction.length();
    direction.normalize();
    dashes.forEach((dash, i) => {
      dash.visible = buried[i].visible = theta > 0.09;
      if (!dash.visible) return;
      dash.position.copy(ends[0].position).addScaledVector(direction, chordLength * (i + 0.5) / dashes.length);
      dash.quaternion.setFromUnitVectors(vertical, direction);
      dash.scale.y = chordLength * 0.55 / dashes.length;
      buried[i].position.copy(dash.position);
      buried[i].quaternion.copy(dash.quaternion);
      buried[i].scale.copy(dash.scale);
    });
  }
  return { group, update };
}

export function createScene({ THREE, scene, camera, controls, annotation }) {
  const surface = surfaceMesh(THREE);
  const trace = materialCurve(THREE);
  scene.add(surface.mesh, trace.group);
  const setNote = mountPlate(annotation);
  camera.position.set(5.3, 2.75, 2.2);
  controls.enablePan = false;
  controls.minZoom = 0.7;
  controls.maxZoom = 2.8;
  controls.update();
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.target.closest?.('dialog, input, textarea, select')) return;
    const key = event.key.toLowerCase();
    if (!['a', 'd', 'w', 's'].includes(key)) return;
    event.preventDefault();
    const orbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (key === 'a' || key === 'd') orbit.theta += key === 'a' ? -0.16 : 0.16;
    else orbit.phi = THREE.MathUtils.clamp(orbit.phi + (key === 'w' ? -0.12 : 0.12), 0.04, Math.PI - 0.04);
    camera.position.setFromSpherical(orbit).add(controls.target);
    controls.update();
  });
  function update(value) {
    const theta = Math.max(0, value), reveal = Math.min(1, Math.max(0, value + 1));
    surface.update(theta);
    trace.update(theta, reveal);
    setNote(theta, reveal, witness(theta, reveal * halfPi));
  }
  function resize(width, height) {
    // A common world-space framing keeps each unit identical across the three axes.
    const half = Math.max(3.77, 2.4 * height / width);
    camera.top = half;
    camera.bottom = -half;
    camera.right = half * width / height;
    camera.left = -camera.right;
    camera.updateProjectionMatrix();
  }
  return { update, resize };
}
