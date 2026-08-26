import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { calculateLookAngles, dampAngle, type LookAngles } from './look';

export interface HandAdjust {
  bone: THREE.Bone;
  axis: THREE.Vector3;
  angle: number;
}

export interface AvatarHandle {
  root: THREE.Group;
  skin: THREE.SkinnedMesh;
  mixer: THREE.AnimationMixer;
  handAdjust: HandAdjust[];
  rightForearm?: THREE.Bone;
  head?: THREE.Bone;
  leftEye?: THREE.Bone;
  rightEye?: THREE.Bone;
  lookState: LookState;
}

export interface LookState {
  headYaw: number;
  headPitch: number;
  eyeYaw: number;
  eyePitch: number;
}

export interface PoseAdjustment {
  handWeight: number;
}

/** Seat center at floor level, measured from the live scene. */
const CHAIR_SPOT = new THREE.Vector3(0.15, 0, -0.55);
/** Chair faces +z (toward the desk). Adjust if the model's forward differs. */
const CHAIR_YAW = 0;
/** Where the hips bone should sit: seat center at butt height. */
const SEAT_TARGET = new THREE.Vector3(0.15, 0.53, -0.55);

export async function loadAvatar(scene: THREE.Scene): Promise<AvatarHandle> {
  const gltf = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .loadAsync('/models/avatar.glb');
  const root = gltf.scene;
  root.name = 'avatar';
  root.position.copy(CHAIR_SPOT);
  root.rotation.y = CHAIR_YAW;
  let skin: THREE.SkinnedMesh | undefined;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // skinned meshes pop out otherwise
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && !skin) {
      skin = o as THREE.SkinnedMesh;
    }
  });
  if (!skin) throw new Error('avatar skinned mesh missing');
  const rightForearm = root.getObjectByName('RightForeArm') as
    | THREE.Bone
    | undefined;
  const head = root.getObjectByName('Head') as THREE.Bone | undefined;
  const leftEye = root.getObjectByName('LeftEye') as THREE.Bone | undefined;
  const rightEye = root.getObjectByName('RightEye') as THREE.Bone | undefined;
  scene.add(root);
  // The mixer MUST live on the SkinnedMesh: retargetClip emits tracks as
  // '.bones[Name].prop', which only bind against a .skeleton.bones array.
  const mixer = new THREE.AnimationMixer(skin);
  // Post-mixer hand adjustment: pitching the forearms lowers the hands.
  // 0.2 rad lowers the wrists ~3cm so the fingers rest on the keys
  // (measured live against the desk's keyboard; ~1cm per 0.1 rad).
  const handAdjust: HandAdjust[] = [];
  for (const name of ['LeftForeArm', 'RightForeArm']) {
    const bone = root.getObjectByName(name) as THREE.Bone | undefined;
    if (bone)
      handAdjust.push({ bone, axis: AXIS_X, angle: 0.2 });
  }
  return {
    root,
    skin,
    mixer,
    handAdjust,
    rightForearm,
    head,
    leftEye,
    rightEye,
    lookState: { headYaw: 0, headPitch: 0, eyeYaw: 0, eyePitch: 0 },
  };
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const IDLE_RIGHT_FOREARM_ANGLE = -0.15;
const adjustQuat = new THREE.Quaternion();
/** Apply AFTER mixer.update — the mixer overwrites bone quats every frame. */
export function applyPoseAdjustment(
  avatar: AvatarHandle,
  adjustment: PoseAdjustment,
): void {
  for (const a of avatar.handAdjust) {
    if (!a.angle) continue;
    a.bone.quaternion.multiply(
      adjustQuat.setFromAxisAngle(a.axis, a.angle * adjustment.handWeight),
    );
  }
  if (avatar.rightForearm) {
    avatar.rightForearm.quaternion.multiply(
      adjustQuat.setFromAxisAngle(
        AXIS_X,
        IDLE_RIGHT_FOREARM_ANGLE * (1 - adjustment.handWeight),
      ),
    );
  }
}

const HEAD_MAX_YAW = THREE.MathUtils.degToRad(30);
const HEAD_MAX_PITCH = THREE.MathUtils.degToRad(25);
const HEAD_RESPONSE = 6;
const EYE_MAX_YAW = THREE.MathUtils.degToRad(12);
const EYE_MAX_PITCH = THREE.MathUtils.degToRad(8);
const EYE_RESPONSE = 12;
const cameraWorld = new THREE.Vector3();
const headLocalDirection = new THREE.Vector3();
const leftEyeWorld = new THREE.Vector3();
const rightEyeWorld = new THREE.Vector3();
const eyeDirection = new THREE.Vector3();
const headWorldQuaternion = new THREE.Quaternion();
const lookQuaternion = new THREE.Quaternion();
const lookEuler = new THREE.Euler();
const headLookAngles: LookAngles = { yaw: 0, pitch: 0 };
const eyeLookAngles: LookAngles = { yaw: 0, pitch: 0 };

/** Apply AFTER mixer.update so tracking is additive to the animated pose. */
export function applyCameraLook(
  avatar: AvatarHandle,
  camera: THREE.Camera,
  lookWeight: number,
  delta: number,
): void {
  const { head, lookState } = avatar;
  if (!head) return;

  camera.getWorldPosition(cameraWorld);
  headLocalDirection.copy(cameraWorld);
  head.worldToLocal(headLocalDirection);
  if (headLocalDirection.lengthSq() > 0) headLocalDirection.normalize();
  const headTarget = calculateLookAngles(
    headLocalDirection,
    HEAD_MAX_YAW,
    HEAD_MAX_PITCH,
    headLookAngles,
  );
  lookState.headYaw = dampAngle(
    lookState.headYaw,
    headTarget.yaw * lookWeight,
    HEAD_RESPONSE,
    delta,
  );
  lookState.headPitch = dampAngle(
    lookState.headPitch,
    headTarget.pitch * lookWeight,
    HEAD_RESPONSE,
    delta,
  );
  head.quaternion.multiply(
    lookQuaternion.setFromEuler(
      lookEuler.set(-lookState.headPitch, lookState.headYaw, 0),
    ),
  );
  head.updateWorldMatrix(true, true);

  const { leftEye, rightEye } = avatar;
  if (!leftEye || !rightEye) return;

  leftEye.getWorldPosition(leftEyeWorld);
  rightEye.getWorldPosition(rightEyeWorld);
  eyeDirection
    .copy(leftEyeWorld)
    .add(rightEyeWorld)
    .multiplyScalar(0.5);
  eyeDirection.subVectors(cameraWorld, eyeDirection);
  head.getWorldQuaternion(headWorldQuaternion).invert();
  eyeDirection.applyQuaternion(headWorldQuaternion);
  if (eyeDirection.lengthSq() > 0) eyeDirection.normalize();
  const eyeTarget = calculateLookAngles(
    eyeDirection,
    EYE_MAX_YAW,
    EYE_MAX_PITCH,
    eyeLookAngles,
  );
  lookState.eyeYaw = dampAngle(
    lookState.eyeYaw,
    eyeTarget.yaw * lookWeight,
    EYE_RESPONSE,
    delta,
  );
  lookState.eyePitch = dampAngle(
    lookState.eyePitch,
    eyeTarget.pitch * lookWeight,
    EYE_RESPONSE,
    delta,
  );
  lookQuaternion.setFromEuler(
    lookEuler.set(-lookState.eyePitch, lookState.eyeYaw, 0),
  );
  leftEye.quaternion.multiply(lookQuaternion);
  rightEye.quaternion.multiply(lookQuaternion);
}

/**
 * Loads a Mixamo FBX clip and retargets it onto the avatar's skeleton.
 * The avatar uses Mixamo bone names without the 'mixamorig:' prefix, so the
 * name map is mechanical. Unit scale is derived from both hips' rest
 * heights — never hardcoded.
 */
export async function loadClip(
  avatar: AvatarHandle,
  url: string,
): Promise<THREE.AnimationAction> {
  const fbx = await new FBXLoader().loadAsync(url);
  const clip = fbx.animations[0];
  if (!clip) throw new Error(`no animation in ${url}`);

  const names: Record<string, string> = {};
  avatar.root.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      const src = `mixamorig${o.name}`; // FBXLoader strips the colon
      if (fbx.getObjectByName(src)) names[o.name] = src;
    }
  });

  fbx.updateMatrixWorld(true);
  avatar.root.updateMatrixWorld(true);
  const srcHip = fbx.getObjectByName('mixamorigHips')!;
  const tgtHip = avatar.root.getObjectByName('Hips')!;
  const srcY = srcHip.getWorldPosition(new THREE.Vector3()).y;
  const tgtY = tgtHip.getWorldPosition(new THREE.Vector3()).y;
  const scale = tgtY / srcY;

  // retargetClip reads .skeleton — the avatar's skinned mesh provides it;
  // for the source use its skinned mesh if the FBX has one, else a Skeleton
  let sourceSkin: THREE.SkinnedMesh | undefined;
  fbx.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && !sourceSkin) {
      sourceSkin = o as THREE.SkinnedMesh;
    }
  });
  let sourceRef: THREE.SkinnedMesh | THREE.Skeleton = sourceSkin!;
  if (!sourceRef) {
    const bones: THREE.Bone[] = [];
    fbx.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
    });
    sourceRef = new THREE.Skeleton(bones);
  }

  const retargeted = SkeletonUtils.retargetClip(avatar.skin, sourceRef, clip, {
    hip: 'mixamorigHips',
    names,
    scale,
  });

  // retargetClip bakes hip positions that ignore wherever the avatar root
  // was placed (preserveBoneMatrix identities the skin's world matrix), so
  // the character lands at a fixed offset from the clip origin instead of
  // on the chair. Correct empirically: pose frame 0, measure the hips,
  // shift every hip keyframe by the delta to the seat (in the hips'
  // parent-local space) — relative typing motion is preserved.
  const hipTrack = retargeted.tracks.find((t) =>
    t.name.endsWith('].position'),
  ) as THREE.VectorKeyframeTrack | undefined;
  const hipsBone = avatar.root.getObjectByName('Hips') as THREE.Bone;
  if (hipTrack && hipsBone) {
    const probeMixer = new THREE.AnimationMixer(avatar.skin);
    const probe = probeMixer.clipAction(retargeted);
    probe.play();
    probeMixer.update(0);
    avatar.root.updateMatrixWorld(true);
    const hipsWorld = hipsBone.getWorldPosition(new THREE.Vector3());
    probe.stop();
    probeMixer.uncacheAction(retargeted);
    probeMixer.uncacheRoot(avatar.skin);
    const deltaWorld = SEAT_TARGET.clone().sub(hipsWorld);
    const inv = new THREE.Matrix4()
      .copy((hipsBone.parent as THREE.Object3D).matrixWorld)
      .invert();
    const deltaLocal = deltaWorld.applyMatrix4(inv).sub(
      new THREE.Vector3().setFromMatrixPosition(inv),
    );
    const v = hipTrack.values;
    for (let i = 0; i < v.length; i += 3) {
      v[i] += deltaLocal.x;
      v[i + 1] += deltaLocal.y;
      v[i + 2] += deltaLocal.z;
    }
  }

  const clipAction = avatar.mixer.clipAction(retargeted);
  clipAction.setLoop(THREE.LoopRepeat, Infinity);
  return clipAction;
}
