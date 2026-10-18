import { registerNode } from '../core/registry';
import { executeGraph } from '../core/engine';
import type { Graph, Mesh3D } from '../core/types';
import { MATERIAL_OPTIONS } from '../core/material';
import { num } from '../core/num';

registerNode({
  type: 'group',
  label: '组',
  category: 'geometry',
  inputs: [],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'name', label: '组名', type: 'string', default: '组' },
    { name: 'subgraph', label: '内部数据', type: 'string', default: '' },
    { name: 'color', label: '整体颜色（留空=保持原色）', type: 'string', default: '' },
    { name: 'material', label: '整体材质', type: 'enum', default: '', options: [{ value: '', label: '保持原样' }, ...MATERIAL_OPTIONS] },
    { name: 'ox', label: 'X 偏移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
    { name: 'oy', label: 'Y 偏移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
    { name: 'oz', label: 'Z 偏移', type: 'number', default: 0, min: -10, max: 10, step: 0.05 },
  ],
  execute: async (_, p) => {
    const json = p.subgraph as string;
    if (!json) return { mesh: null };

    let sub: Graph;
    try {
      sub = JSON.parse(json);
    } catch {
      return { mesh: null };
    }

    const result = await executeGraph(sub);
    const meshes = result.meshes as Mesh3D[];
    if (meshes.length === 0) return { mesh: null };

    const ox = num(p.ox, 0);
    const oy = num(p.oy, 0);
    const oz = num(p.oz, 0);
    const color = typeof p.color === 'string' && p.color.trim() ? p.color.trim() : undefined;
    const material = typeof p.material === 'string' && p.material ? p.material : undefined;

    const shifted = meshes.map((m) => {
      const pos = m.position ?? [0, 0, 0];
      return {
        ...m,
        ...(color ? { color } : {}),
        ...(material ? { material } : {}),
        position: [pos[0] + ox, pos[1] + oy, pos[2] + oz] as [number, number, number],
      };
    });

    return { mesh: shifted.length === 1 ? shifted[0] : shifted };
  },
});