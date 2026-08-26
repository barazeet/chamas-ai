import * as THREE from 'three';

export type SwivelPhase = 'typing' | 'turning' | 'idle';

export interface SwivelTargets {
  rigYaw: number;
  headYaw: number;
  headPitch: number;
}

export interface SwivelPose extends SwivelTargets {
  phase: SwivelPhase;
  handWeight: number;
}

const TYPING_DURATION = 5;
const SWIVEL_DURATION = 1.4;
const HAND_CROSSFADE_DURATION = 0.6;
const MAX_HEAD_YAW = THREE.MathUtils.degToRad(25);
const MAX_HEAD_PITCH = THREE.MathUtils.degToRad(10);

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function shortestAngle(from: number, to: number): number {
  const delta = to - from;
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

export function calculateSwivelTargets(
  pivot: THREE.Vector3,
  head: THREE.Vector3,
  camera: THREE.Vector3,
  startYaw: number,
): SwivelTargets {
  const dx = camera.x - pivot.x;
  const dz = camera.z - pivot.z;
  const desiredYaw = Math.atan2(dx, dz);
  const yawDelta = shortestAngle(startYaw, desiredYaw);
  const horizontal = Math.hypot(camera.x - head.x, camera.z - head.z);
  const desiredPitch = Math.atan2(camera.y - head.y, horizontal);

  return {
    rigYaw: startYaw + yawDelta * 0.8,
    headYaw: THREE.MathUtils.clamp(
      yawDelta * 0.2,
      -MAX_HEAD_YAW,
      MAX_HEAD_YAW,
    ),
    headPitch: THREE.MathUtils.clamp(
      desiredPitch,
      -MAX_HEAD_PITCH,
      MAX_HEAD_PITCH,
    ),
  };
}

export function getSwivelPose(
  elapsed: number,
  startYaw: number,
  target: SwivelTargets,
): SwivelPose {
  if (elapsed < TYPING_DURATION) {
    return {
      phase: 'typing',
      rigYaw: startYaw,
      headYaw: 0,
      headPitch: 0,
      handWeight: 1,
    };
  }

  if (elapsed >= TYPING_DURATION + SWIVEL_DURATION) {
    return { phase: 'idle', ...target, handWeight: 0 };
  }

  const swivelProgress = smoothstep(
    (elapsed - TYPING_DURATION) / SWIVEL_DURATION,
  );
  const handProgress = smoothstep(
    (elapsed - TYPING_DURATION) / HAND_CROSSFADE_DURATION,
  );

  return {
    phase: 'turning',
    rigYaw: THREE.MathUtils.lerp(startYaw, target.rigYaw, swivelProgress),
    headYaw: target.headYaw * swivelProgress,
    headPitch: target.headPitch * swivelProgress,
    handWeight: 1 - handProgress,
  };
}

export function createSwivelRig(
  scene: THREE.Scene,
  chair: THREE.Object3D,
  avatar: THREE.Object3D,
): THREE.Group {
  scene.updateMatrixWorld(true);
  const chairWorldPosition = chair.getWorldPosition(new THREE.Vector3());
  const rig = new THREE.Group();
  rig.name = 'swivelRig';
  rig.position.copy(chairWorldPosition);
  scene.add(rig);
  rig.attach(chair);
  rig.attach(avatar);

  return rig;
}
