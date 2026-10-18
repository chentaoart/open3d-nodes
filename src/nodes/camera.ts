import { registerNode } from '../core/registry';
import { num } from '../core/num';

registerNode({
  type: 'camera',
  label: '相机',
  category: 'camera',
  inputs: [],
  outputs: [],
  params: [
    { name: 'px', label: '位置 X', type: 'number', default: 4, min: -20, max: 20, step: 0.1 },
    { name: 'py', label: '位置 Y', type: 'number', default: 4, min: -20, max: 20, step: 0.1 },
    { name: 'pz', label: '位置 Z', type: 'number', default: 6, min: -20, max: 20, step: 0.1 },
    { name: 'tx', label: '目标 X', type: 'number', default: 0, min: -20, max: 20, step: 0.1 },
    { name: 'ty', label: '目标 Y', type: 'number', default: 1, min: -20, max: 20, step: 0.1 },
    { name: 'tz', label: '目标 Z', type: 'number', default: 0, min: -20, max: 20, step: 0.1 },
    { name: 'fov', label: '视场角', type: 'number', default: 50, min: 10, max: 120, step: 1 },
  ],
  execute: (_, p) => ({
    camera: {
      position: [num(p.px, 4), num(p.py, 4), num(p.pz, 6)],
      target: [num(p.tx, 0), num(p.ty, 1), num(p.tz, 0)],
      fov: num(p.fov, 50),
    },
  }),
});