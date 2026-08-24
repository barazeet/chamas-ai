import * as THREE from 'three';
import { createScene } from './scene/createScene';
import { buildOffice } from './scene/office';
import { ScreenDisplay } from './scene/screenDisplay';

const container = document.getElementById('app')!;
const { renderer, scene, camera } = createScene(container);
scene.add(buildOffice());

const office = scene.getObjectByName('office')!;
const displays: ScreenDisplay[] = [];
for (const monitorName of ['monitor-left', 'monitor-right']) {
  const display = new ScreenDisplay();
  const screen = office.getObjectByName(monitorName)!.getObjectByName('screen') as THREE.Mesh;
  screen.material = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: display.texture,
    emissiveIntensity: 1.2,
  });
  displays.push(display);
}

const gate = document.getElementById('gate')!;
gate.addEventListener('click', () => gate.classList.add('hidden'), { once: true });

const clock = { last: performance.now() };
function loop(now: number) {
  const dt = Math.min((now - clock.last) / 1000, 0.1);
  clock.last = now;
  for (const d of displays) d.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
