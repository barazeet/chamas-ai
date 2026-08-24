import { createScene } from './scene/createScene';
import { loadOffice } from './scene/officeLoader';
import { CAMERA_POSES, CameraRig, applyLensFov } from './scene/cameraRig';

const container = document.getElementById('app')!;
const { renderer, scene, camera } = createScene(container);

applyLensFov(camera);
window.addEventListener('resize', () => applyLensFov(camera));
const rig = new CameraRig(camera);
rig.snapTo(CAMERA_POSES.entry);

loadOffice('/models/office.glb').then((office) => {
  scene.add(office.group);
});

const clock = { last: performance.now() };
function loop(now: number) {
  const dt = Math.min((now - clock.last) / 1000, 0.1);
  clock.last = now;
  rig.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
