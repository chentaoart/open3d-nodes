import { useRef, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface ClipData {
  nodes: Node[];
  edges: Edge[];
}

export function useClipboard() {
  const clipRef = useRef<ClipData | null>(null);

  const copy = useCallback((nodes: Node[], edges: Edge[], ids: string[]): number => {
    if (ids.length === 0) return 0;
    const idSet = new Set(ids);
    const selNodes = nodes.filter((n) => idSet.has(n.id));
    const selEdges = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target));
    clipRef.current = {
      nodes: JSON.parse(JSON.stringify(selNodes)),
      edges: JSON.parse(JSON.stringify(selEdges)),
    };
    return selNodes.length;
  }, []);

  const paste = useCallback((
    currentNodes: Node[],
    currentEdges: Edge[]
  ): { nodes: Node[]; edges: Edge[]; pastedIds: string[] } | null => {
    const data = clipRef.current;
    if (!data || data.nodes.length === 0) return null;

    const idMap = new Map<string, string>();
    const offset = 40;
    const baseTime = Date.now();

    const newNodes: Node[] = data.nodes.map((n, i) => {
      const newId = `${(n.data as any).nodeType}-${baseTime}-${i}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + offset, y: n.position.y + offset },
      };
    });

    const newEdges: Edge[] = data.edges.map((e, i) => ({
      ...e,
      id: `e-copy-${baseTime}-${i}`,
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
    }));

    return {
      nodes: newNodes,
      edges: newEdges,
      pastedIds: newNodes.map((n) => n.id),
    };
  }, []);

  const hasData = useCallback(() => !!clipRef.current && clipRef.current.nodes.length > 0, []);

  return { copy, paste, hasData };
}