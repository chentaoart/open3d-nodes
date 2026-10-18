import type { Graph, NodeDefinition } from './types';
import { getNode } from './registry';

export interface ExecuteResult {
  meshes: unknown[];
  lights: unknown[];
  cameras: unknown[];
  log: string[];
}

export async function executeGraph(graph: Graph): Promise<ExecuteResult> {
  const outputs: Record<string, Record<string, unknown>> = {};
  const log: string[] = [];

  const incoming: Record<string, Record<string, { node: string; port: string }[]>> = {};
  for (const link of graph.links) {
    if (!incoming[link.to.node]) incoming[link.to.node] = {};
    if (!incoming[link.to.node][link.to.port]) incoming[link.to.node][link.to.port] = [];
    const list = incoming[link.to.node][link.to.port];
    // 同一个来源重复连到同一个端口时只算一次（兼容旧存档里的重复边）
    if (!list.some((f) => f.node === link.from.node && f.port === link.from.port)) list.push(link.from);
  }

  const visiting = new Set<string>();

  function tagMesh(mesh: any, nodeId: string): any {
    if (!mesh || typeof mesh !== 'object') return mesh;
    if (Array.isArray(mesh)) return mesh.filter(Boolean).map((m: any) => tagMesh(m, nodeId));
    if (mesh.__nodeId) return mesh;
    return { ...mesh, __nodeId: nodeId };
  }

  async function run(nodeId: string): Promise<Record<string, unknown>> {
    if (outputs[nodeId]) return outputs[nodeId];
    if (visiting.has(nodeId)) throw new Error(`检测到环：${nodeId}`);
    visiting.add(nodeId);

    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`找不到节点：${nodeId}`);
    const def: NodeDefinition | undefined = getNode(node.type);
    if (!def) throw new Error(`未注册的节点类型：${node.type}`);

    const inputs: Record<string, unknown> = {};
    const inMap = incoming[nodeId] || {};
    for (const port of def.inputs) {
      const srcs = inMap[port.name] || [];
      if (srcs.length === 0) continue;
      const vals: unknown[] = [];
      for (const src of srcs) {
        const srcOut = await run(src.node);
        vals.push(srcOut[src.port]);
      }
      inputs[port.name] = vals.length === 1 ? vals[0] : vals;
    }

    try {
      const result = await def.execute(inputs, node.params);

      if (result.mesh) {
        if (Array.isArray(result.mesh)) {
          result.mesh = (result.mesh as any[])
            .filter(Boolean)
            .map((m: any) => tagMesh(m, nodeId));
        } else {
          result.mesh = tagMesh(result.mesh, nodeId);
        }
      }

      outputs[nodeId] = result;
      log.push(`✓ ${def.label}(${nodeId})`);
      return result;
    } catch (e) {
      const errMsg = (e as Error).message;
      const paramSummary = JSON.stringify(node.params).slice(0, 200);
      log.push(`✗ ${def.label}(${nodeId})\n原因：${errMsg}\n参数：${paramSummary}`);
      throw e;
    } finally {
      visiting.delete(nodeId);
    }
  }

  const meshes: unknown[] = [];
  const lights: unknown[] = [];
  const cameras: unknown[] = [];

  for (const n of graph.nodes) {
    try {
      const out = await run(n.id);

      // 收集灯光和相机
      if (out.light) {
        lights.push({ ...(out.light as any), __nodeId: n.id });
      }
      if (out.camera) {
        cameras.push({ ...(out.camera as any), __nodeId: n.id });
      }

      // 只有 output 节点的 mesh 被收集
      const def = getNode(n.type);
      if (def?.category !== 'output') continue;

      const m = out.mesh;
      if (Array.isArray(m)) {
        // 多条输入线或组节点可能产生数组套数组，统一拍平成单个 mesh 列表
        meshes.push(...(m as any[]).flat(Infinity).filter(Boolean));
      } else if (m) {
        meshes.push(m);
      }
    } catch {
      // 已记录日志
    }
  }

  return { meshes, lights, cameras, log };
}