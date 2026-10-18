import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { registerNode } from '../core/registry';
import type { SDF } from '../core/sdf';

registerNode({
  type: 'voxelPreview',
  label: '体素预览',
  category: 'sdf',
  inputs: [{ name: 'sdf', type: 'sdf' }],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'size', label: '采样范围', type: 'number', default: 2, min: 0.5, max: 6, step: 0.1 },
    { name: 'gridN', label: '体素格数', type: 'number', default: 12, min: 4, max: 24, step: 1 },
    { name: 'color', label: '颜色', type: 'color', default: '#4dd699' },
  ],
  execute: (inputs, p) => {
    const sdf = inputs.sdf as SDF | undefined;
    if (!sdf) throw new Error('缺少 SDF 输入');

    const size = p.size as number;
    const N = p.gridN as number;
    const cell = (2 * size) / N;

    const boxProto = new THREE.BoxGeometry(cell * 0.92, cell * 0.92, cell * 0.92);
    const geos: THREE.BufferGeometry[] = [];

    for (let k = 0; k < N; k++) {
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const x = -size + (i + 0.5) * cell;
          const y = -size + (j + 0.5) * cell;
          const z = -size + (k + 0.5) * cell;

          if (sdf(x, y, z) > 0) continue;

          const allInside =
            sdf(x + cell, y, z) < 0 && sdf(x - cell, y, z) < 0 &&
            sdf(x, y + cell, z) < 0 && sdf(x, y - cell, z) < 0 &&
            sdf(x, y, z + cell) < 0 && sdf(x, y, z - cell) < 0;
          if (allInside) continue;

          const g = boxProto.clone();
          g.translate(x, y, z);
          geos.push(g);
        }
      }
    }

    boxProto.dispose();

    if (geos.length === 0) {
      return {
        mesh: { geometry: new THREE.BufferGeometry(), color: p.color as string, position: [0, 0, 0] },
      };
    }

    let merged: THREE.BufferGeometry | null = null;
    try {
      merged = mergeGeometries(geos, false);
    } catch {
      merged = null;
    }
    if (!merged) merged = geos[0];

    return {
      mesh: { geometry: merged, color: p.color as string, position: [0, 0, 0] },
    };
  },
});