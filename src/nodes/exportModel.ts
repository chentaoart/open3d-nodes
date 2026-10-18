import { registerNode } from '../core/registry';
import { exportOBJ, exportGLTF, exportSTL } from '../io/exporters';
import type { Mesh3D } from '../core/types';

function asMeshes(v: unknown): Mesh3D[] {
  if (Array.isArray(v)) return (v as Mesh3D[]).filter(Boolean);
  if (v) return [v as Mesh3D];
  return [];
}

registerNode({
  type: 'exportOBJ',
  label: '导出 OBJ',
  category: 'output',
  inputs: [{ name: 'mesh', type: 'mesh' }],
  outputs: [],
  params: [],
  execute: (inputs) => {
    const meshes = asMeshes(inputs.mesh);
    if (meshes.length > 0) exportOBJ(meshes, 'model.obj');
    return { mesh: inputs.mesh };
  },
});

registerNode({
  type: 'exportGLTF',
  label: '导出 GLTF',
  category: 'output',
  inputs: [{ name: 'mesh', type: 'mesh' }],
  outputs: [],
  params: [],
  execute: async (inputs) => {
    const meshes = asMeshes(inputs.mesh);
    if (meshes.length > 0) await exportGLTF(meshes, 'model.glb', true);
    return { mesh: inputs.mesh };
  },
});

registerNode({
  type: 'exportSTL',
  label: '导出 STL',
  category: 'output',
  inputs: [{ name: 'mesh', type: 'mesh' }],
  outputs: [],
  params: [],
  execute: (inputs) => {
    const meshes = asMeshes(inputs.mesh);
    if (meshes.length > 0) exportSTL(meshes, 'model.stl');
    return { mesh: inputs.mesh };
  },
});