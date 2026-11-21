export const title = 'Slicing a 4-ball';
export const language = 'en';
export const secondaryLanguage = 'zh-Hans';

export const stops = [
  {
    value: -1,
    primary: 'Fix w at −1. Only x = y = z = 0 fits, so the slice is a point.',
    secondary: '把第四个坐标 w 固定在 −1。只有 x = y = z = 0 满足条件，截面就是一个点。'
  },
  {
    value: -0.8,
    primary: 'At w = −0.8, the slice fills a three-dimensional ball of radius 0.6.',
    secondary: '当 w = −0.8 时，截面是一个半径为 0.6 的三维实心球。'
  },
  {
    value: -0.6,
    primary: 'Move the cut toward the center. A smaller w² leaves more room for x, y and z.',
    secondary: '让切面靠近中心。w² 变小，留给 x、y、z 三个坐标的空间就变大了。'
  },
  {
    value: 0,
    primary: 'The central slice is largest. It contains every point on and inside this unit sphere.',
    secondary: '正中央的截面最大。这个单位球面及其内部的每一点，都属于截面。'
  },
  {
    value: 0.6,
    primary: 'Now w is positive. At +0.6 the radius is 0.8 again, just as it was at −0.6.',
    secondary: '现在 w 变成了正数。在 +0.6 处，截面半径又是 0.8，和 −0.6 处一样。'
  },
  {
    value: 0.8,
    primary: 'Equal distances from the center give equal slices. Only w² enters the radius.',
    secondary: '到中心的距离相同，截面的大小就相同。半径只取决于 w 的平方。'
  },
  {
    value: 1,
    primary: 'At the opposite tip the radius is zero. The whole sweep went from a point to a ball and back.',
    secondary: '到达另一端时，半径又变成零。整个过程中，截面从一个点长成球，又缩回一点。'
  }
];

const teal = 0x81d7ca;
const ink = 0xf0eee6;
const axisLength = 1.32;

function createAnnotation(host) {
  host.innerHTML = `
    <style>
      .slice-note { width: max-content; max-width: 100%; color: #f4f0e7; font-family: var(--bb-font); }
      .slice-note h1 { margin: 0 0 .42em; font-size: clamp(25px, 10cqw, 74px); font-style: italic; font-weight: 400; line-height: 1.03; }
      .slice-note .definition { margin: 0 0 1.22em; font-size: clamp(17px, 5.65cqw, 40px); line-height: 1.25; white-space: nowrap; }
      .slice-note i { font-weight: 400; }
      .slice-note .coordinate, .slice-note .radius { margin: 0; white-space: nowrap; font-size: clamp(20px, 8.2cqw, 56px); line-height: 1.47; }
      .slice-note .radius { font-size: clamp(19px, 7.05cqw, 48px); }
      .slice-note .radicand { display: inline-block; border-top: .05em solid currentColor; line-height: 1.07; padding: .04em .08em .02em .02em; }
      .slice-note output { display: inline-block; min-width: 2.5ch; font-variant-numeric: lining-nums tabular-nums; }
      .slice-note .radius output { color: #83e3d3; }
      @media (orientation: portrait) {
        .slice-note { margin: 0 auto; text-align: center; }
        .slice-note h1 { font-size: clamp(23px, 7.2cqw, 42px); margin-bottom: .23em; }
        .slice-note .definition { margin-bottom: .48em; font-size: clamp(16px, 4.8cqw, 26px); }
        .slice-note .coordinate, .slice-note .radius { font-size: clamp(18px, 5.6cqw, 33px); }
      }
    </style>
    <section class="slice-note">
      <h1>Slicing a 4-ball</h1>
      <p class="definition"><i>x</i>² + <i>y</i>² + <i>z</i>² + <i>w</i>² ≤ 1</p>
      <p class="coordinate"><i>w</i> = <output data-quantity="w" aria-label="Fourth coordinate" aria-live="off"></output></p>
      <p class="radius"><i>r</i> = √<span class="radicand">1 − <i>w</i>²</span> = <output data-quantity="radius" aria-label="Slice radius" aria-live="off"></output></p>
    </section>`;
  const coordinate = host.querySelector('[data-quantity="w"]');
  const radius = host.querySelector('[data-quantity="radius"]');

  return (w, r) => {
    const displayW = Number(w.toFixed(2));
    coordinate.textContent = displayW > 0 ? `+${displayW}` : String(displayW).replace('-', '−');
    radius.textContent = String(Number(r.toFixed(2)));
    host.dataset.w = String(w);
    host.dataset.radius = String(r);
  };
}

function axisLabel(THREE, name, location, invalidate) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d3d8d7';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  function paint() {
    ctx.font = `italic 96px ${getComputedStyle(document.getElementById('annotation')).fontFamily}`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(name, 64, 61);
    map.needsUpdate = true;
    invalidate();
  }
  function setTypeface() {
    paint();
    if (!document.fonts.check(ctx.font, name)) document.fonts.load(ctx.font, name).then(paint);
  }
  window.addEventListener('bb-typefacechange', setTypeface);
  setTypeface();
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false, depthTest: false }));
  label.position.copy(location);
  label.scale.setScalar(0.26);
  label.renderOrder = 3;
  return label;
}

function addAxes(THREE, scene, invalidate) {
  const shafts = [];
  const origin = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const tipMaterial = new THREE.MeshBasicMaterial({ color: 0x788687 });
  const tipGeometry = new THREE.ConeGeometry(0.022, 0.072, 12);
  for (const [name, direction] of [
    ['x', new THREE.Vector3(1, 0, 0)],
    ['y', new THREE.Vector3(0, 1, 0)],
    ['z', new THREE.Vector3(0, 0, 1)]
  ]) {
    shafts.push(direction.clone().multiplyScalar(-axisLength), direction.clone().multiplyScalar(axisLength));
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.quaternion.setFromUnitVectors(up, direction);
    tip.position.copy(direction).multiplyScalar(axisLength);
    scene.add(tip, axisLabel(THREE, name, direction.clone().multiplyScalar(axisLength + 0.14), invalidate));
    // Unit ticks stay fixed as the section changes size.
    const perpendicular = direction.x ? up : new THREE.Vector3(1, 0, 0);
    for (const sign of [-1, 1]) {
      const p = direction.clone().multiplyScalar(sign);
      shafts.push(p.clone().addScaledVector(perpendicular, -0.035), p.clone().addScaledVector(perpendicular, 0.035));
    }
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(shafts);
  const axes = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x687574 }));
  scene.add(axes);

  // A fixed screen-sized disk represents the mathematical point at the two tips.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, 2 * Math.PI);
  ctx.fill();
  const dot = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints([origin]),
    new THREE.PointsMaterial({ color: teal, size: 10, sizeAttenuation: false, map: new THREE.CanvasTexture(canvas), alphaTest: 0.45, depthTest: false })
  );
  dot.renderOrder = 4;
  scene.add(dot);
  return dot;
}

function stroke(THREE, sample, color, segments = 120) {
  const points = Array.from({ length: segments + 1 }, (_, i) => sample(i / segments));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color }));
}

export function createScene({ THREE, scene, annotation, invalidate }) {
  const showReading = createAnnotation(annotation);
  const point = addAxes(THREE, scene, invalidate);
  const slice = new THREE.Group();
  slice.name = 'Three-dimensional ball slice';
  scene.add(slice);

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, 80, 48),
    new THREE.MeshPhongMaterial({
      color: 0x3d9691, emissive: 0x092422, specular: 0x467e74, shininess: 46,
      transparent: true, opacity: 0.74, depthWrite: false
    })
  );
  globe.renderOrder = 2;
  slice.add(globe);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xe2fff8, 2.15);
  key.position.set(-2, 4, 3);
  const fill = new THREE.DirectionalLight(0x56a7bb, 0.9);
  fill.position.set(3, 0.7, -3);
  scene.add(key, fill);

  // An equatorial disk reveals the interior. Its single bright radius fixes a
  // direction on an otherwise rotationally symmetric surface.
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96),
    new THREE.MeshBasicMaterial({ color: 0x66aa9c, transparent: true, opacity: 0.46, side: THREE.DoubleSide, depthWrite: false })
  );
  disk.rotation.x = -Math.PI / 2;
  slice.add(disk);
  slice.add(stroke(THREE, t => new THREE.Vector3(Math.cos(2 * Math.PI * t), 0, Math.sin(2 * Math.PI * t)), 0x83d6c6));
  slice.add(stroke(THREE, t => new THREE.Vector3(Math.sin(Math.PI * t), Math.cos(Math.PI * t), 0), 0x78b9b3));
  slice.add(stroke(THREE, t => new THREE.Vector3(t, 0, 0), ink, 1));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 10), new THREE.MeshBasicMaterial({ color: ink }));
  tip.position.x = 1;
  slice.add(tip);

  function update(w) {
    const r = Math.sqrt(Math.max(0, 1 - w * w));
    slice.visible = r > 0;
    slice.scale.setScalar(r);
    point.visible = r === 0;
    showReading(w, r);
  }
  return { update };
}
