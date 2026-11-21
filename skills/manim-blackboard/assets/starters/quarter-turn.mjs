export const title = 'A quarter turn';
export const language = 'en';
export const stops = [
  { value: 0, primary: 'Follow the long edge of the box.' },
  { value: Math.PI / 2, primary: 'The long edge has turned through a right angle.' },
];

export function createScene({ THREE, scene, annotation }) {
  const geometry = new THREE.BoxGeometry(1.7, 0.5, 0.5);
  const box = new THREE.Mesh(geometry, new THREE.MeshNormalMaterial());
  scene.add(box);
  return {
    update(angle) {
      box.rotation.z = angle;
      annotation.textContent = `θ = ${Math.round(angle * 180 / Math.PI)}°`;
    },
  };
}
