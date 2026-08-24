import * as THREE from 'three';

// Camera poses captured from the Blender scene: camera1 = entry POV,
// camera2 = character close-up. Values come from the GLB camera nodes
// (already converted to Three.js Y-up space by the exporter).
const LENS_MM = 50;
const SENSOR_WIDTH_MM = 36;

export interface CameraPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export const CAMERA_POSES: Record<'entry' | 'closeup', CameraPose> = {
  entry: {
    position: new THREE.Vector3(4.5459, 2.1895, -4.028),
    quaternion: new THREE.Quaternion(-0.04049, 0.91427, 0.09448, 0.39186),
  },
  closeup: {
    position: new THREE.Vector3(1.3304, 1.3125, -1.1251),
    quaternion: new THREE.Quaternion(-0.03738, 0.8999, 0.07873, 0.4273),
  },
};

/** Blender lens (mm, 36mm sensor) -> three.js vertical FOV at current aspect. */
export function applyLensFov(camera: THREE.PerspectiveCamera): void {
  const hfov = 2 * Math.atan(SENSOR_WIDTH_MM / (2 * LENS_MM));
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / camera.aspect));
  camera.updateProjectionMatrix();
}

/** Flies the camera smoothly between poses. */
export class CameraRig {
  private target: CameraPose | null = null;

  constructor(private camera: THREE.PerspectiveCamera) {}

  snapTo(pose: CameraPose): void {
    this.target = null;
    this.camera.position.copy(pose.position);
    this.camera.quaternion.copy(pose.quaternion);
  }

  flyTo(pose: CameraPose): void {
    this.target = pose;
  }

  get isFlying(): boolean {
    return this.target !== null;
  }

  update(dt: number): void {
    if (!this.target) return;
    const ease = Math.min(dt * 3.5, 1);
    this.camera.position.lerp(this.target.position, ease);
    this.camera.quaternion.slerp(this.target.quaternion, ease);
    if (this.camera.position.distanceTo(this.target.position) < 0.01) this.target = null;
  }
}
