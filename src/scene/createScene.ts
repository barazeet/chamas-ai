import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function createScene(container: HTMLElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Golden hour: warm background and fog to match the low sun
  scene.background = new THREE.Color(0xf0e2cc);
  scene.fog = new THREE.Fog(0xf0e2cc, 8, 20);

  // Image-based lighting, reduced so ambient doesn't wash out the key light.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 50);
  // Entry POV (reference "Image 1"): behind-left of the chair, standing
  // height — cage bottom-left, desk center, window top-left
  camera.position.set(-1.5, 1.5, 3.15);
  camera.lookAt(0.1, 0.9, -0.25);

  // Hemisphere: warm golden-hour sky, warm bounce off the beige floor
  const hemi = new THREE.HemisphereLight(0xffd9a8, 0xc9b8a0, 0.35);
  // Key light: low golden sun raking in from the window (back wall, left of
  // the desk) — shadows stretch toward the visitor
  const key = new THREE.DirectionalLight(0xffa84d, 3.0);
  key.position.set(-2.8, 2.2, -0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const screenGlow = new THREE.PointLight(0x88aaff, 0.4, 4);
  screenGlow.position.set(0, 1.2, -0.5);
  scene.add(hemi, key, screenGlow);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera };
}
