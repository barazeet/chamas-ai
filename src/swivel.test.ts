import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import {
  calculateSwivelTargets,
  createSwivelRig,
  getSwivelPose,
  shortestAngle,
} from './swivel';

const degrees = THREE.MathUtils.degToRad;

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

  test('clamps extreme head rotation', () => {
    const target = calculateSwivelTargets(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.5, 0),
      new THREE.Vector3(10, 20, 0),
      0,
    );

    expect(Math.abs(target.headYaw)).toBeLessThanOrEqual(degrees(25));
    expect(Math.abs(target.headPitch)).toBeLessThanOrEqual(degrees(10));
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

  test('returns the exact idle target at the end of the swivel', () => {
    expect(getSwivelPose(6.4, 0, target)).toEqual({
      phase: 'idle',
      ...target,
      handWeight: 0,
    });
  });
});

describe('createSwivelRig', () => {
  test('reparents the chair and avatar without changing world positions', () => {
    const scene = new THREE.Scene();
    const office = new THREE.Group();
    const chair = new THREE.Group();
    const avatar = new THREE.Group();
    office.position.set(4, -2, 7);
    chair.position.set(0.15, 0, -0.55);
    avatar.position.set(0.2, 0.1, -0.5);
    office.add(chair, avatar);
    scene.add(office);
    scene.updateMatrixWorld(true);

    const chairBefore = chair.getWorldPosition(new THREE.Vector3());
    const avatarBefore = avatar.getWorldPosition(new THREE.Vector3());
    const rig = createSwivelRig(scene, chair, avatar);
    const chairAfter = chair.getWorldPosition(new THREE.Vector3());
    const avatarAfter = avatar.getWorldPosition(new THREE.Vector3());

    expect(rig.name).toBe('swivelRig');
    expect(chair.parent).toBe(rig);
    expect(avatar.parent).toBe(rig);
    expect(chairAfter.distanceTo(chairBefore)).toBeLessThan(1e-10);
    expect(avatarAfter.distanceTo(avatarBefore)).toBeLessThan(1e-10);
  });
});
