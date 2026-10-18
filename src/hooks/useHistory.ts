import { useRef, useState, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function useHistory() {
  const stackRef = useRef<Snapshot[]>([]);
  const indexRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = useCallback(() => {
    setCanUndo(indexRef.current > 0);
    setCanRedo(indexRef.current < stackRef.current.length - 1);
  }, []);

  const reset = useCallback((nodes: Node[], edges: Edge[]) => {
    stackRef.current = [{ nodes: clone(nodes), edges: clone(edges) }];
    indexRef.current = 0;
    updateFlags();
  }, [updateFlags]);

  const commit = useCallback((nodes: Node[], edges: Edge[]) => {
    stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
    stackRef.current.push({ nodes: clone(nodes), edges: clone(edges) });
    if (stackRef.current.length > 100) stackRef.current.shift();
    indexRef.current = stackRef.current.length - 1;
    updateFlags();
  }, [updateFlags]);

  const undo = useCallback((): Snapshot | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current -= 1;
    updateFlags();
    const s = stackRef.current[indexRef.current];
    return { nodes: clone(s.nodes), edges: clone(s.edges) };
  }, [updateFlags]);

  const redo = useCallback((): Snapshot | null => {
    if (indexRef.current >= stackRef.current.length - 1) return null;
    indexRef.current += 1;
    updateFlags();
    const s = stackRef.current[indexRef.current];
    return { nodes: clone(s.nodes), edges: clone(s.edges) };
  }, [updateFlags]);

  return { commit, undo, redo, reset, canUndo, canRedo };
}