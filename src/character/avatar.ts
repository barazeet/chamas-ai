import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { IdleTarget } from './idle';

export interface AvatarHandle extends IdleTarget {
  isPlaceholder: boolean;
}

// The avatar is meshopt-compressed (gltf-transform); the decoder is required.
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

function buildPlaceholder(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.5, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x4a90d9, roughness: 0.7 }),
  );
  body.position.y = 0.45;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xd9b48f, roughness: 0.7 }),
  );
  head.position.y = 0.92;
  group.add(body, head);
  return group;
}

export async function loadAvatar(url: string): Promise<AvatarHandle> {
  try {
    const gltf = await loader.loadAsync(url);
    const morphMeshes: THREE.Mesh[] = [];
    gltf.scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && (mesh.morphTargetInfluences?.length ?? 0) > 0) {
        morphMeshes.push(mesh);
      }
    });
    return {
      object: gltf.scene,
      morphMesh: morphMeshes[0] ?? null,
      morphMeshes,
      isPlaceholder: false,
    };
  } catch {
    console.warn(`[avatar] failed to load ${url}, using placeholder`);
    return { object: buildPlaceholder(), morphMesh: null, isPlaceholder: true };
  }
}
