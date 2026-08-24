import * as THREE from 'three';
import { createScene } from './scene/createScene';
import { buildOffice } from './scene/office';
import { ScreenDisplay } from './scene/screenDisplay';

const container = document.getElementById('app')!;
const { renderer, scene, camera } = createScene(container);
const office = buildOffice();
scene.add(office);

const displays: ScreenDisplay[] = [];
for (const [i, monitorName] of ['monitor-left', 'monitor-right'].entries()) {
  const display = new ScreenDisplay(512, 288, i * 5 * 18);
  const screen = office.getObjectByName(monitorName)!.getObjectByName('screen') as THREE.Mesh;
  const oldMaterial = screen.material as THREE.Material;
  screen.material = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: display.texture,
    emissiveIntensity: 1.2,
  });
  oldMaterial.dispose();
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
