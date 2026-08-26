import { describe, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import {
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
  headYaw: 0,
  headPitch: 0,
};

function avatarWith(
  values: Pick<AvatarHandle, 'handAdjust' | 'head'>,
): AvatarHandle {
  return values as AvatarHandle;
}

describe('applyPoseAdjustment', () => {
  test('positive head pitch raises the avatar forward vector', () => {
    const head = new THREE.Bone();

    applyPoseAdjustment(avatarWith({ handAdjust: [], head }), {
      ...noAdjustment,
      headPitch: 0.2,
    });

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
      head.quaternion,
    );
    expect(forward.y).toBeGreaterThan(0);
  });

  test('scales hand correction by hand weight', () => {
    const bone = new THREE.Bone();
    const axis = new THREE.Vector3(1, 0, 0);

    applyPoseAdjustment(
      avatarWith({
        handAdjust: [{ bone, axis, angle: 0.2 }],
        head: undefined,
      }),
      { ...noAdjustment, handWeight: 0.25 },
    );

    const expected = new THREE.Quaternion().setFromAxisAngle(axis, 0.05);
    expect(bone.quaternion.angleTo(expected)).toBeCloseTo(0);
  });

  test('is safe when the avatar has no head bone', () => {
    expect(() =>
      applyPoseAdjustment(
        avatarWith({ handAdjust: [], head: undefined }),
        noAdjustment,
      ),
    ).not.toThrow();
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
    const avatar = { root, skin, mixer, handAdjust: [] } as AvatarHandle;

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
