import { createScene } from './scene/createScene';
import { buildOffice } from './scene/office';
import { ScreenDisplay, type ScreenMode } from './scene/screenDisplay';
import { loadAvatar } from './character/avatar';
import { IdleAnimator } from './character/idle';
import { applySeatedPose } from './character/pose';
import { CharacterStateMachine } from './state/characterState';
import { sendChat, type ChatMessage } from './chat/api';
import { ChatUI } from './chat/ui';
import * as THREE from 'three';

const container = document.getElementById('app')!;
const { renderer, scene, camera } = createScene(container);

const gate = document.getElementById('gate')!;
gate.addEventListener('click', () => gate.classList.add('hidden'), { once: true });

// Subtle mouse parallax: the camera drifts a few centimeters toward the
// cursor so the scene feels alive. Base pose matches createScene.
const CAMERA_BASE = { x: 0, y: 1.35, z: 3.3 };
const mouse = { x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
});

const office = buildOffice();
scene.add(office);

const displays: ScreenDisplay[] = [];
const MONITOR_MODES: ScreenMode[] = ['agents', 'board'];
for (const [i, monitorName] of ['monitor-left', 'monitor-right'].entries()) {
  const display = new ScreenDisplay(MONITOR_MODES[i], 512, 288, i * 13);
  const screen = office.getObjectByName(monitorName)!.getObjectByName('screen') as THREE.Mesh;
  const oldMaterial = screen.material as THREE.Material;
  screen.material = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: display.texture,
    emissiveIntensity: 1.0,
  });
  oldMaterial.dispose();
  displays.push(display);
}

const sm = new CharacterStateMachine();
sm.onChange((state) => {
  for (const d of displays) d.speed = state === 'thinking' ? 6 : 1;
});

let idle: IdleAnimator | null = null;
loadAvatar('/models/avatar.glb').then((avatar) => {
  applySeatedPose(avatar.object);
  // Seated: hips at chair-seat height. Avaturn's forward is +z, which is
  // toward the camera/visitor — no yaw needed.
  avatar.object.position.set(0, -0.5, 0.5);
  scene.add(avatar.object);
  idle = new IdleAnimator(avatar);
  (window as unknown as { __avatar: unknown }).__avatar = avatar;
});

const history: ChatMessage[] = [];
const ui = new ChatUI({
  async onSubmit(message) {
    if (sm.current !== 'idle') return;
    ui.addMessage('user', message);
    history.push({ role: 'user', content: message });
    sm.transition('thinking');
    try {
      const reply = await sendChat(message, history.slice(0, -1));
      sm.transition('speaking');
      const el = ui.addMessage('assistant', '');
      await ui.typewriter(el, reply.reply);
      history.push({ role: 'assistant', content: reply.reply });
      history.splice(0, history.length - 8);
      sm.transition('idle');
    } catch (err) {
      // Roll back the user message pushed above. The sm.current guard
      // serializes submissions, so the failed message is always the tail;
      // leaving it would end history with two consecutive user turns and
      // Gemini rejects that, bricking every subsequent request.
      history.pop();
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('429')) {
        ui.addMessage('assistant', 'whoa, slow down a sec — too many messages at once.');
      } else {
        ui.addMessage('assistant', "hmm, my brain hiccuped — try again in a sec.");
      }
      sm.transition('idle');
    }
  },
});
sm.onChange((state) => ui.setEnabled(state === 'idle'));

const clock = { last: performance.now() };
function loop(now: number) {
  const dt = Math.min((now - clock.last) / 1000, 0.1);
  clock.last = now;
  // camera parallax (eased)
  const ease = Math.min(dt * 3, 1);
  camera.position.x += (CAMERA_BASE.x + mouse.x * 0.12 - camera.position.x) * ease;
  camera.position.y += (CAMERA_BASE.y - mouse.y * 0.06 - camera.position.y) * ease;
  camera.position.z += (CAMERA_BASE.z - camera.position.z) * ease;
  camera.lookAt(0, 1.05, 0);
  for (const d of displays) d.update(dt);
  idle?.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
