import * as THREE from 'three';

export interface LookAngles {
  yaw: number;
  pitch: number;
}

export function calculateLookAngles(
  localDirection: THREE.Vector3,
  maxYaw: number,
  maxPitch: number,
): LookAngles {
  const yaw = Math.atan2(localDirection.x, localDirection.z);
  const pitch = Math.atan2(
    localDirection.y,
    Math.hypot(localDirection.x, localDirection.z),
  );

  return {
    yaw: THREE.MathUtils.clamp(yaw, -maxYaw, maxYaw),
    pitch: THREE.MathUtils.clamp(pitch, -maxPitch, maxPitch),
  };
}

export function dampAngle(
  current: number,
  target: number,
  response: number,
  delta: number,
): number {
  const alpha = 1 - Math.exp(-response * Math.max(delta, 0));
  return THREE.MathUtils.lerp(current, target, alpha);
}
