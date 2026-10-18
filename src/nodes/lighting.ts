import { registerNode } from '../core/registry';
import { num } from '../core/num';

registerNode({
  type: 'ambientLight',
  label: '环境光',
  category: 'light',
  inputs: [],
  outputs: [],
  params: [
    { name: 'color', label: '颜色', type: 'color', default: '#ffffff' },
    { name: 'intensity', label: '强度', type: 'number', default: 0.5, min: 0, max: 5, step: 0.05 },
  ],
  execute: (_, p) => ({
    light: {
      kind: 'ambient',
      color: (p.color as string) ?? '#ffffff',
      intensity: num(p.intensity, 0.5),
    },
  }),
});

registerNode({
  type: 'directionalLight',
  label: '平行光',
  category: 'light',
  inputs: [],
  outputs: [],
  params: [
    { name: 'color', label: '颜色', type: 'color', default: '#ffffff' },
    { name: 'intensity', label: '强度', type: 'number', default: 1.5, min: 0, max: 10, step: 0.05 },
    { name: 'px', label: 'X 位置', type: 'number', default: 5, min: -20, max: 20, step: 0.1 },
    { name: 'py', label: 'Y 位置', type: 'number', default: 10, min: -20, max: 20, step: 0.1 },
    { name: 'pz', label: 'Z 位置', type: 'number', default: 7, min: -20, max: 20, step: 0.1 },
  ],
  execute: (_, p) => ({
    light: {
      kind: 'directional',
      color: (p.color as string) ?? '#ffffff',
      intensity: num(p.intensity, 1.5),
      position: [num(p.px, 5), num(p.py, 10), num(p.pz, 7)],
    },
  }),
});

registerNode({
  type: 'pointLight',
  label: '点光',
  category: 'light',
  inputs: [],
  outputs: [],
  params: [
    { name: 'color', label: '颜色', type: 'color', default: '#ffffff' },
    { name: 'intensity', label: '强度', type: 'number', default: 3, min: 0, max: 20, step: 0.1 },
    { name: 'px', label: 'X 位置', type: 'number', default: 2, min: -20, max: 20, step: 0.1 },
    { name: 'py', label: 'Y 位置', type: 'number', default: 3, min: -20, max: 20, step: 0.1 },
    { name: 'pz', label: 'Z 位置', type: 'number', default: 2, min: -20, max: 20, step: 0.1 },
  ],
  execute: (_, p) => ({
    light: {
      kind: 'point',
      color: (p.color as string) ?? '#ffffff',
      intensity: num(p.intensity, 3),
      position: [num(p.px, 2), num(p.py, 3), num(p.pz, 2)],
    },
  }),
});