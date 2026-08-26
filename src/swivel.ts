import * as THREE from 'three';

export type SwivelPhase = 'typing' | 'turning' | 'idle';

export interface SwivelTargets {
  rigYaw: number;
}

export interface SwivelPose extends SwivelTargets {
  phase: SwivelPhase;
  handWeight: number;
  lookWeight: number;
}

const TYPING_DURATION = 5;
const SWIVEL_DURATION = 1.4;
const HAND_CROSSFADE_DURATION = 0.6;

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

export function splitVisibleDelta(
  previousElapsed: number,
  delta: number,
  transitionAt = TYPING_DURATION,
) {
  const beforeTransition = Math.min(
    Math.max(transitionAt - previousElapsed, 0),
    delta,
  );
  return {
    beforeTransition,
    afterTransition: delta - beforeTransition,
    reachesTransition:
      previousElapsed < transitionAt &&
      previousElapsed + delta >= transitionAt,
  };
}

export function calculateSwivelTargets(
  pivot: THREE.Vector3,
  camera: THREE.Vector3,
  startYaw: number,
): SwivelTargets {
  const dx = camera.x - pivot.x;
  const dz = camera.z - pivot.z;
  const planarDistance = Math.hypot(dx, dz);
  const yawDelta =
    planarDistance <= 1e-10
      ? 0
      : shortestAngle(startYaw, Math.atan2(dx, dz));

  return {
    rigYaw: startYaw + yawDelta * 0.8,
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
      handWeight: 1,
      lookWeight: 0,
    };
  }

  if (elapsed >= TYPING_DURATION + SWIVEL_DURATION) {
    return { phase: 'idle', ...target, handWeight: 0, lookWeight: 1 };
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
    handWeight: 1 - handProgress,
    lookWeight: swivelProgress,
  };
}

function hasNonUniformSourceAncestry(
  object: THREE.Object3D,
  scene: THREE.Scene,
): boolean {
  for (
    let ancestor = object.parent;
    ancestor && ancestor !== scene;
    ancestor = ancestor.parent
  ) {
    const { x, y, z } = ancestor.scale;
    if (
      Math.abs(Math.abs(x) - Math.abs(y)) > 1e-10 ||
      Math.abs(Math.abs(y) - Math.abs(z)) > 1e-10
    ) {
      return true;
    }
  }
  return false;
}

export function createSwivelRig(
  scene: THREE.Scene,
  chair: THREE.Object3D,
  avatar: THREE.Object3D,
): THREE.Group {
  scene.updateMatrixWorld(true);
  for (const [label, object] of [
    ['chair', chair],
    ['avatar', avatar],
  ] as const) {
    if (hasNonUniformSourceAncestry(object, scene)) {
      throw new Error(
        `Cannot create swivel rig: ${label} has non-uniformly scaled source ancestry`,
      );
    }
  }

  const chairWorldPosition = chair.getWorldPosition(new THREE.Vector3());
  const rig = new THREE.Group();
  rig.name = 'swivelRig';
  rig.position.copy(scene.worldToLocal(chairWorldPosition.clone()));
  scene.add(rig);
  rig.attach(chair);
  rig.attach(avatar);

  return rig;
}
