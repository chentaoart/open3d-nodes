import type { Node, Edge } from '@xyflow/react';

export interface ProjectFile {
  app: 'open3d-nodes';
  version: 1;
  name: string;
  createdAt: string;
  nodes: Node[];
  edges: Edge[];
}

export function saveProject(nodes: Node[], edges: Edge[], name = 'untitled'): void {
  const data: ProjectFile = {
    app: 'open3d-nodes',
    version: 1,
    name,
    createdAt: new Date().toISOString(),
    nodes,
    edges,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.o3n.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openProject(): Promise<{ nodes: Node[]; edges: Edge[]; name: string }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.o3n,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('未选择文件')); return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data.nodes)) throw new Error('不是有效的项目文件');
        resolve({
          nodes: data.nodes ?? [],
          edges: data.edges ?? [],
          name: data.name ?? 'untitled',
        });
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}