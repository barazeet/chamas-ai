import { describe, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import {
  applyCameraLook,
  applyPoseAdjustment,
  loadClip,
  type AvatarHandle,
  type PoseAdjustment,
} from './avatar';

const loaderState = vi.hoisted(() => ({
  fbx: undefined as THREE.Group | undefined,
  retargeted: undefined as THREE.AnimationClip | undefined,
}));

vi.mock('three/addons/loaders/FBXLoader.js', () => ({
  FBXLoader: class {
    async loadAsync(): Promise<THREE.Group> {
      return loaderState.fbx!;
    }
  },
}));

vi.mock('three/addons/utils/SkeletonUtils.js', () => ({
  retargetClip: () => loaderState.retargeted!,
}));

const noAdjustment: PoseAdjustment = {
  handWeight: 0,
};

function avatarWith(values: Partial<AvatarHandle>): AvatarHandle {
  return values as AvatarHandle;
}

describe('applyPoseAdjustment', () => {
  test('lifts only the right wrist in the idle pose', () => {
    const leftForearm = new THREE.Bone();
    const rightForearm = new THREE.Bone();
    const axis = new THREE.Vector3(1, 0, 0);

    applyPoseAdjustment(
      avatarWith({
        handAdjust: [
          { bone: leftForearm, axis, angle: 0.2 },
          { bone: rightForearm, axis, angle: 0.2 },
        ],
        rightForearm,
      }),
      noAdjustment,
    );

    const expected = new THREE.Quaternion().setFromAxisAngle(axis, -0.15);
    expect(rightForearm.quaternion.equals(expected)).toBe(true);
    expect(leftForearm.quaternion.equals(new THREE.Quaternion())).toBe(true);
  });

  test('linearly blends the right wrist from typing to idle correction', () => {
    const rightForearm = new THREE.Bone();
    const axis = new THREE.Vector3(1, 0, 0);

    applyPoseAdjustment(
      avatarWith({
        handAdjust: [{ bone: rightForearm, axis, angle: 0.2 }],
        rightForearm,
      }),
      { handWeight: 0.5 },
    );

    const expected = new THREE.Quaternion().setFromAxisAngle(
      axis,
      0.2 * 0.5 + -0.15 * 0.5,
    );
    expect(rightForearm.quaternion.angleTo(expected)).toBeCloseTo(0);
  });

  test('scales typing correction for both hands by hand weight', () => {
    const leftForearm = new THREE.Bone();
    const rightForearm = new THREE.Bone();
    const axis = new THREE.Vector3(1, 0, 0);

    applyPoseAdjustment(
      avatarWith({
        handAdjust: [
          { bone: leftForearm, axis, angle: 0.2 },
          { bone: rightForearm, axis, angle: 0.2 },
        ],
      }),
      { handWeight: 0.25 },
    );

    const expected = new THREE.Quaternion().setFromAxisAngle(axis, 0.05);
    expect(leftForearm.quaternion.angleTo(expected)).toBeCloseTo(0);
    expect(rightForearm.quaternion.angleTo(expected)).toBeCloseTo(0);
  });
});

describe('applyCameraLook', () => {
  function lookAvatar(eyes: 'both' | 'left' = 'both'): AvatarHandle {
    const root = new THREE.Group();
    const head = new THREE.Bone();
    const leftEye = new THREE.Bone();
    const rightEye = new THREE.Bone();
    head.position.y = 1;
    leftEye.position.set(-0.03, 0.05, 0.1);
    rightEye.position.set(0.03, 0.05, 0.1);
    head.add(leftEye);
    if (eyes === 'both') head.add(rightEye);
    root.add(head);
    root.updateMatrixWorld(true);
    return avatarWith({
      root,
      head,
      leftEye,
      rightEye: eyes === 'both' ? rightEye : undefined,
      lookState: { headYaw: 0, headPitch: 0, eyeYaw: 0, eyePitch: 0 },
    });
  }

  test('applies exactly equal conjugate corrections to both eyes', () => {
    const avatar = lookAvatar();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 1.5, 3);
    camera.updateMatrixWorld(true);

    applyCameraLook(avatar, camera, 1, 1);

    expect(avatar.leftEye!.quaternion.equals(avatar.rightEye!.quaternion)).toBe(
      true,
    );
    expect(avatar.leftEye!.quaternion.equals(new THREE.Quaternion())).toBe(
      false,
    );
  });

  test('tracks with the head but leaves a lone eye untouched', () => {
    const avatar = lookAvatar('left');
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(1, 1.5, 3);
    camera.updateMatrixWorld(true);
    const eyeBefore = avatar.leftEye!.quaternion.clone();

    applyCameraLook(avatar, camera, 1, 1);

    expect(avatar.head!.quaternion.equals(new THREE.Quaternion())).toBe(false);
    expect(avatar.leftEye!.quaternion.equals(eyeBefore)).toBe(true);
  });

  test('raises the current animated head gaze toward an elevated camera', () => {
    const avatar = lookAvatar();
    avatar.head!.rotation.y = 0.35;
    avatar.root.updateMatrixWorld(true);
    const animatedGaze = new THREE.Vector3(0, 0, 1).applyQuaternion(
      avatar.head!.getWorldQuaternion(new THREE.Quaternion()),
    );
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(2, 3, 4);
    camera.updateMatrixWorld(true);

    applyCameraLook(avatar, camera, 1, 1);

    const correctedGaze = new THREE.Vector3(0, 0, 1).applyQuaternion(
      avatar.head!.getWorldQuaternion(new THREE.Quaternion()),
    );
    expect(correctedGaze.y).toBeGreaterThan(animatedGaze.y);
  });
});

describe('loadClip', () => {
  test('isolates seat correction from actions active on the avatar mixer', async () => {
    const source = new THREE.Group();
    const sourceHips = new THREE.Bone();
    sourceHips.name = 'mixamorigHips';
    sourceHips.position.y = 1;
    source.add(sourceHips);
    source.animations = [new THREE.AnimationClip('source', 1, [])];
    loaderState.fbx = source;

    const root = new THREE.Group();
    const skin = new THREE.SkinnedMesh();
    const hips = new THREE.Bone();
    hips.name = 'Hips';
    skin.add(hips);
    skin.bind(new THREE.Skeleton([hips]));
    root.add(skin);
    const mixer = new THREE.AnimationMixer(skin);
    const activeClip = new THREE.AnimationClip('active', 1, [
      new THREE.VectorKeyframeTrack(
        '.bones[Hips].position',
        [0, 1],
        [10, 10, 10, 10, 10, 10],
      ),
    ]);
    const activeAction = mixer.clipAction(activeClip).play();
    mixer.update(0);

    const hipTrack = new THREE.VectorKeyframeTrack(
      '.bones[Hips].position',
      [0, 1],
      [0, 1, 0, 0, 1, 0],
    );
    loaderState.retargeted = new THREE.AnimationClip('retargeted', 1, [
      hipTrack,
    ]);
    const uncacheAction = vi.spyOn(mixer, 'uncacheAction');
    const avatar = avatarWith({ root, skin, mixer, handAdjust: [] });

    const action = await loadClip(avatar, '/idle.fbx');

    expect(hipTrack.values[0]).toBeCloseTo(0.15);
    expect(hipTrack.values[1]).toBeCloseTo(0.53);
    expect(hipTrack.values[2]).toBeCloseTo(-0.55);
    expect(activeAction.isRunning()).toBe(true);
    expect(action.isRunning()).toBe(false);
    expect(action.getMixer()).toBe(mixer);
    expect(uncacheAction).not.toHaveBeenCalled();
  });
});
