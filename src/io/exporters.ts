import * as THREE from 'three';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import type { Mesh3D } from '../core/types';

function meshesToScene(meshes: Mesh3D[]): THREE.Scene {
  const scene = new THREE.Scene();
  for (const m of meshes) {
    const mesh = new THREE.Mesh(
      m.geometry,
      new THREE.MeshStandardMaterial({ color: m.color ?? '#cccccc' })
    );
    mesh.position.set(...(m.position ?? [0, 0, 0]));
    mesh.rotation.set(...(m.rotation ?? [0, 0, 0]));
    mesh.scale.set(...(m.scale ?? [1, 1, 1]));
    scene.add(mesh);
  }
  return scene;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportOBJ(meshes: Mesh3D[], filename = 'model.obj'): void {
  const scene = meshesToScene(meshes);
  const text = new OBJExporter().parse(scene);
  download(new Blob([text], { type: 'text/plain' }), filename);
}

export function exportGLTF(meshes: Mesh3D[], filename = 'model.glb', binary = true): Promise<void> {
  return new Promise((resolve, reject) => {
    const scene = meshesToScene(meshes);
    new GLTFExporter().parse(
      scene,
      (result) => {
        if (binary && result instanceof ArrayBuffer) {
          download(new Blob([result], { type: 'model/gltf-binary' }), filename);
        } else {
          const text = JSON.stringify(result, null, 2);
          download(new Blob([text], { type: 'model/gltf+json' }), filename.replace(/\.glb$/, '.gltf'));
        }
        resolve();
      },
      (err) => reject(err),
      { binary }
    );
  });
}

export function exportSTL(meshes: Mesh3D[], filename = 'model.stl'): void {
  const scene = meshesToScene(meshes);
  const text = new STLExporter().parse(scene, { binary: false });
  download(new Blob([text], { type: 'model/stl' }), filename);
}