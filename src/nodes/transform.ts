import { registerNode } from '../core/registry';
import type { Mesh3D } from '../core/types';

function applyOne(mesh: Mesh3D, p: Record<string, unknown>): Mesh3D {
  const pos = mesh.position ?? [0, 0, 0];
  const rot = mesh.rotation ?? [0, 0, 0];
  const scl = mesh.scale ?? [1, 1, 1];

  return {
    ...mesh,
    position: [
      pos[0] + ((p.x as number) ?? 0),
      pos[1] + ((p.y as number) ?? 0),
      pos[2] + ((p.z as number) ?? 0),
    ],
    rotation: [
      rot[0] + ((p.rx as number) ?? 0),
      rot[1] + ((p.ry as number) ?? 0),
      rot[2] + ((p.rz as number) ?? 0),
    ],
    scale: [
      scl[0] * ((p.sx as number) ?? 1),
      scl[1] * ((p.sy as number) ?? 1),
      scl[2] * ((p.sz as number) ?? 1),
    ],
  };
}

registerNode({
  type: 'transform',
  label: '变换',
  category: 'modify',
  inputs: [{ name: 'mesh', type: 'mesh' }],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'x', label: 'X 位移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
    { name: 'y', label: 'Y 位移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
    { name: 'z', label: 'Z 位移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
    { name: 'rx', label: '绕 X 旋转', type: 'number', default: 0, min: -3.15, max: 3.15, step: 0.01 },
    { name: 'ry', label: '绕 Y 旋转', type: 'number', default: 0, min: -3.15, max: 3.15, step: 0.01 },
    { name: 'rz', label: '绕 Z 旋转', type: 'number', default: 0, min: -3.15, max: 3.15, step: 0.01 },
    { name: 'sx', label: 'X 缩放', type: 'number', default: 1, min: 0.01, max: 5, step: 0.01 },
    { name: 'sy', label: 'Y 缩放', type: 'number', default: 1, min: 0.01, max: 5, step: 0.01 },
    { name: 'sz', label: 'Z 缩放', type: 'number', default: 1, min: 0.01, max: 5, step: 0.01 },
  ],
  execute: (inputs, p) => {
    const v = inputs.mesh;
    if (Array.isArray(v)) {
      return { mesh: (v as Mesh3D[]).filter(Boolean).map((m) => applyOne(m, p)) };
    }
    if (!v) return { mesh: v };
    return { mesh: applyOne(v as Mesh3D, p) };
  },
});