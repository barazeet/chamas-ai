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
  it('stays fully planted — no position, rotation or scale motion', () => {
    const target = makeTarget();
    target.object.position.y = 0.48;
    target.object.scale.y = 2;
    target.object.rotation.y = 0.7;
    const idle = new IdleAnimator(target);

    for (let i = 0; i < 600; i++) idle.update(1 / 60);

    expect(target.object.position.y).toBe(0.48);
    expect(target.object.scale.y).toBe(2);
    expect(target.object.rotation.y).toBe(0.7);
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
});
