import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { IdleAnimator, type IdleTarget } from './idle';

function makeMorphMesh(blinkName: string): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.morphAttributes.position = [new THREE.BufferAttribute(new Float32Array(9), 3)];
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.morphTargetDictionary = { [blinkName]: 0 };
  mesh.morphTargetInfluences = [0];
  return mesh;
}

function makeTarget(): IdleTarget & { mesh: THREE.Mesh } {
  const mesh = makeMorphMesh('eyeBlinkLeft');
  const object = new THREE.Group();
  object.add(mesh);
  return {
    object,
    morphMeshes: [mesh],
    morphMeshByName: new Map([[mesh.name, mesh]]),
    mesh,
  };
}

describe('IdleAnimator', () => {
  it('breathes (scale oscillates around 1)', () => {
    const target = makeTarget();
    const idle = new IdleAnimator(target);
    idle.update(0.5);
    const a = target.object.scale.y;
    idle.update(0.5);
    const b = target.object.scale.y;
    expect(a).not.toBe(1);
    expect(b).not.toBe(a);
  });

  it('blinks periodically then reopens eyes', () => {
    const target = makeTarget();
    const idle = new IdleAnimator(target);
    let sawBlink = false;
    let reopened = false;
    for (let i = 0; i < 1200; i++) {
      idle.update(1 / 60);
      const v = target.mesh.morphTargetInfluences![0];
      if (!sawBlink && v > 0.5) sawBlink = true;
      if (sawBlink && v < 0.5) {
        reopened = true;
        break;
      }
    }
    expect(sawBlink).toBe(true);
    expect(reopened).toBe(true);
  });

  it('works with no morph targets (placeholder path)', () => {
    const object = new THREE.Group();
    const idle = new IdleAnimator({ object, morphMeshes: [], morphMeshByName: new Map() });
    expect(() => idle.update(0.5)).not.toThrow();
  });

  it('drives blinks across multiple morph meshes', () => {
    const meshA = makeMorphMesh('eyeBlinkLeft');
    const meshB = makeMorphMesh('eyesClosed');
    const object = new THREE.Group();
    object.add(meshA, meshB);
    const idle = new IdleAnimator({
      object,
      morphMeshes: [meshA, meshB],
      morphMeshByName: new Map([
        [meshA.name, meshA],
        [meshB.name, meshB],
      ]),
    });

    let sawBlinkA = false;
    let sawBlinkB = false;
    for (let i = 0; i < 600; i++) {
      idle.update(1 / 60);
      if (meshA.morphTargetInfluences![0] > 0.5) sawBlinkA = true;
      if (meshB.morphTargetInfluences![0] > 0.5) sawBlinkB = true;
    }
    expect(sawBlinkA).toBe(true);
    expect(sawBlinkB).toBe(true);
  });

  it('oscillates around the base pose, not the origin', () => {
    const target = makeTarget();
    target.object.position.y = 0.48;
    target.object.scale.y = 2;
    const idle = new IdleAnimator(target);

    let minY = Infinity;
    let maxY = -Infinity;
    let minScale = Infinity;
    let maxScale = -Infinity;
    for (let i = 0; i < 600; i++) {
      idle.update(1 / 60);
      minY = Math.min(minY, target.object.position.y);
      maxY = Math.max(maxY, target.object.position.y);
      minScale = Math.min(minScale, target.object.scale.y);
      maxScale = Math.max(maxScale, target.object.scale.y);
    }

    // Position oscillates around the 0.48 base
    expect(minY).toBeGreaterThan(0.48 - 0.05);
    expect(maxY).toBeLessThan(0.48 + 0.05);
    expect(minY).toBeLessThan(0.48);
    expect(maxY).toBeGreaterThan(0.48);

    // Scale oscillates around the non-1 base (2), ±0.8%
    expect(minScale).toBeGreaterThan(2 * (1 - 0.008) - 1e-6);
    expect(maxScale).toBeLessThan(2 * (1 + 0.008) + 1e-6);
    expect(minScale).toBeLessThan(2);
    expect(maxScale).toBeGreaterThan(2);
  });
});
