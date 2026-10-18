import * as THREE from 'three';
import { registerNode } from '../core/registry';
import type { Mesh3D } from '../core/types';

function toArray(v: unknown): Mesh3D[] {
  if (Array.isArray(v)) return (v as Mesh3D[]).filter(Boolean);
  if (v) return [v as Mesh3D];
  return [];
}

registerNode({
  type: 'linearArray',
  label: '线性阵列',
  category: 'modify',
  inputs: [{ name: 'mesh', type: 'mesh' }],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'count', label: '数量', type: 'number', default: 3, min: 1, max: 100, step: 1 },
    { name: 'dx', label: 'X 间距', type: 'number', default: 1, min: -10, max: 10, step: 0.05 },
    { name: 'dy', label: 'Y 间距', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
    { name: 'dz', label: 'Z 间距', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
  ],
  execute: (inputs, p) => {
    const sources = toArray(inputs.mesh);
    if (sources.length === 0) return { mesh: [] };

    const count = Math.max(1, Math.min(100, Math.floor(Number(p.count) || 1)));
    const dx = Number(p.dx) || 0;
    const dy = Number(p.dy) || 0;
    const dz = Number(p.dz) || 0;

    const result: Mesh3D[] = [];
    for (let i = 0; i < count; i++) {
      for (const m of sources) {
        const pos = m.position ?? [0, 0, 0];
        result.push({
          ...m,
          position: [
            pos[0] + dx * i,
            pos[1] + dy * i,
            pos[2] + dz * i,
          ],
        });
      }
    }
    return { mesh: result };
  },
});

registerNode({
  type: 'radialArray',
  label: '环形阵列',
  category: 'modify',
  inputs: [{ name: 'mesh', type: 'mesh' }],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'count', label: '数量', type: 'number', default: 6, min: 2, max: 64, step: 1 },
    { name: 'radius', label: '半径', type: 'number', default: 2, min: 0.1, max: 20, step: 0.1 },
    { name: 'axis', label: '旋转轴', type: 'enum', default: 'y', options: [
      { value: 'y', label: '绕 Y 轴（水平一圈）' },
      { value: 'x', label: '绕 X 轴（前后一圈）' },
      { value: 'z', label: '绕 Z 轴（左右一圈）' },
    ] },
    { name: 'startAngle', label: '起始角度', type: 'number', default: 0, min: 0, max: 360, step: 5 },
  ],
  execute: (inputs, p) => {
    const sources = toArray(inputs.mesh);
    if (sources.length === 0) return { mesh: [] };

    const count = Math.max(2, Math.min(64, Math.floor(Number(p.count) || 2)));
    const radius = Number(p.radius) || 2;
    const axis = (p.axis as string) || 'y';
    const startDeg = Number(p.startAngle) || 0;
    const startRad = (startDeg * Math.PI) / 180;

    const result: Mesh3D[] = [];
    for (let i = 0; i < count; i++) {
      const angle = startRad + (i / count) * Math.PI * 2;
      for (const m of sources) {
        const pos = m.position ?? [0, 0, 0];
        const rot = m.rotation ?? [0, 0, 0];

        let newPos: [number, number, number];
        let newRot: [number, number, number];

        if (axis === 'y') {
          newPos = [
            pos[0] + Math.sin(angle) * radius,
            pos[1],
            pos[2] + Math.cos(angle) * radius,
          ];
          newRot = [rot[0], rot[1] + angle, rot[2]];
        } else if (axis === 'x') {
          newPos = [
            pos[0],
            pos[1] + Math.sin(angle) * radius,
            pos[2] + Math.cos(angle) * radius,
          ];
          newRot = [rot[0] + angle, rot[1], rot[2]];
        } else {
          newPos = [
            pos[0] + Math.sin(angle) * radius,
            pos[1] + Math.cos(angle) * radius,
            pos[2],
          ];
          newRot = [rot[0], rot[1], rot[2] + angle];
        }

        result.push({
          ...m,
          position: newPos,
          rotation: newRot,
        });
      }
    }
    return { mesh: result };
  },
});

registerNode({
  type: 'mirror',
  label: '镜像',
  category: 'modify',
  inputs: [{ name: 'mesh', type: 'mesh' }],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'axis', label: '镜像轴', type: 'enum', default: 'x', options: [
      { value: 'x', label: 'X 轴（左右镜像）' },
      { value: 'y', label: 'Y 轴（上下镜像）' },
      { value: 'z', label: 'Z 轴（前后镜像）' },
    ] },
    { name: 'keepOriginal', label: '保留原物体', type: 'enum', default: 'yes', options: [
      { value: 'yes', label: '是' },
      { value: 'no', label: '否（只显示镜像）' },
    ] },
    { name: 'offset', label: '对称轴位置', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
  ],
  execute: (inputs, p) => {
    const sources = toArray(inputs.mesh);
    if (sources.length === 0) return { mesh: [] };

    const axis = (p.axis as string) || 'x';
    const keep = p.keepOriginal !== 'no';
    const offset = Number(p.offset) || 0;

    const result: Mesh3D[] = [];

    for (const m of sources) {
      if (keep) result.push(m);

      const pos = m.position ?? [0, 0, 0];
      const rot = m.rotation ?? [0, 0, 0];
      const scl = m.scale ?? [1, 1, 1];

      const newPos: [number, number, number] = [
        axis === 'x' ? 2 * offset - pos[0] : pos[0],
        axis === 'y' ? 2 * offset - pos[1] : pos[1],
        axis === 'z' ? 2 * offset - pos[2] : pos[2],
      ];

      const newRot: [number, number, number] = [
        axis === 'x' ? rot[0] : -rot[0],
        axis === 'y' ? rot[1] : -rot[1],
        axis === 'z' ? rot[2] : -rot[2],
      ];

      const geo = m.geometry.clone();
      if (axis === 'x') geo.scale(-1, 1, 1);
      else if (axis === 'y') geo.scale(1, -1, 1);
      else geo.scale(1, 1, -1);
      geo.computeVertexNormals();

      result.push({
        ...m,
        geometry: geo,
        position: newPos,
        rotation: newRot,
        scale: [Math.abs(scl[0]), Math.abs(scl[1]), Math.abs(scl[2])],
      });
    }
    return { mesh: result };
  },
});