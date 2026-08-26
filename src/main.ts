import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  loadAvatar,
  loadClip,
  applyPoseAdjustment,
  applyCameraLook,
} from './avatar';
import {
  calculateSwivelTargets,
  createSwivelRig,
  getSwivelPose,
  splitVisibleDelta,
  type SwivelPhase,
} from './swivel';

/**
 * Minimal faithful viewer for the Blender-exported office.
 * Faithful = the blend's own cameras, lights and world — nothing invented.
 * The GLB carries: camera1/camera2 nodes (50mm, 36mm sensor), the two
 * point lamps (KHR_lights_punctual), real transmission glass.
 */

const LENS_MM = 50;
const SENSOR_WIDTH_MM = 36;

/** Blender lens (mm, 36mm sensor) -> three.js vertical FOV at current aspect. */
function applyLensFov(camera: THREE.PerspectiveCamera): void {
  const hfov = 2 * Math.atan(SENSOR_WIDTH_MM / (2 * LENS_MM));
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / camera.aspect));
  camera.updateProjectionMatrix();
}

async function main(): Promise<void> {
  const container = document.getElementById('app')!;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.toneMapping = THREE.AgXToneMapping; // match Blender's AgX grading
  renderer.shadowMap.enabled = true; // both blend lamps have use_shadow=true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // The blend's world background: flat dark gray, no HDRI
  scene.background = new THREE.Color(0.0509, 0.0509, 0.0509);

  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'color:#999;font:14px system-ui,sans-serif;background:#3f3f3f;z-index:10;' +
    'transition:opacity .4s';
  overlay.textContent = 'loading…';
  document.body.appendChild(overlay);

  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync('/models/office.glb', (e) => {
      if (e.total) {
        overlay.textContent = `loading ${Math.round((e.loaded / e.total) * 100)}%`;
      }
    });
  overlay.textContent = 'building scene…'; // decode + GPU upload phase
  scene.add(gltf.scene);
  // Composition nudge: pull the keyboard a few cm toward the chair so the
  // avatar's hands sit on it (user-directed tweak, not a blend change).
  const keyboard = gltf.scene.getObjectByName('keyboard');
  if (keyboard) keyboard.position.z -= 0.04;
  // debug handle for pipeline verification
  (window as unknown as { __ctx: unknown }).__ctx = { renderer, scene, camera, gltf };

  // The GLB carries no lights (old blend lamps deleted by decision).
  // New lighting is built here in code, one light at a time.
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.receiveShadow = true;
    const mat = mesh.material as THREE.MeshPhysicalMaterial;
    const isGlass = (mat.transmission ?? 0) > 0;
    const isViewPlane = mesh.name.startsWith('parallax_');
    // Clear glass and the view photos must not occlude light in the shadow
    // pass — otherwise window light hits an invisible wall at the pane.
    mesh.castShadow = !isGlass && !isViewPlane;
    if (isViewPlane) {
      // Unlit backdrop: self-illuminated photo, immune to being washed out
      // by the gallery sun sitting in front of it. (The AVIF view exports
      // its texture as emissive-only, so fall back to emissiveMap.)
      const src = mesh.material as THREE.MeshStandardMaterial;
      mesh.material = new THREE.MeshBasicMaterial({
        map: src.map ?? src.emissiveMap ?? null,
        side: src.side, // planes face away from the room — keep DoubleSide
      });
    }
  });

  // --- Lighting (built light by light, user-directed) --------------------
  // Watts here mean Eevee-equivalent point power: intensity = P / (4π) so
  // the falloff matches what Blender shows for the same wattage.
  const pointWatts = (w: number) => w / (4 * Math.PI);
  const shadowed = (light: THREE.PointLight) => {
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.near = 0.05;
    light.shadow.camera.far = 10; // small room: depth precision matters —
    // with the 500m default, bias=-0.004 leaks light 2m past occluders
    light.shadow.bias = -0.0005;
    return light;
  };

  // Light #1 — 420W white point between wall-1 and the windowleft image,
  // at the user's original blend spot (Blender: 1.656, -1.193, 2.5).
  const windowSunA = shadowed(
    new THREE.PointLight(0xffffff, pointWatts(420), 0, 2),
  );
  windowSunA.position.set(1.656, 2.5, 1.193);
  scene.add(windowSunA);

  // Light #2 — 420W white point between wall-2 and the windowright image,
  // light #1's exact offsets mirrored to window B (0.75m behind wall,
  // +0.41 lateral, +1.08 above window center -> Blender: -2.78, 0.563, 2.198).
  const windowSunB = shadowed(
    new THREE.PointLight(0xffffff, pointWatts(420), 0, 2),
  );
  windowSunB.position.set(-2.78, 2.198, -0.563);
  scene.add(windowSunB);

  // Light #3 — 69.5W white indoor point: the blend's Point.002 at its
  // original x,y (Blender: 1.142, 2.663), dropped to just below the
  // ceiling at z=2.7 (its original z=3.93 sits above the ceiling).
  const indoor = shadowed(new THREE.PointLight(0xffffff, pointWatts(69.5), 0, 2));
  indoor.position.set(1.142, 2.7, -2.663);
  scene.add(indoor);

  // Snap to the blend's camera1 — its transform comes straight from the GLB
  const camNode = gltf.scene.getObjectByName('camera1');
  if (camNode) {
    camNode.updateWorldMatrix(true, false);
    camNode.getWorldPosition(camera.position);
    camNode.getWorldQuaternion(camera.quaternion);
  }
  applyLensFov(camera);

  // Environment = the room itself. Metals/glass reflect the actual scene
  // (including the bright window views) and the ambient stays as dark as
  // the room really is — no artificial studio wash.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(scene, 0.04).texture;

  const avatar = await loadAvatar(scene);
  const typingAction = await loadClip(avatar, '/models/anims/Typing.fbx');
  const idleAction = await loadClip(avatar, '/models/anims/Seated Idle.fbx');
  const chair = gltf.scene.getObjectByName('chair');
  if (!chair) throw new Error('office chair object missing');
  const swivelRig = createSwivelRig(scene, chair, avatar.root);
  const startYaw = swivelRig.rotation.y;
  const swivelSpace = swivelRig.parent!;
  const pivotLocal = swivelSpace.worldToLocal(
    swivelRig.getWorldPosition(new THREE.Vector3()),
  );
  const cameraLocal = swivelSpace.worldToLocal(
    camera.getWorldPosition(new THREE.Vector3()),
  );
  const targets = calculateSwivelTargets(pivotLocal, cameraLocal, startYaw);

  typingAction.reset().setEffectiveWeight(1).play();
  avatar.mixer.update(0);
  (window as unknown as { __tuneHands: unknown }).__tuneHands = (
    angle: number,
    axis?: [number, number, number],
  ) => {
    for (const a of avatar.handAdjust) {
      a.angle = angle;
      if (axis) a.axis.set(axis[0], axis[1], axis[2]);
    }
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    applyLensFov(camera);
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let firstFrame = true;
  let visibleElapsed = 0;
  let transitionStarted = false;
  let phase: SwivelPhase = 'typing';
  let last = performance.now();
  let pendingVisibleDelta = 0;

  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    if (document.visibilityState === 'hidden' && !firstFrame) {
      pendingVisibleDelta += (now - last) / 1000;
    }
    last = now;
  });

  Object.assign(
    (window as unknown as { __ctx: Record<string, unknown> }).__ctx,
    {
      avatar,
      chair,
      swivelRig,
      typingAction,
      idleAction,
      getPhase: () => phase,
    },
  );

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt =
      firstFrame || document.visibilityState === 'hidden'
        ? 0
        : pendingVisibleDelta + (now - last) / 1000;
    if (!firstFrame && document.visibilityState === 'visible') {
      pendingVisibleDelta = 0;
    }
    last = now;
    const previousElapsed = visibleElapsed;
    visibleElapsed += dt;
    const pose = getSwivelPose(visibleElapsed, startYaw, targets);
    const split = splitVisibleDelta(previousElapsed, dt);

    if (split.reachesTransition && !transitionStarted) {
      avatar.mixer.update(split.beforeTransition);
      transitionStarted = true;
      idleAction.reset().setEffectiveWeight(1).play();
      typingAction.crossFadeTo(idleAction, 0.6, false);
      avatar.mixer.update(split.afterTransition);
    } else {
      avatar.mixer.update(dt);
    }

    phase = pose.phase;
    swivelRig.rotation.y = pose.rigYaw;
    applyPoseAdjustment(avatar, pose);
    applyCameraLook(avatar, camera, pose.lookWeight, dt);
    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      last = performance.now();
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 500);
    }
  });
}

main().catch((e) => {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:10px;left:10px;color:#f66;font:12px monospace;' +
    'z-index:99;white-space:pre-wrap;max-width:90vw';
  el.textContent = String(e?.stack ?? e);
  document.body.appendChild(el);
});
