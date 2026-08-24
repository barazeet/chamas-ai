import { createScene } from './scene/createScene';

const container = document.getElementById('app')!;
const { renderer, scene, camera } = createScene(container);

const gate = document.getElementById('gate')!;
gate.addEventListener('click', () => gate.classList.add('hidden'), { once: true });

const clock = { last: performance.now() };
function loop(now: number) {
  const dt = Math.min((now - clock.last) / 1000, 0.1);
  clock.last = now;
  void dt;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
