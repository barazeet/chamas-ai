import * as THREE from 'three';

// Bone rotations (radians, XYZ euler) that take the Avaturn rig from its
// standing T-pose to a relaxed seated pose facing the visitor. The rig uses
// Mixamo-style bone names. Values were derived empirically from the live
// scene (foot lands at floor level, hands rest at lap height).
const SEAT_ROTATIONS: Record<string, [number, number, number]> = {
  // thighs forward (horizontal)
  LeftUpLeg: [1.35, 0, 0.08],
  RightUpLeg: [1.35, 0, -0.08],
  // knees bent, shins down to the floor
  LeftLeg: [1.3, 0, 0],
  RightLeg: [1.3, 0, 0],
  // arms hanging down from T-pose
  LeftArm: [1.2, 0, 0],
  RightArm: [1.2, 0, 0],
  // forearms slightly inward, hands resting toward the lap
  LeftForeArm: [0.5, 0, 0],
  RightForeArm: [0.5, 0, 0],
};

/**
 * Applies a seated pose to the avatar's skeleton. Bones not found are
 * skipped silently (placeholder avatars have no skeleton).
 */
export function applySeatedPose(root: THREE.Object3D): void {
  for (const [name, [x, y, z]] of Object.entries(SEAT_ROTATIONS)) {
    const bone = root.getObjectByName(name);
    if (bone) bone.rotation.set(x, y, z);
  }
}
