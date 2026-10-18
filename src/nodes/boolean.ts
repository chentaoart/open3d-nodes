import * as THREE from 'three';
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION } from 'three-bvh-csg';
import { registerNode } from '../core/registry';
import type { Mesh3D } from '../core/types';

function bakeTransform(mesh: Mesh3D): THREE.BufferGeometry {
  const geo = mesh.geometry.clone();
  const pos = mesh.position ?? [0, 0, 0];
  const rot = mesh.rotation ?? [0, 0, 0];
  const scl = mesh.scale ?? [1, 1, 1];
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
    new THREE.Vector3(scl[0], scl[1], scl[2])
  );
  geo.applyMatrix4(m);
  return geo;
}

const OPS: Record<string, number> = {
  union: ADDITION,
  subtract: SUBTRACTION,
  intersect: INTERSECTION,
};

registerNode({
  type: 'boolean',
  label: 'CSG 布尔',
  category: 'modify',
  inputs: [
    { name: 'a', label: 'A（主体）', type: 'mesh' },
    { name: 'b', label: 'B（工具）', type: 'mesh' },
  ],
  outputs: [{ name: 'mesh', type: 'mesh' }],
  params: [
    { name: 'op', label: '运算类型', type: 'string', default: 'union' },
    { name: 'color', label: '颜色', type: 'color', default: '#aab4c8' },
  ],
  execute: (inputs, p) => {
    const a = inputs.a as Mesh3D | undefined;
    const b = inputs.b as Mesh3D | undefined;
    if (!a) throw new Error('缺少 A 输入');
    if (!b) throw new Error('缺少 B 输入');

    const op = OPS[(p.op as string) ?? 'union'] ?? ADDITION;

    const brushA = new Brush(bakeTransform(a));
    brushA.updateMatrixWorld();
    const brushB = new Brush(bakeTransform(b));
    brushB.updateMatrixWorld();

    const evaluator = new Evaluator();
    evaluator.attributes = ['position', 'normal'];
    const result = evaluator.evaluate(brushA, brushB, op);

    const geo = result.geometry.clone();
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();

    const mesh: Mesh3D = {
      geometry: geo,
      color: p.color as string,
      position: [0, 0, 0],
    };
    return { mesh };
  },
});