import * as THREE from 'three';
import { registerNode } from '../core/registry';
import { MATERIAL_OPTIONS } from '../core/material';
import type { Mesh3D } from '../core/types';

const OFFSET_PARAMS = [
  { name: 'ox', label: 'X 偏移', type: 'number' as const, default: 0, min: -10, max: 10, step: 0.05 },
  { name: 'oy', label: 'Y 偏移', type: 'number' as const, default: 0, min: -10, max: 10, step: 0.05 },
  { name: 'oz', label: 'Z 偏移', type: 'number' as const, default: 0, min: -10, max: 10, step: 0.05 },
];

const MATERIAL_PARAM = {
  name: 'material',
  label: '材质',
  type: 'enum' as const,
  default: 'matte',
  options: MATERIAL_OPTIONS,
};

registerNode({
  type: 'box',
  label: '立方体',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'width', label: '宽', type: 'number', default: 1, min: 0.1, max: 5, step: 0.1 },
    { name: 'height', label: '高', type: 'number', default: 1, min: 0.1, max: 5, step: 0.1 },
    { name: 'depth', label: '深', type: 'number', default: 1, min: 0.1, max: 5, step: 0.1 },
    { name: 'color', label: '颜色', type: 'color', default: '#4f8cff' },
    MATERIAL_PARAM,
    ...OFFSET_PARAMS,
  ],
  execute: (_, p) => {
    const h = p.height as number;
    const mesh: Mesh3D = {
      geometry: new THREE.BoxGeometry(p.width as number, h, p.depth as number),
      color: p.color as string,
      material: p.material as string,
      position: [
        (p.ox as number) ?? 0,
        ((p.oy as number) ?? 0) + h / 2,
        (p.oz as number) ?? 0,
      ],
    };
    return { mesh };
  },
});

registerNode({
  type: 'sphere',
  label: '球体',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'radius', label: '半径', type: 'number', default: 0.6, min: 0.1, max: 3, step: 0.05 },
    { name: 'color', label: '颜色', type: 'color', default: '#ff7a59' },
    MATERIAL_PARAM,
    ...OFFSET_PARAMS,
  ],
  execute: (_, p) => {
    const r = p.radius as number;
    const mesh: Mesh3D = {
      geometry: new THREE.SphereGeometry(r, 32, 16),
      color: p.color as string,
      material: p.material as string,
      position: [
        (p.ox as number) ?? 0,
        ((p.oy as number) ?? 0) + r,
        (p.oz as number) ?? 0,
      ],
    };
    return { mesh };
  },
});

registerNode({
  type: 'cylinder',
  label: '圆柱体',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'topR', label: '顶半径', type: 'number', default: 0.5, min: 0, max: 2, step: 0.05 },
    { name: 'bottomR', label: '底半径', type: 'number', default: 0.8, min: 0, max: 2, step: 0.05 },
    { name: 'height', label: '高', type: 'number', default: 1.5, min: 0.1, max: 5, step: 0.1 },
    { name: 'segments', label: '分段', type: 'number', default: 32, min: 3, max: 128, step: 1 },
    { name: 'color', label: '颜色', type: 'color', default: '#9b6bff' },
    MATERIAL_PARAM,
    ...OFFSET_PARAMS,
  ],
  execute: (_, p) => {
    const h = p.height as number;
    const mesh: Mesh3D = {
      geometry: new THREE.CylinderGeometry(
        p.topR as number,
        p.bottomR as number,
        h,
        p.segments as number
      ),
      color: p.color as string,
      material: p.material as string,
      position: [
        (p.ox as number) ?? 0,
        ((p.oy as number) ?? 0) + h / 2,
        (p.oz as number) ?? 0,
      ],
    };
    return { mesh };
  },
});

registerNode({
  type: 'output',
  label: '输出',
  category: 'output',
  inputs: [{ name: 'mesh', type: 'mesh' }],
  outputs: [],
  params: [],
  execute: (inputs) => ({ mesh: inputs.mesh }),
});