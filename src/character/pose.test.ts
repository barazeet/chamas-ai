import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applySeatedPose } from './pose';

describe('applySeatedPose', () => {
  it('rotates known bones and leaves unknown ones untouched', () => {
    const root = new THREE.Group();
    const thigh = new THREE.Bone();
    thigh.name = 'LeftUpLeg';
    root.add(thigh);

    applySeatedPose(root);

    expect(thigh.rotation.x).toBeGreaterThan(0.5);
  });

  it('does not throw on a rig with no matching bones (placeholder path)', () => {
    expect(() => applySeatedPose(new THREE.Group())).not.toThrow();
  });
});
