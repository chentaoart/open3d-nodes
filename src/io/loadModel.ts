import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const cache = new Map<string, Promise<THREE.BufferGeometry>>();

function mergeOrFirst(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  try {
    const merged = mergeGeometries(geos, false);
    if (merged) return merged;
  } catch {
    // fallthrough
  }
  return geos[0];
}

export function loadGeometry(src: string): Promise<THREE.BufferGeometry> {
  if (cache.has(src)) return cache.get(src)!;

  const promise = (async () => {
    const lower = src.toLowerCase().split('?')[0];

    if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(src);
      const geos: THREE.BufferGeometry[] = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const g = (obj as THREE.Mesh).geometry.clone();
          g.applyMatrix4(obj.matrixWorld);
          geos.push(g);
        }
      });
      if (geos.length === 0) throw new Error('GLTF 中未找到网格');
      return geos.length === 1 ? geos[0] : mergeOrFirst(geos);
    }

    if (lower.endsWith('.obj')) {
      const loader = new OBJLoader();
      const group = await loader.loadAsync(src);
      const geos: THREE.BufferGeometry[] = [];
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          geos.push((obj as THREE.Mesh).geometry.clone());
        }
      });
      if (geos.length === 0) throw new Error('OBJ 中未找到网格');
      return geos.length === 1 ? geos[0] : mergeOrFirst(geos);
    }

    throw new Error(`不支持的格式：${src}`);
  })();

  cache.set(src, promise);
  return promise;
}