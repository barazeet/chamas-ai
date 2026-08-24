import { createScene } from './scene/createScene';
import { buildOffice } from './scene/office';
import { ScreenDisplay } from './scene/screenDisplay';
import { loadAvatar } from './character/avatar';
import { IdleAnimator } from './character/idle';
import { CharacterStateMachine } from './state/characterState';
import { sendChat, type ChatMessage } from './chat/api';
import { ChatUI } from './chat/ui';
import * as THREE from 'three';

const container = document.getElementById('app')!;
const { renderer, scene, camera } = createScene(container);

const gate = document.getElementById('gate')!;
gate.addEventListener('click', () => gate.classList.add('hidden'), { once: true });

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

const sm = new CharacterStateMachine();
sm.onChange((state) => {
  for (const d of displays) d.speed = state === 'thinking' ? 6 : 1;
});

let idle: IdleAnimator | null = null;
loadAvatar('/models/avatar.glb').then((avatar) => {
  avatar.object.position.set(0, 0.48, 0.42);
  avatar.object.rotation.y = Math.PI;
  scene.add(avatar.object);
  idle = new IdleAnimator(avatar);
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
    } catch {
      ui.addMessage('assistant', "hmm, my brain hiccuped — try again in a sec.");
      sm.transition('idle');
    }
  },
});
sm.onChange((state) => ui.setEnabled(state === 'idle'));

const clock = { last: performance.now() };
function loop(now: number) {
  const dt = Math.min((now - clock.last) / 1000, 0.1);
  clock.last = now;
  for (const d of displays) d.update(dt);
  idle?.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
