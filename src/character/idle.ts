import * as THREE from 'three';

export interface IdleTarget {
  object: THREE.Object3D;
  morphMesh: THREE.Mesh | null;
  morphMeshes?: THREE.Mesh[];
}

const BLINK_INTERVAL = 3.2;
const BLINK_DURATION = 0.18;
const BLINK_NAMES = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed'];

export class IdleAnimator {
  private t = 0;
  private nextBlinkAt = BLINK_INTERVAL;
  private blinkTargets: { mesh: THREE.Mesh; index: number }[] = [];
  private baseRotationY: number;
  private basePositionY: number;

  constructor(private target: IdleTarget) {
    this.baseRotationY = target.object.rotation.y;
    this.basePositionY = target.object.position.y;
    const meshes = target.morphMeshes ?? (target.morphMesh ? [target.morphMesh] : []);
    for (const mesh of meshes) {
      const dict = mesh.morphTargetDictionary ?? {};
      for (const name of BLINK_NAMES) {
        if (dict[name] !== undefined) this.blinkTargets.push({ mesh, index: dict[name] });
      }
    }
  }

  update(dt: number): void {
    this.t += dt;
    const o = this.target.object;
    o.scale.y = 1 + Math.sin(this.t * 1.6) * 0.008;
    o.rotation.y = this.baseRotationY + Math.sin(this.t * 0.35) * 0.03;
    o.position.y = this.basePositionY + Math.sin(this.t * 1.6) * 0.004;

    if (this.blinkTargets.length === 0) return;
    const sinceBlinkStart = this.t - this.nextBlinkAt;
    let influence = 0;
    if (sinceBlinkStart >= 0 && sinceBlinkStart < BLINK_DURATION) {
      influence = Math.sin((sinceBlinkStart / BLINK_DURATION) * Math.PI);
    } else if (sinceBlinkStart >= BLINK_DURATION) {
      this.nextBlinkAt = this.t + BLINK_INTERVAL * (0.7 + Math.random() * 0.8);
    }
    for (const { mesh, index } of this.blinkTargets) {
      mesh.morphTargetInfluences![index] = influence;
    }
  }
}
