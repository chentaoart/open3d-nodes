import type { NodeDefinition } from './types';

const registry = new Map<string, NodeDefinition>();

export function registerNode(def: NodeDefinition): void {
  if (registry.has(def.type)) {
    console.warn(`[registry] 节点 "${def.type}" 已存在，覆盖。`);
  }
  registry.set(def.type, def);
}

export function getNode(type: string): NodeDefinition | undefined {
  return registry.get(type);
}

export function listNodes(): NodeDefinition[] {
  return Array.from(registry.values());
}