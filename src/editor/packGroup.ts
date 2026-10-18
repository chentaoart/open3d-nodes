import type { Node, Edge } from '@xyflow/react';
import type { Graph } from '../core/types';
import { getNode } from '../core/registry';

export interface PackResult {
  groupNode: Node;
  remainingNodes: Node[];
  remainingEdges: Edge[];
}

export function packGroup(
  selectedNodes: Node[],
  allNodes: Node[],
  allEdges: Edge[],
  groupName: string
): PackResult {
  if (selectedNodes.length < 2) {
    throw new Error('至少选中两个节点');
  }

  const selIds = new Set(selectedNodes.map((n) => n.id));

  const internalEdges = allEdges.filter(
    (e) => selIds.has(e.source) && selIds.has(e.target)
  );

  const incomingEdges = allEdges.filter(
    (e) => !selIds.has(e.source) && selIds.has(e.target)
  );

  if (incomingEdges.length > 0) {
    throw new Error(`选中集合有 ${incomingEdges.length} 条外部输入边，请先断开它们`);
  }

  const outgoingEdges = allEdges.filter(
    (e) => selIds.has(e.source) && !selIds.has(e.target)
  );

  // 构造 subgraph
  const subNodes: Graph['nodes'] = selectedNodes.map((n) => ({
    id: n.id,
    type: (n.data as any).nodeType,
    params: (n.data as any).params ?? {},
    position: n.position,
  }));

  const subLinks: Graph['links'] = internalEdges.map((e) => ({
    id: e.id,
    from: { node: e.source, port: e.sourceHandle ?? '' },
    to: { node: e.target, port: e.targetHandle ?? '' },
  }));

  // ★ 如果 selected 里没有 output，自动加一个虚拟 output，
  //   把所有"输出 mesh 的节点"接到它，让 group 内部能执行
  const hasOutput = selectedNodes.some(
    (n) => (n.data as any).nodeType === 'output'
  );

  if (!hasOutput) {
    const meshSources = selectedNodes.filter((n) => {
      const def = getNode((n.data as any).nodeType);
      return def?.outputs.some((o) => o.name === 'mesh');
    });

    if (meshSources.length > 0) {
      const virtualOutputId = '__group_output__';
      subNodes.push({
        id: virtualOutputId,
        type: 'output',
        params: {},
        position: { x: 0, y: 0 },
      });
      for (const src of meshSources) {
        subLinks.push({
          id: `e-${src.id}-${virtualOutputId}`,
          from: { node: src.id, port: 'mesh' },
          to: { node: virtualOutputId, port: 'mesh' },
        });
      }
    }
  }

  const sub: Graph = { nodes: subNodes, links: subLinks };

  const groupId = `group-${Date.now()}`;

  const avgX =
    selectedNodes.reduce((s, n) => s + n.position.x, 0) / selectedNodes.length;
  const avgY =
    selectedNodes.reduce((s, n) => s + n.position.y, 0) / selectedNodes.length;

  const groupNode: Node = {
    id: groupId,
    type: 'custom',
    position: { x: avgX, y: avgY },
    data: {
      nodeType: 'group',
      params: {
        name: groupName,
        subgraph: JSON.stringify(sub),
        ox: 0, oy: 0, oz: 0,
      },
    },
  };

  // 外部指向选中的边改成从组节点出发
  // 组内每个部件原来各有一条连到输出的边，重定向后会变成 N 条一模一样的边，
  // 导致输出节点收到 N 份同一个组、渲染不出东西，所以按 目标+端口 去重。
  const redirectedEdges: Edge[] = [];
  const seenTargets = new Set<string>();
  for (const e of outgoingEdges) {
    const key = `${e.target}|${e.targetHandle ?? 'mesh'}`;
    if (seenTargets.has(key)) continue;
    seenTargets.add(key);
    redirectedEdges.push({
      ...e,
      id: `e-${groupId}-${e.target}-${e.targetHandle ?? 'mesh'}`,
      source: groupId,
      sourceHandle: 'mesh',
    });
  }

  const remainingNodes = [
    ...allNodes.filter((n) => !selIds.has(n.id)),
    groupNode,
  ];

  const remainingEdges = [
    ...allEdges.filter((e) => !selIds.has(e.source) && !selIds.has(e.target)),
    ...redirectedEdges,
  ];

  return { groupNode, remainingNodes, remainingEdges };
}