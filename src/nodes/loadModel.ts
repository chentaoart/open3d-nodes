import * as THREE from 'three';
import { registerNode } from '../core/registry';
import { loadGeometry } from '../io/loadModel';
import type { Mesh3D } from '../core/types';

registerNode({
  type: 'loadModel',
  label: '导入模型',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'src', label: '模型文件（.glb / .gltf / .obj）', type: 'file', default: '', accept: '.glb,.gltf,.obj' },
    { name: 'scale', label: '整体缩放', type: 'number', default: 1, min: 0.01, max: 100, step: 0.01 },
    { name: 'color', label: '颜色', type: 'color', default: '#cccccc' },
    { name: 'ox', label: 'X 偏移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
    { name: 'oy', label: 'Y 偏移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
    { name: 'oz', label: 'Z 偏移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
  ],
  execute: async (_, p) => {
    const src = p.src as string;
    if (!src) throw new Error('未选择文件');

    const geometry = await loadGeometry(src);

    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    geometry.translate(-center.x, -box.min.y, -center.z);

    const s = p.scale as number;
    const mesh: Mesh3D = {
      geometry,
      color: p.color as string,
      scale: [s, s, s],
      position: [(p.ox as number) ?? 0, (p.oy as number) ?? 0, (p.oz as number) ?? 0],
    };
    return { mesh };
  },
});