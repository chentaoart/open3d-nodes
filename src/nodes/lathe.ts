import * as THREE from 'three';
import { registerNode } from '../core/registry';
import { MATERIAL_OPTIONS } from '../core/material';
import type { Mesh3D } from '../core/types';

export const LATHE_PRESETS: Record<string, { label: string; profile: [number, number][] }> = {
  vase: {
    label: '花瓶',
    profile: [
      [0.0, 0.0], [0.55, 0.0], [0.62, 0.25], [0.5, 0.7], [0.42, 1.1],
      [0.5, 1.5], [0.58, 1.8], [0.42, 2.0], [0.0, 2.0],
    ],
  },
  cup: {
    label: '杯子',
    profile: [
      [0.0, 0.0], [0.45, 0.0], [0.5, 0.1], [0.52, 0.8], [0.55, 0.9],
      [0.42, 0.9], [0.4, 0.15], [0.0, 0.12],
    ],
  },
  bowl: {
    label: '碗',
    profile: [
      [0.0, 0.0], [0.35, 0.0], [0.55, 0.05], [0.72, 0.25], [0.78, 0.5],
      [0.72, 0.55], [0.62, 0.35], [0.5, 0.18], [0.0, 0.15],
    ],
  },
  bottle: {
    label: '瓶子',
    profile: [
      [0.0, 0.0], [0.5, 0.0], [0.55, 0.3], [0.5, 0.9], [0.45, 1.2],
      [0.2, 1.5], [0.16, 2.0], [0.2, 2.2], [0.0, 2.2],
    ],
  },
  lamp: {
    label: '灯罩',
    profile: [
      [0.0, 0.0], [0.2, 0.0], [0.3, 0.4], [0.55, 0.9], [0.75, 1.4],
      [0.8, 1.6], [0.76, 1.6], [0.7, 1.35], [0.5, 0.85], [0.28, 0.4], [0.0, 0.4],
    ],
  },
};

registerNode({
  type: 'lathe',
  label: '旋转体',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'profile', label: '轮廓', type: 'string', default: JSON.stringify(LATHE_PRESETS.vase.profile) },
    { name: 'segments', label: '环绕分段', type: 'number', default: 48, min: 3, max: 128, step: 1 },
    { name: 'color', label: '颜色', type: 'color', default: '#a8d8ff' },
    { name: 'material', label: '材质', type: 'enum', default: 'ceramic', options: MATERIAL_OPTIONS },
    { name: 'ox', label: 'X 偏移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
    { name: 'oy', label: 'Y 偏移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
    { name: 'oz', label: 'Z 偏移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
  ],
  execute: (_, p) => {
    let profile: [number, number][];
    try {
      profile = JSON.parse(p.profile as string);
      if (!Array.isArray(profile) || profile.length < 2) throw new Error();
    } catch {
      throw new Error('轮廓数据无效');
    }

    const points = profile.map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(points, p.segments as number);
    geo.computeVertexNormals();

    const mesh: Mesh3D = {
      geometry: geo,
      color: p.color as string,
      material: p.material as string,
      position: [
        (p.ox as number) ?? 0,
        (p.oy as number) ?? 0,
        (p.oz as number) ?? 0,
      ],
    };
    return { mesh };
  },
});