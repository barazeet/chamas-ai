import * as THREE from 'three';

export interface IdleTarget {
  object: THREE.Object3D;
  morphMeshes: THREE.Mesh[];
  morphMeshByName: Map<string, THREE.Mesh>;
}

const BLINK_INTERVAL = 3.2;
const BLINK_DURATION = 0.18;
const BLINK_NAMES = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed'];

export class IdleAnimator {
  private t = 0;
  private nextBlinkAt = BLINK_INTERVAL;
  private blinkTargets: { mesh: THREE.Mesh; index: number }[] = [];

  constructor(private target: IdleTarget) {
    for (const mesh of target.morphMeshes) {
      const dict = mesh.morphTargetDictionary ?? {};
      for (const name of BLINK_NAMES) {
        if (dict[name] !== undefined) this.blinkTargets.push({ mesh, index: dict[name] });
      }
    }
  }

  update(dt: number): void {
    this.t += dt;
    // The character stays fully planted — blinking is the only idle motion
    // (owner feedback: bobbing/sway/breathing all looked wrong).

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
