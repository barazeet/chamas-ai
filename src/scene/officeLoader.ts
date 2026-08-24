import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { buildOffice } from './office';

export interface LoadedOffice {
  group: THREE.Group;
  /** 'monitor-left' | 'monitor-right' -> the screen mesh to texture */
  screens: Map<string, THREE.Mesh>;
  isFallback: boolean;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/**
 * Loads the Blender-authored office GLB. Contract: the GLB contains meshes
 * named 'monitor-left-screen' and 'monitor-right-screen' (live canvas
 * textures are attached there). Falls back to the procedural office when the
 * GLB is missing (e.g. tests, offline dev).
 */
export async function loadOffice(url: string): Promise<LoadedOffice> {
  try {
    const gltf = await loader.loadAsync(url);
    const group = gltf.scene;
    group.name = 'office';
    const screens = new Map<string, THREE.Mesh>();
    group.traverse((o) => {
      // The Blender file carries its own (tentative) lights — the site has
      // its own golden-hour rig in code, so imported lights are disabled.
      if ((o as THREE.Light).isLight) o.visible = false;
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // big flat surfaces shouldn't cast (shadow acne + wasted depth pass)
      if (/wall|floor/i.test(mesh.name)) mesh.castShadow = false;
      if (mesh.name === 'monitor-left-screen') screens.set('monitor-left', mesh);
      if (mesh.name === 'monitor-right-screen') screens.set('monitor-right', mesh);
    });
    return { group, screens, isFallback: false };
  } catch (e) {
    console.warn(`[office] failed to load ${url}, using procedural fallback`, e);
    const group = buildOffice();
    const screens = new Map<string, THREE.Mesh>();
    for (const m of ['monitor-left', 'monitor-right']) {
      screens.set(m, group.getObjectByName(m)!.getObjectByName('screen') as THREE.Mesh);
    }
    return { group, screens, isFallback: true };
  }
}
