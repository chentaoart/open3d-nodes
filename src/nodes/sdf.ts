import { registerNode } from '../core/registry';
import { MATERIAL_OPTIONS } from '../core/material';
import type { SDF } from '../core/sdf';
import {
  sdfSphere, sdfBox, sdfCapsule, sdfTorus,
  sdfUnion, sdfSmoothUnion,
  sdfSubtract, sdfSmoothSubtract, sdfIntersect,
  translateSDF, sdfToGeometry, getEffectiveResolution,
} from '../core/sdf';

interface Offset { ox?: number; oy?: number; oz?: number; }

function applyOffset(s: SDF, p: Offset): SDF {
  return translateSDF(s, p.ox ?? 0, p.oy ?? 0, p.oz ?? 0);
}

const OFFSET_PARAMS = [
  { name: 'ox', label: 'X 偏移', type: 'number' as const, default: 0, min: -5, max: 5, step: 0.05 },
  { name: 'oy', label: 'Y 偏移', type: 'number' as const, default: 0, min: -5, max: 5, step: 0.05 },
  { name: 'oz', label: 'Z 偏移', type: 'number' as const, default: 0, min: -5, max: 5, step: 0.05 },
];

registerNode({
  type: 'sdfSphere',
  label: 'SDF 球',
  category: 'sdf',
  inputs: [],
  outputs: [{ name: 'sdf', type: 'sdf' }],
  params: [
    { name: 'radius', label: '半径', type: 'number', default: 0.5, min: 0.05, max: 3, step: 0.05 },
    ...OFFSET_PARAMS,
  ],
  execute: (_, p) => ({ sdf: applyOffset(sdfSphere(p.radius as number), p) }),
});

registerNode({
  type: 'sdfBox',
  label: 'SDF 方',
  category: 'sdf',
  inputs: [],
  outputs: [{ name: 'sdf', type: 'sdf' }],
  params: [
    { name: 'sx', label: 'X 半宽', type: 'number', default: 0.4, min: 0.05, max: 3, step: 0.05 },
    { name: 'sy', label: 'Y 半高', type: 'number', default: 0.4, min: 0.05, max: 3, step: 0.05 },
    { name: 'sz', label: 'Z 半深', type: 'number', default: 0.4, min: 0.05, max: 3, step: 0.05 },
    { name: 'round', label: '圆角', type: 'number', default: 0, min: 0, max: 0.5, step: 0.02 },
    ...OFFSET_PARAMS,
  ],
  execute: (_, p) => {
    const base = sdfBox(p.sx as number, p.sy as number, p.sz as number);
    const r = p.round as number;
    const rounded: SDF = r > 0 ? (x, y, z) => base(x, y, z) - r : base;
    return { sdf: applyOffset(rounded, p) };
  },
});

registerNode({
  type: 'sdfCapsule',
  label: 'SDF 胶囊',
  category: 'sdf',
  inputs: [],
  outputs: [{ name: 'sdf', type: 'sdf' }],
  params: [
    { name: 'h', label: '半高', type: 'number', default: 0.5, min: 0.05, max: 3, step: 0.05 },
    { name: 'r', label: '半径', type: 'number', default: 0.25, min: 0.05, max: 2, step: 0.02 },
    ...OFFSET_PARAMS,
  ],
  execute: (_, p) => ({ sdf: applyOffset(sdfCapsule(p.h as number, p.r as number), p) }),
});

registerNode({
  type: 'sdfTorus',
  label: 'SDF 环',
  category: 'sdf',
  inputs: [],
  outputs: [{ name: 'sdf', type: 'sdf' }],
  params: [
    { name: 'R', label: '主半径', type: 'number', default: 0.5, min: 0.1, max: 3, step: 0.05 },
    { name: 'r', label: '管半径', type: 'number', default: 0.15, min: 0.02, max: 1, step: 0.02 },
    ...OFFSET_PARAMS,
  ],
  execute: (_, p) => ({ sdf: applyOffset(sdfTorus(p.R as number, p.r as number), p) }),
});

registerNode({
  type: 'sdfUnion',
  label: 'SDF 并集（平滑）',
  category: 'sdf',
  inputs: [
    { name: 'a', type: 'sdf' },
    { name: 'b', type: 'sdf' },
  ],
  outputs: [{ name: 'sdf', type: 'sdf' }],
  params: [
    { name: 'smooth', label: '平滑度', type: 'number', default: 0.1, min: 0, max: 1, step: 0.01 },
  ],
  execute: (inputs, p) => {
    const a = inputs.a as SDF | undefined;
    const b = inputs.b as SDF | undefined;
    if (!a || typeof a !== 'function') {
      throw new Error(`sdfUnion 的 A 输入缺失或类型错误（拿到 ${typeof a}）`);
    }
    if (!b || typeof b !== 'function') {
      throw new Error(`sdfUnion 的 B 输入缺失或类型错误（拿到 ${typeof b}）`);
    }
    const k = p.smooth as number;
    if (k <= 0.001) return { sdf: sdfUnion(a, b) };
    return { sdf: sdfSmoothUnion(a, b, k) };
  },
});

registerNode({
  type: 'sdfSubtract',
  label: 'SDF 差集（挖掉 B）',
  category: 'sdf',
  inputs: [
    { name: 'a', type: 'sdf' },
    { name: 'b', type: 'sdf' },
  ],
  outputs: [{ name: 'sdf', type: 'sdf' }],
  params: [
    { name: 'smooth', label: '平滑度', type: 'number', default: 0, min: 0, max: 1, step: 0.01 },
  ],
  execute: (inputs, p) => {
    const a = inputs.a as SDF | undefined;
    const b = inputs.b as SDF | undefined;
    if (!a || typeof a !== 'function') {
      throw new Error(`sdfSubtract 的 A 输入缺失或类型错误`);
    }
    if (!b || typeof b !== 'function') {
      throw new Error(`sdfSubtract 的 B 输入缺失或类型错误`);
    }
    const k = p.smooth as number;
    if (k <= 0.001) return { sdf: sdfSubtract(a, b) };
    return { sdf: sdfSmoothSubtract(a, b, k) };
  },
});

registerNode({
  type: 'sdfIntersect',
  label: 'SDF 交集',
  category: 'sdf',
  inputs: [
    { name: 'a', type: 'sdf' },
    { name: 'b', type: 'sdf' },
  ],
  outputs: [{ name: 'sdf', type: 'sdf' }],
  params: [],
  execute: (inputs) => {
    const a = inputs.a as SDF | undefined;
    const b = inputs.b as SDF | undefined;
    if (!a || typeof a !== 'function') {
      throw new Error(`sdfIntersect 的 A 输入缺失或类型错误`);
    }
    if (!b || typeof b !== 'function') {
      throw new Error(`sdfIntersect 的 B 输入缺失或类型错误`);
    }
    return { sdf: sdfIntersect(a, b) };
  },
});

registerNode({
  type: 'sdfToMesh',
  label: 'SDF → 网格',
  category: 'geometry',
  inputs: [{ name: 'sdf', type: 'sdf' }],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'size', label: '采样范围', type: 'number', default: 2, min: 0.5, max: 6, step: 0.1 },
    { name: 'resolution', label: '分辨率', type: 'number', default: 32, min: 8, max: 80, step: 4 },
    { name: 'color', label: '颜色', type: 'color', default: '#a97aff' },
    { name: 'material', label: '材质', type: 'enum', default: 'matte', options: MATERIAL_OPTIONS },
  ],
  execute: (inputs, p) => {
    const sdf = inputs.sdf;
    if (!sdf || typeof sdf !== 'function') {
      const keys = Object.keys(inputs);
      throw new Error(
        `sdfToMesh 缺少 SDF 输入（收到的 inputs 键=[${keys.join(',') || '空'}]）。` +
        `请先连接 sdfSphere / sdfCapsule / sdfBox / sdfTorus / sdfUnion 等节点的 sdf 输出。`
      );
    }
    const size = Number(p.size) || 2;
    const res = getEffectiveResolution(Number(p.resolution) || 32);
    const geo = sdfToGeometry(
      sdf as SDF,
      { min: [-size, -size, -size], max: [size, size, size] },
      res
    );
    return {
      mesh: {
        geometry: geo,
        color: (p.color as string) ?? '#a97aff',
        material: (p.material as string) ?? 'matte',
        position: [0, 0, 0],
      },
    };
  },
});