import * as THREE from 'three';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function createScene(container: HTMLElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9e6e1);
  scene.fog = new THREE.Fog(0xe9e6e1, 8, 20);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.position.set(0, 1.35, 3.3);
  camera.lookAt(0, 1.05, 0);

  const ambient = new THREE.AmbientLight(0xdde4ee, 1.1);
  const key = new THREE.DirectionalLight(0xfff2e0, 1.4);
  key.position.set(2, 3, 2);
  const screenGlow = new THREE.PointLight(0x88aaff, 0.5, 4);
  screenGlow.position.set(0, 1.2, -0.5);
  scene.add(ambient, key, screenGlow);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera };
}
