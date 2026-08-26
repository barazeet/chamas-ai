import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import {
  calculateSwivelTargets,
  createSwivelRig,
  getSwivelPose,
  shortestAngle,
} from './swivel';

const degrees = THREE.MathUtils.degToRad;

function expectMatrixClose(
  actual: THREE.Matrix4,
  expected: THREE.Matrix4,
): void {
  actual.elements.forEach((value, index) => {
    expect(value).toBeCloseTo(expected.elements[index], 10);
  });
}

describe('shortestAngle', () => {
  test('crosses the wrap boundary by the shortest route', () => {
    expect(shortestAngle(degrees(170), degrees(-170))).toBeCloseTo(
      degrees(20),
    );
  });
});

describe('calculateSwivelTargets', () => {
  test('splits horizontal camera tracking between the rig and head', () => {
    const target = calculateSwivelTargets(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.5, 0),
      new THREE.Vector3(1, 1.5, 1),
      0,
    );

    expect(target.rigYaw).toBeCloseTo(degrees(36));
    expect(target.headYaw).toBeCloseTo(degrees(9));
    expect(target.headPitch).toBeCloseTo(0);
  });

  test('preserves yaw when the camera has no planar direction', () => {
    const startYaw = degrees(70);
    const target = calculateSwivelTargets(
      new THREE.Vector3(2, 0, -3),
      new THREE.Vector3(2, 1.5, -3),
      new THREE.Vector3(2 + 1e-12, 4, -3),
      startYaw,
    );

    expect(target.rigYaw).toBe(startYaw);
    expect(target.headYaw).toBe(0);
  });

  test('clamps positive and negative head rotation exactly', () => {
    const positive = calculateSwivelTargets(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.5, 100, -Math.sqrt(0.75)),
      0,
    );
    const negative = calculateSwivelTargets(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.5, -100, -Math.sqrt(0.75)),
      0,
    );

    expect(positive.headYaw).toBe(degrees(25));
    expect(positive.headPitch).toBe(degrees(10));
    expect(negative.headYaw).toBe(degrees(-25));
    expect(negative.headPitch).toBe(degrees(-10));
  });
});

describe('getSwivelPose', () => {
  const target = {
    rigYaw: degrees(36),
    headYaw: degrees(9),
    headPitch: degrees(6),
  };

  test('returns the exact typing pose before five seconds', () => {
    expect(getSwivelPose(4.99, 0, target)).toEqual({
      phase: 'typing',
      rigYaw: 0,
      headYaw: 0,
      headPitch: 0,
      handWeight: 1,
    });
  });

  test('smoothly turns and releases the hands after five seconds', () => {
    const pose = getSwivelPose(5.3, 0, target);

    expect(pose.phase).toBe('turning');
    expect(pose.rigYaw).toBeGreaterThan(0);
    expect(pose.rigYaw).toBeLessThan(target.rigYaw);
    expect(pose.handWeight).toBeGreaterThan(0);
    expect(pose.handWeight).toBeLessThan(1);
  });

  test.each([
    { elapsed: 5, phase: 'turning', handWeight: 1 },
    { elapsed: 5.6, phase: 'turning', handWeight: 0 },
    { elapsed: 6.4, phase: 'idle', handWeight: 0 },
  ] as const)(
    'returns exact phase and hand weight at $elapsed seconds',
    ({ elapsed, phase, handWeight }) => {
      const pose = getSwivelPose(elapsed, 0, target);

      expect(pose.phase).toBe(phase);
      expect(pose.handWeight).toBe(handWeight);
    },
  );

  test('returns the exact idle target at the end of the swivel', () => {
    expect(getSwivelPose(6.4, 0, target)).toEqual({
      phase: 'idle',
      ...target,
      handWeight: 0,
    });
  });
});

describe('createSwivelRig', () => {
  test('preserves full world transforms under ordinary TRS ancestry', () => {
    const scene = new THREE.Scene();
    const office = new THREE.Group();
    const chair = new THREE.Group();
    const avatar = new THREE.Group();
    scene.position.set(-3, 1, 2);
    scene.rotation.set(0.1, -0.2, 0.05);
    scene.scale.setScalar(1.25);
    office.position.set(4, -2, 7);
    office.rotation.set(-0.15, 0.4, 0.2);
    office.scale.setScalar(1.5);
    chair.position.set(0.15, 0, -0.55);
    chair.rotation.set(0.05, -0.3, 0.1);
    avatar.position.set(0.2, 0.1, -0.5);
    avatar.rotation.set(-0.1, 0.25, -0.05);
    avatar.scale.setScalar(0.9);
    office.add(chair, avatar);
    scene.add(office);
    scene.updateMatrixWorld(true);

    const chairBefore = chair.matrixWorld.clone();
    const avatarBefore = avatar.matrixWorld.clone();
    const pivotBefore = chair.getWorldPosition(new THREE.Vector3());
    const rig = createSwivelRig(scene, chair, avatar);
    scene.updateMatrixWorld(true);

    expect(rig.name).toBe('swivelRig');
    expect(chair.parent).toBe(rig);
    expect(avatar.parent).toBe(rig);
    expect(
      rig.getWorldPosition(new THREE.Vector3()).distanceTo(pivotBefore),
    ).toBeLessThan(1e-10);
    expectMatrixClose(chair.matrixWorld, chairBefore);
    expectMatrixClose(avatar.matrixWorld, avatarBefore);
  });

  test('rejects non-uniformly scaled source ancestry', () => {
    const scene = new THREE.Scene();
    const office = new THREE.Group();
    const chair = new THREE.Group();
    const avatar = new THREE.Group();
    office.scale.set(2, 1, 1);
    office.add(chair, avatar);
    scene.add(office);

    expect(() => createSwivelRig(scene, chair, avatar)).toThrow(
      /non-uniformly scaled source ancestry/i,
    );
    expect(chair.parent).toBe(office);
    expect(avatar.parent).toBe(office);
  });
});
