import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection,
} from '@xyflow/react';
import { Viewport, type TransformData } from './viewport/Viewport';
import { TopBar } from './ui/TopBar';
import { ChatMain } from './ui/ChatMain';
import { AdvancedPanel } from './ui/AdvancedPanel';
import { SketchPad } from './ui/SketchPad';
import { NodeEditor } from './editor/NodeEditor';
import { LogPanel } from './ui/LogPanel';
import { Breadcrumb } from './ui/Breadcrumb';
import { NodeInspector } from './ui/NodeInspector';
import type { ChatMessage } from './ui/AIPanel';
import { executeGraph } from './core/engine';
import { getNode } from './core/registry';
import { log } from './core/logger';
import { LATHE_PRESETS } from './nodes/lathe';
import { askAI, askAIWithImage, askAIMultiView, askSceneAnalysis, pingAI } from './ai';
import { configSupportsVision } from './ai';
import { getPreset } from './ai/presets';
import { exportOBJ, exportGLTF, exportSTL } from './io/exporters';
import { saveProject, openProject } from './io/projectFile';
import { fileToDataUrl, compressImage } from './io/image';
import { extractFrames } from './io/video';
import { packGroup } from './editor/packGroup';
import type { SketchSet } from './io/sketchTypes';
import { useHistory } from './hooks/useHistory';
import { useClipboard } from './hooks/useClipboard';
import type { AIConfig } from './ai/provider';
import type { AIAction } from './ai/actions';
import type { Graph, Mesh3D, Light3D, Camera3D } from './core/types';

const STORAGE_KEY = 'open3d-project-v1';

const DEFAULT_NODES: Node[] = [
  {
    id: 'lathe-1', type: 'custom',
    position: { x: 60, y: 100 },
    data: {
      nodeType: 'lathe',
      params: {
        profile: JSON.stringify(LATHE_PRESETS.vase.profile),
        segments: 48, color: '#a8d8ff',
        ox: 0, oy: 0, oz: 0,
      },
    },
  },
  {
    id: 'out-1', type: 'custom',
    position: { x: 380, y: 100 },
    data: { nodeType: 'output', params: {} },
  },
];

const DEFAULT_EDGES: Edge[] = [
  { id: 'e1', source: 'lathe-1', sourceHandle: 'mesh', target: 'out-1', targetHandle: 'mesh' },
];

function loadSavedState(): { nodes: Node[]; edges: Edge[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.nodes) || data.nodes.length === 0) return null;
    return { nodes: data.nodes, edges: data.edges ?? [] };
  } catch {
    return null;
  }
}

function saveState(nodes: Node[], edges: Edge[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      nodes,
      edges,
    }));
  } catch (e) {
    console.warn('[persist] 保存失败:', e);
  }
}

interface GraphFrame {
  name: string;
  groupNodeId: string;
  parentNodes: Node[];
  parentEdges: Edge[];
}

type ViewMode = '3d' | 'split' | 'nodes';

function rfToGraph(nodes: Node[], edges: Edge[]): Graph {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.data as any).nodeType,
      params: (n.data as any).params ?? {},
      position: n.position,
    })),
    links: edges.map((e) => ({
      id: e.id,
      from: { node: e.source, port: e.sourceHandle ?? '' },
      to: { node: e.target, port: e.targetHandle ?? '' },
    })),
  };
}

function buildSDFTemplate(id: 'peanut' | 'mushroom' | 'blob'): { nodes: Node[]; edges: Edge[] } {
  const base = Date.now();
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const mk = (id: string, nodeType: string, x: number, y: number, params: Record<string, unknown>): Node => ({
    id, type: 'custom', position: { x, y }, data: { nodeType, params },
  });
  const link = (from: string, fromPort: string, to: string, toPort: string) => {
    edges.push({ id: `e-${from}-${to}-${toPort}-${base}`, source: from, sourceHandle: fromPort, target: to, targetHandle: toPort });
  };
  const outputNode = mk('out-' + base, 'output', 900, 200, {});

  if (id === 'peanut') {
    nodes.push(
      mk('s1-' + base, 'sdfSphere', 60, 40, { radius: 0.4, ox: 0, oy: -0.35, oz: 0 }),
      mk('s2-' + base, 'sdfSphere', 60, 200, { radius: 0.4, ox: 0, oy: 0.35, oz: 0 }),
      mk('u1-' + base, 'sdfUnion', 320, 120, { smooth: 0.25 }),
      mk('m1-' + base, 'sdfToMesh', 580, 120, { size: 1.5, resolution: 40, color: '#e8c9a0' }),
      outputNode
    );
    link('s1-' + base, 'sdf', 'u1-' + base, 'a');
    link('s2-' + base, 'sdf', 'u1-' + base, 'b');
    link('u1-' + base, 'sdf', 'm1-' + base, 'sdf');
    link('m1-' + base, 'mesh', outputNode.id, 'mesh');
  } else if (id === 'mushroom') {
    nodes.push(
      mk('stem-' + base, 'sdfCapsule', 60, 40, { h: 0.5, r: 0.15, ox: 0, oy: 0, oz: 0 }),
      mk('cap-' + base, 'sdfSphere', 60, 200, { radius: 0.5, ox: 0, oy: 0.7, oz: 0 }),
      mk('u1-' + base, 'sdfUnion', 320, 120, { smooth: 0.15 }),
      mk('m1-' + base, 'sdfToMesh', 580, 120, { size: 1.8, resolution: 48, color: '#d94f4f' }),
      outputNode
    );
    link('stem-' + base, 'sdf', 'u1-' + base, 'a');
    link('cap-' + base, 'sdf', 'u1-' + base, 'b');
    link('u1-' + base, 'sdf', 'm1-' + base, 'sdf');
    link('m1-' + base, 'mesh', outputNode.id, 'mesh');
  } else {
    nodes.push(
      mk('a-' + base, 'sdfSphere', 60, 30, { radius: 0.35, ox: -0.3, oy: 0, oz: 0 }),
      mk('b-' + base, 'sdfSphere', 60, 160, { radius: 0.35, ox: 0.3, oy: 0, oz: 0 }),
      mk('c-' + base, 'sdfSphere', 60, 290, { radius: 0.3, ox: 0, oy: 0.3, oz: 0 }),
      mk('u1-' + base, 'sdfUnion', 320, 60, { smooth: 0.3 }),
      mk('u2-' + base, 'sdfUnion', 500, 160, { smooth: 0.3 }),
      mk('m1-' + base, 'sdfToMesh', 680, 160, { size: 1.5, resolution: 48, color: '#a97aff' }),
      mk('v1-' + base, 'voxelPreview', 680, 340, { size: 1.5, gridN: 12, color: '#4dd699' }),
      outputNode
    );
    link('a-' + base, 'sdf', 'u1-' + base, 'a');
    link('b-' + base, 'sdf', 'u1-' + base, 'b');
    link('u1-' + base, 'sdf', 'u2-' + base, 'a');
    link('c-' + base, 'sdf', 'u2-' + base, 'b');
    link('u2-' + base, 'sdf', 'm1-' + base, 'sdf');
    link('u2-' + base, 'sdf', 'v1-' + base, 'sdf');
    link('m1-' + base, 'mesh', outputNode.id, 'mesh');
    link('v1-' + base, 'mesh', outputNode.id, 'mesh');
  }
  return { nodes, edges };
}

function buildCSGTemplate(id: 'cube-hole' | 'sphere-cut' | 'ring-ring'): { nodes: Node[]; edges: Edge[] } {
  const base = Date.now();
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const mk = (id: string, nodeType: string, x: number, y: number, params: Record<string, unknown>): Node => ({
    id, type: 'custom', position: { x, y }, data: { nodeType, params },
  });
  const link = (from: string, fromPort: string, to: string, toPort: string) => {
    edges.push({ id: `e-${from}-${to}-${toPort}-${base}`, source: from, sourceHandle: fromPort, target: to, targetHandle: toPort });
  };
  const outputNode = mk('out-' + base, 'output', 900, 200, {});

  if (id === 'cube-hole') {
    nodes.push(
      mk('base-' + base, 'box', 60, 40, { width: 1.5, height: 1.5, depth: 1.5, color: '#5b8cff', ox: 0, oy: 0, oz: 0 }),
      mk('hole1-' + base, 'box', 60, 200, { width: 0.5, height: 0.5, depth: 2, color: '#ff5555', ox: 0, oy: 0.5, oz: 0 }),
      mk('csg1-' + base, 'boolean', 340, 100, { op: 'subtract', color: '#aab4c8' }),
      mk('hole2-' + base, 'cylinder', 60, 360, { topR: 0.3, bottomR: 0.3, height: 2, segments: 32, color: '#ff5555', ox: 0.5, oy: 0, oz: 0 }),
      mk('csg2-' + base, 'boolean', 580, 180, { op: 'subtract', color: '#aab4c8' }),
      outputNode
    );
    link('base-' + base, 'mesh', 'csg1-' + base, 'a');
    link('hole1-' + base, 'mesh', 'csg1-' + base, 'b');
    link('csg1-' + base, 'mesh', 'csg2-' + base, 'a');
    link('hole2-' + base, 'mesh', 'csg2-' + base, 'b');
    link('csg2-' + base, 'mesh', outputNode.id, 'mesh');
  } else if (id === 'sphere-cut') {
    nodes.push(
      mk('s-' + base, 'sphere', 60, 40, { radius: 0.8, color: '#ff7a59', ox: 0, oy: 0, oz: 0 }),
      mk('cut-' + base, 'box', 60, 200, { width: 2, height: 1, depth: 2, color: '#ff5555', ox: 0, oy: -0.5, oz: 0 }),
      mk('csg-' + base, 'boolean', 340, 120, { op: 'subtract', color: '#ff7a59' }),
      outputNode
    );
    link('s-' + base, 'mesh', 'csg-' + base, 'a');
    link('cut-' + base, 'mesh', 'csg-' + base, 'b');
    link('csg-' + base, 'mesh', outputNode.id, 'mesh');
  } else {
    nodes.push(
      mk('t1-' + base, 'cylinder', 60, 40, { topR: 1.0, bottomR: 1.0, height: 0.4, segments: 48, color: '#9b6bff', ox: 0, oy: 0, oz: 0 }),
      mk('t2-' + base, 'cylinder', 60, 200, { topR: 0.55, bottomR: 0.55, height: 1, segments: 48, color: '#ff5555', ox: 0, oy: 0, oz: 0 }),
      mk('csg1-' + base, 'boolean', 340, 100, { op: 'subtract', color: '#9b6bff' }),
      mk('t3-' + base, 'cylinder', 60, 360, { topR: 0.25, bottomR: 0.25, height: 0.8, segments: 32, color: '#ff5555', ox: 0, oy: 0, oz: 0 }),
      mk('csg2-' + base, 'boolean', 580, 180, { op: 'subtract', color: '#9b6bff' }),
      outputNode
    );
    link('t1-' + base, 'mesh', 'csg1-' + base, 'a');
    link('t2-' + base, 'mesh', 'csg1-' + base, 'b');
    link('csg1-' + base, 'mesh', 'csg2-' + base, 'a');
    link('t3-' + base, 'mesh', 'csg2-' + base, 'b');
    link('csg2-' + base, 'mesh', outputNode.id, 'mesh');
  }
  return { nodes, edges };
}

function buildSDFFromStrokes(
  strokes: { type: string; at?: number[]; from?: number[]; to?: number[]; r?: number; size?: number[] }[],
  smooth: number, size: number, color: string
): { nodes: Node[]; edges: Edge[] } {
  const base = Date.now();
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const strokeIds: string[] = [];

  strokes.forEach((s, i) => {
    const id = `stroke-${base}-${i}`;
    strokeIds.push(id);
    const y = 40 + i * 140;
    if (s.type === 'sphere') {
      nodes.push({ id, type: 'custom', position: { x: 60, y },
        data: { nodeType: 'sdfSphere', params: { radius: s.r ?? 0.3, ox: s.at?.[0] ?? 0, oy: s.at?.[1] ?? 0, oz: s.at?.[2] ?? 0 } } });
    } else if (s.type === 'capsule') {
      const fx = s.from?.[0] ?? 0, fy = s.from?.[1] ?? 0, fz = s.from?.[2] ?? 0;
      const tx = s.to?.[0] ?? 0, ty = s.to?.[1] ?? 0, tz = s.to?.[2] ?? 0;
      const mx = (fx + tx) / 2, my = (fy + ty) / 2, mz = (fz + tz) / 2;
      const half = Math.sqrt((tx - fx) ** 2 + (ty - fy) ** 2 + (tz - fz) ** 2) / 2;
      nodes.push({ id, type: 'custom', position: { x: 60, y },
        data: { nodeType: 'sdfCapsule', params: { h: half, r: s.r ?? 0.15, ox: mx, oy: my, oz: mz } } });
    } else if (s.type === 'box') {
      nodes.push({ id, type: 'custom', position: { x: 60, y },
        data: { nodeType: 'sdfBox', params: { sx: (s.size?.[0] ?? 0.3) / 2, sy: (s.size?.[1] ?? 0.3) / 2, sz: (s.size?.[2] ?? 0.3) / 2, round: 0, ox: s.at?.[0] ?? 0, oy: s.at?.[1] ?? 0, oz: s.at?.[2] ?? 0 } } });
    }
  });

  if (strokeIds.length === 0) return { nodes, edges };
  let prevId = strokeIds[0];
  for (let i = 1; i < strokeIds.length; i++) {
    const unionId = `union-${base}-${i}`;
    nodes.push({ id: unionId, type: 'custom', position: { x: 300 + i * 30, y: 80 + i * 80 },
      data: { nodeType: 'sdfUnion', params: { smooth } } });
    edges.push({ id: `e-${prevId}-${unionId}-a`, source: prevId, sourceHandle: 'sdf', target: unionId, targetHandle: 'a' });
    edges.push({ id: `e-${strokeIds[i]}-${unionId}-b`, source: strokeIds[i], sourceHandle: 'sdf', target: unionId, targetHandle: 'b' });
    prevId = unionId;
  }
  const meshId = `mesh-${base}`;
  nodes.push({ id: meshId, type: 'custom', position: { x: 600, y: 200 },
    data: { nodeType: 'sdfToMesh', params: { size, resolution: 40, color } } });
  edges.push({ id: `e-${prevId}-${meshId}`, source: prevId, sourceHandle: 'sdf', target: meshId, targetHandle: 'sdf' });
  return { nodes, edges };
}

/** 在画布上找一块不与现有节点重叠的位置（按约 270×180 的占位估算）。 */
function findFreeSpot(
  existing: Node[],
  startX = 80,
  startY = 60,
  taken: { x: number; y: number }[] = []
): { x: number; y: number } {
  const W = 270, H = 180;
  const boxes = [...existing.map((n) => n.position), ...taken];
  const hit = (x: number, y: number) =>
    boxes.some((b) => Math.abs(b.x - x) < W && Math.abs(b.y - y) < H);
  for (let row = 0; row < 40; row++) {
    for (let col = 0; col < 12; col++) {
      const x = startX + col * (W + 30);
      const y = startY + row * (H + 20);
      if (!hit(x, y)) return { x, y };
    }
  }
  return { x: startX, y: startY };
}

export default function App() {
  const saved = loadSavedState();
  const initialNodes = saved?.nodes ?? DEFAULT_NODES;
  const initialEdges = saved?.edges ?? DEFAULT_EDGES;

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [meshes, setMeshes] = useState<Mesh3D[]>([]);
  const [lights, setLights] = useState<Light3D[]>([]);
  const [cameras, setCameras] = useState<Camera3D[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [sketchBusy, setSketchBusy] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [iterating, setIterating] = useState(false);
  const [selectedMeshNodeId, setSelectedMeshNodeId] = useState<string | null>(null);
  const [sketchSet, setSketchSet] = useState<SketchSet | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [graphStack, setGraphStack] = useState<GraphFrame[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [splitRatio, setSplitRatio] = useState(0.55);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  const [rightRatio, setRightRatio] = useState(0.6);
  const rightContainerRef = useRef<HTMLDivElement>(null);

  const [aiStatus, setAiStatus] = useState<'unknown' | 'checking' | 'connected' | 'error'>('unknown');

  const isTransformingRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    try {
      const s = localStorage.getItem('chat-history');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  const [llmHistory, setLlmHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    try {
      const s = localStorage.getItem('llm-history');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  const [memory, setMemory] = useState<string>(() => {
    try { return localStorage.getItem('ai-memory') ?? ''; } catch { return ''; }
  });

  const history = useHistory();
  const clipboard = useClipboard();
  const suppressCommitRef = useRef(false);
  const commitTimerRef = useRef<number | null>(null);
  const [historyReady, setHistoryReady] = useState(false);

  const [aiConfig, setAIConfig] = useState<AIConfig>(() => {
    try {
      const s = localStorage.getItem('ai-config');
      return s ? JSON.parse(s) : { provider: 'strata', fallbackToRule: true };
    } catch { return { provider: 'strata', fallbackToRule: true }; }
  });

  useEffect(() => {
    try { localStorage.setItem('chat-history', JSON.stringify(chatHistory.slice(-100))); } catch {}
  }, [chatHistory]);
  useEffect(() => {
    try { localStorage.setItem('llm-history', JSON.stringify(llmHistory.slice(-30))); } catch {}
  }, [llmHistory]);

  useEffect(() => {
    if (!historyReady) return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => saveState(nodes, edges), 1000);
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [nodes, edges, historyReady]);

  useEffect(() => {
    function onBeforeUnload() { saveState(nodes, edges); }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [nodes, edges]);

  function updateMemory(m?: string) {
    if (!m) return;
    setMemory((prev) => {
      const merged = prev ? `${prev}\n${m}` : m;
      const trimmed = merged.length > 2000 ? merged.slice(-2000) : merged;
      try { localStorage.setItem('ai-memory', trimmed); } catch {}
      return trimmed;
    });
  }

  useEffect(() => {
    history.reset(initialNodes, initialEdges);
    setHistoryReady(true);
    log('info', saved ? '已恢复上次项目' : '项目已启动');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    if (suppressCommitRef.current) { suppressCommitRef.current = false; return; }
    if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(() => history.commit(nodes, edges), 500);
    return () => { if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, historyReady]);

  useEffect(() => {
    if (isTransformingRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        const graph = rfToGraph(nodes, edges);
        const result = await executeGraph(graph);
        if (!cancelled) {
          setMeshes(result.meshes as Mesh3D[]);
          setLights(result.lights as Light3D[]);
          setCameras(result.cameras as Camera3D[]);
          const errLines = result.log.filter((l) => l.startsWith('✗'));
          if (errLines.length > 0) {
            log('error', `节点执行失败 ${errLines.length} 个`, '引擎', errLines.join('\n\n'));
          }
        }
      } catch (e) {
        if (!cancelled) log('error', `执行失败：${(e as Error).message}`, '引擎');
      }
    })();
    return () => { cancelled = true; };
  }, [nodes, edges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges]
  );

  const testAIConnection = useCallback(async () => {
    const preset = getPreset(aiConfig.provider);
    if (!preset || preset.id === 'rule') {
      setAiStatus('connected');
      log('success', '规则模式已就绪', 'AI');
      return;
    }
    if (preset.needsKey && !aiConfig.apiKey) {
      setAiStatus('error');
      log('warn', '未填写 API Key', 'AI');
      return;
    }

    setAiStatus('checking');
    log('info', `检测连接：${preset.name}`, 'AI');
    const result = await pingAI(aiConfig);
    if (result.ok) {
      setAiStatus('connected');
      log('success', '连接正常', 'AI');
    } else {
      setAiStatus('error');
      log('error', `连接失败：${result.error}`, 'AI');
    }
  }, [aiConfig]);

  useEffect(() => {
    const t = setTimeout(() => testAIConnection(), 500);
    return () => clearTimeout(t);
  }, [testAIConnection]);

  function onSplitterMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    const startY = e.clientY;
    const startRatio = splitRatio;
    const rect = container.getBoundingClientRect();
    const totalH = rect.height;

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev: MouseEvent) {
      const dy = ev.clientY - startY;
      const ratio = startRatio + dy / totalH;
      setSplitRatio(Math.max(0.15, Math.min(0.85, ratio)));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onRightSplitterMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const container = rightContainerRef.current;
    if (!container) return;
    const startY = e.clientY;
    const startRatio = rightRatio;
    const rect = container.getBoundingClientRect();
    const totalH = rect.height;

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev: MouseEvent) {
      const dy = ev.clientY - startY;
      const ratio = startRatio + dy / totalH;
      setRightRatio(Math.max(0.2, Math.min(0.85, ratio)));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  const handleNodeClickStable = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleSelectionChangeStable = useCallback((ids: string[]) => {
    setSelectedNodeIds((prev) => {
      if (prev.length === ids.length && prev.every((id, i) => id === ids[i])) return prev;
      return ids;
    });
  }, []);

  function handleSelectMesh(nodeId: string | null) {
    setSelectedMeshNodeId(nodeId);
    if (nodeId) setSelectedId(nodeId);
  }

  function handleUndo() {
    const snap = history.undo();
    if (!snap) return;
    suppressCommitRef.current = true;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    log('info', '撤销');
  }

  function handleRedo() {
    const snap = history.redo();
    if (!snap) return;
    suppressCommitRef.current = true;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    log('info', '重做');
  }

  function handleCopy() {
    const n = clipboard.copy(nodes, edges, selectedNodeIds);
    if (n > 0) log('info', `已复制 ${n} 个节点`);
  }

  function handlePaste() {
    const result = clipboard.paste(nodes, edges);
    if (!result) return;
    setNodes((ns) => [...ns, ...result.nodes]);
    setEdges((es) => [...es, ...result.edges]);
    setSelectedNodeIds(result.pastedIds);
    log('info', `已粘贴 ${result.nodes.length} 个节点`);
  }

  function handleDuplicate() {
    const n = clipboard.copy(nodes, edges, selectedNodeIds);
    if (n === 0) return;
    const result = clipboard.paste(nodes, edges);
    if (!result) return;
    setNodes((ns) => [...ns, ...result.nodes]);
    setEdges((es) => [...es, ...result.edges]);
    setSelectedNodeIds(result.pastedIds);
    log('info', `已再制 ${result.nodes.length} 个节点`);
  }

  function handleDelete() {
    if (selectedNodeIds.length === 0) return;
    const ids = new Set(selectedNodeIds);
    setNodes((ns) => ns.filter((n) => !ids.has(n.id)));
    setEdges((es) => es.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    setSelectedNodeIds([]);
    setSelectedId(null);
    log('info', `已删除 ${ids.size} 个节点`);
  }

  function handleSelectAll() {
    setSelectedNodeIds(nodes.map((n) => n.id));
  }

  function handleDuplicateMesh(nodeId: string) {
    const src = nodes.find((n) => n.id === nodeId);
    if (!src) return;
    const nodeType = (src.data as any).nodeType;
    const currentParams = (src.data as any).params ?? {};
    const newId = `${nodeType}-copy-${Date.now()}`;
    const copyParams = { ...currentParams };
    if (copyParams.ox !== undefined) copyParams.ox = (copyParams.ox as number) + 0.8;
    else if (copyParams.x !== undefined) copyParams.x = (copyParams.x as number) + 0.8;

    setNodes((ns) => [...ns, {
      ...src, id: newId,
      position: { x: src.position.x + 40, y: src.position.y + 40 },
      data: { ...src.data, params: copyParams },
    }]);
    log('info', `复制模型：${nodeType}`);
  }

  function handleDeleteMesh(nodeId: string) {
    setNodes((ns) => ns.filter((n) => n.id !== nodeId));
    setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedMeshNodeId(null);
    log('info', '删除模型');
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' || target.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (key === 'escape' && !inInput) {
        setSelectedNodeIds([]);
        setSelectedId(null);
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        if (inInput) return;
        e.preventDefault();
        handleDelete();
        return;
      }
      if (!mod) return;

      if (key === 'z' && !e.shiftKey) { if (inInput) return; e.preventDefault(); handleUndo(); }
      else if ((key === 'z' && e.shiftKey) || key === 'y') { if (inInput) return; e.preventDefault(); handleRedo(); }
      else if (key === 'c') { if (inInput) return; e.preventDefault(); handleCopy(); }
      else if (key === 'v') { if (inInput) return; e.preventDefault(); handlePaste(); }
      else if (key === 'd') { if (inInput) return; e.preventDefault(); handleDuplicate(); }
      else if (key === 'a') { if (inInput) return; e.preventDefault(); handleSelectAll(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, selectedNodeIds]);

  function addNode(type: string) {
    const id = `${type}-${Date.now()}`;
    const def = getNode(type);
    if (!def) {
      log('error', `未知节点类型：${type}（未注册）`, '节点');
      return;
    }
    const params: Record<string, unknown> = {};
    for (const p of def.params) params[p.name] = p.default;
    const existingGeom = nodes.filter((n) => {
      const d = getNode((n.data as any).nodeType);
      return d && d.category !== 'output' && d.category !== 'modify';
    });
    if (existingGeom.length > 0 && params.ox !== undefined) {
      params.ox = Number((existingGeom.length * 1.2).toFixed(2));
    }
    setNodes((ns) => [...ns, {
      id, type: 'custom',
      position: findFreeSpot(ns, 100, 100),
      data: { nodeType: type, params },
    }]);
    log('info', `添加节点：${def.label}`, '节点');
  }

  function updateSelectedParams(patch: Record<string, unknown>) {
    if (!selectedId) return;
    setNodes((ns) => ns.map((n) =>
      n.id === selectedId
        ? { ...n, data: { ...n.data, params: { ...(n.data as any).params, ...patch } } }
        : n
    ));
  }

  function resetHistoryWith(ns: Node[], es: Edge[]) {
    suppressCommitRef.current = true;
    setTimeout(() => history.reset(ns, es), 0);
  }

  function handleLoadSDFTemplate(id: 'peanut' | 'mushroom' | 'blob') {
    const { nodes: tn, edges: te } = buildSDFTemplate(id);
    setNodes(tn);
    setEdges(te);
    setGraphStack([]);
    resetHistoryWith(tn, te);
    setSelectedMeshNodeId(null);
    setSelectedNodeIds([]);
    log('info', `加载 SDF 模板：${id}`);
  }

  function handleLoadCSGTemplate(id: 'cube-hole' | 'sphere-cut' | 'ring-ring') {
    const { nodes: tn, edges: te } = buildCSGTemplate(id);
    setNodes(tn);
    setEdges(te);
    setGraphStack([]);
    resetHistoryWith(tn, te);
    setSelectedMeshNodeId(null);
    setSelectedNodeIds([]);
    log('info', `加载 CSG 模板：${id}`);
  }

  function handleTransformMesh(nodeId: string, data: TransformData) {
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;
    const currentParams = (targetNode.data as any).params ?? {};
    const patch: Record<string, unknown> = {};

    if (data.deltaPos) {
      const [dx, dy, dz] = data.deltaPos;
      if (currentParams.ox !== undefined) {
        patch.ox = Number((((currentParams.ox as number) ?? 0) + dx).toFixed(3));
        patch.oy = Number((((currentParams.oy as number) ?? 0) + dy).toFixed(3));
        patch.oz = Number((((currentParams.oz as number) ?? 0) + dz).toFixed(3));
      } else if (currentParams.x !== undefined) {
        patch.x = Number((((currentParams.x as number) ?? 0) + dx).toFixed(3));
        patch.y = Number((((currentParams.y as number) ?? 0) + dy).toFixed(3));
        patch.z = Number((((currentParams.z as number) ?? 0) + dz).toFixed(3));
      } else {
        patch.ox = Number(dx.toFixed(3));
        patch.oy = Number(dy.toFixed(3));
        patch.oz = Number(dz.toFixed(3));
      }
    }
    if (data.deltaRot && currentParams.rx !== undefined) {
      const [drx, dry, drz] = data.deltaRot;
      patch.rx = Number((((currentParams.rx as number) ?? 0) + drx).toFixed(3));
      patch.ry = Number((((currentParams.ry as number) ?? 0) + dry).toFixed(3));
      patch.rz = Number((((currentParams.rz as number) ?? 0) + drz).toFixed(3));
    }
    if (data.deltaScale && currentParams.sx !== undefined) {
      const [dsx, dsy, dsz] = data.deltaScale;
      patch.sx = Number((((currentParams.sx as number) ?? 1) * dsx).toFixed(3));
      patch.sy = Number((((currentParams.sy as number) ?? 1) * dsy).toFixed(3));
      patch.sz = Number((((currentParams.sz as number) ?? 1) * dsz).toFixed(3));
    }
    if (Object.keys(patch).length === 0) return;

    setNodes((ns) => ns.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, params: { ...(n.data as any).params, ...patch } } }
        : n
    ));
  }

  function handlePackGroup() {
    if (selectedNodeIds.length < 2) return;
    const selected = nodes.filter((n) => selectedNodeIds.includes(n.id));
    const name = prompt('组名', '组') || '组';
    try {
      const result = packGroup(selected, nodes, edges, name);
      setNodes(result.remainingNodes);
      setEdges(result.remainingEdges);
      setSelectedNodeIds([result.groupNode.id]);
      setSelectedId(result.groupNode.id);
      log('success', `打包 ${selected.length} 个节点为「${name}」`);
    } catch (e) {
      log('error', `打包失败：${(e as Error).message}`);
    }
  }

  function handleEnterGroup(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if ((node.data as any).nodeType !== 'group') return;
    const json = (node.data as any).params?.subgraph;
    if (!json) return;
    let sub: Graph;
    try { sub = JSON.parse(json); } catch { return; }

    const subNodes: Node[] = sub.nodes.map((n) => ({
      id: n.id, type: 'custom', position: n.position,
      data: { nodeType: n.type, params: n.params },
    }));
    const subEdges: Edge[] = sub.links.map((l) => ({
      id: l.id, source: l.from.node, sourceHandle: l.from.port,
      target: l.to.node, targetHandle: l.to.port,
    }));

    setGraphStack((s) => [...s, {
      name: (node.data as any).params?.name ?? '组',
      groupNodeId: nodeId,
      parentNodes: nodes,
      parentEdges: edges,
    }]);
    setNodes(subNodes);
    setEdges(subEdges);
    setSelectedId(null);
    setSelectedNodeIds([]);
    setSelectedMeshNodeId(null);
    resetHistoryWith(subNodes, subEdges);
    log('info', `进入组「${(node.data as any).params?.name ?? '组'}」`);
  }

  function handleCrumbNavigate(targetIndex: number) {
    if (targetIndex >= graphStack.length) return;
    let depth = graphStack.length - targetIndex;
    let curNodes = nodes;
    let curEdges = edges;
    let stack = [...graphStack];

    while (depth > 0 && stack.length > 0) {
      const top = stack[stack.length - 1];
      const sub: Graph = {
        nodes: curNodes.map((n) => ({
          id: n.id, type: (n.data as any).nodeType,
          params: (n.data as any).params ?? {}, position: n.position,
        })),
        links: curEdges.map((e) => ({
          id: e.id,
          from: { node: e.source, port: e.sourceHandle ?? '' },
          to: { node: e.target, port: e.targetHandle ?? '' },
        })),
      };
      const updatedParentNodes = top.parentNodes.map((n) =>
        n.id === top.groupNodeId
          ? { ...n, data: { ...n.data, params: { ...(n.data as any).params, subgraph: JSON.stringify(sub) } } }
          : n
      );
      curNodes = updatedParentNodes;
      curEdges = top.parentEdges;
      stack = stack.slice(0, -1);
      depth--;
    }
    setNodes(curNodes);
    setEdges(curEdges);
    setGraphStack(stack);
    setSelectedId(null);
    setSelectedNodeIds([]);
    setSelectedMeshNodeId(null);
    resetHistoryWith(curNodes, curEdges);
    log('info', targetIndex === 0 ? '返回顶层' : `返回第 ${targetIndex} 层`);
  }

  async function applyAIResult(result: any, _autoIterateAfter: boolean, _goal: string) {
    const summary: string[] = [];
    if (result.nodes?.length) summary.push(`${result.nodes.length} 个节点`);
    if (result.updates?.length) summary.push(`${result.updates.length} 个更新`);
    if (result.actions?.length) summary.push(`${result.actions.length} 个操作`);
    if (result.mode) summary.push(`模式=${result.mode}`);
    if (result.wrapAsGroup) summary.push(`打包=${result.groupName ?? '组'}`);
    log('ai-res', `返回：${summary.join('，') || '无内容'}`, 'AI', JSON.stringify(result).slice(0, 1500));

    let didSomething = false;

    if (result.updates?.length) {
      setNodes((ns) => ns.map((n) => {
        let upd = result.updates.find((u: any) => u.id === n.id);
        if (!upd) {
          upd = result.updates.find((u: any) => {
            const uid = String(u.id);
            const nid = String(n.id);
            if (uid === nid) return true;
            const types = ['lathe', 'sphere', 'box', 'cylinder', 'sdfSphere', 'sdfBox', 'sdfCapsule', 'sdfTorus', 'sdfUnion', 'sdfToMesh', 'boolean', 'transform', 'ambientLight', 'directionalLight', 'pointLight', 'camera', 'linearArray', 'radialArray', 'mirror', 'group'];
            for (const t of types) {
              if (nid.startsWith(t) && uid.includes(t)) return true;
              if (uid.startsWith(t) && nid.includes(t)) return true;
            }
            return false;
          });
        }
        if (!upd) return n;
        const patched: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(upd.params)) {
          patched[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
        }
        return { ...n, data: { ...n.data, params: { ...(n.data as any).params, ...patched } } };
      }));
      didSomething = true;
      log('info', `更新 ${result.updates.length} 个节点参数`);
    }

    if (result.actions?.length) {
      const acts: AIAction[] = result.actions;
      let ns = nodes;
      let es = edges;
      const newSelect: string[] = [];
      for (const a of acts) {
        if (a.type === 'delete') {
          const idsToDelete = new Set<string>();
          for (const target of a.targets) {
            const exact = ns.find((n) => n.id === target);
            if (exact) {
              idsToDelete.add(exact.id);
            } else {
              const types = ['lathe', 'sphere', 'box', 'cylinder', 'sdfSphere', 'sdfBox', 'sdfCapsule', 'sdfTorus', 'sdfUnion', 'sdfToMesh', 'boolean', 'transform', 'ambientLight', 'directionalLight', 'pointLight', 'camera', 'linearArray', 'radialArray', 'mirror', 'group'];
              for (const t of types) {
                if (String(target).includes(t)) {
                  const fuzzy = ns.find((n) => String(n.id).startsWith(t));
                  if (fuzzy) { idsToDelete.add(fuzzy.id); break; }
                }
              }
            }
          }
          ns = ns.filter((n) => !idsToDelete.has(n.id));
          es = es.filter((e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target));
        } else if (a.type === 'duplicate') {
          const src = ns.find((n) => n.id === a.target);
          if (!src) continue;
          const offset = a.offset ?? [0.5, 0, 0];
          const cnt = Math.min(a.count ?? 1, 8);
          for (let c = 0; c < cnt; c++) {
            const newId = `${(src.data as any).nodeType}-copy-${Date.now()}-${c}`;
            const factor = c + 1;
            ns = [...ns, {
              ...src, id: newId,
              position: { x: src.position.x + 40 + c * 20, y: src.position.y + 40 },
              data: { ...src.data, params: {
                ...(src.data as any).params,
                ox: ((src.data as any).params?.ox ?? 0) + offset[0] * factor,
                oy: ((src.data as any).params?.oy ?? 0) + offset[1] * factor,
                oz: ((src.data as any).params?.oz ?? 0) + offset[2] * factor,
              } },
            }];
            newSelect.push(newId);
          }
        }
      }
      setNodes(ns);
      setEdges(es);
      if (newSelect.length) setSelectedNodeIds(newSelect);
      didSomething = true;
      log('info', `执行 ${result.actions.length} 个操作`);
    }

    if (result.mode === 'sdf' && result.strokes?.length) {
      const { nodes: sn, edges: se } = buildSDFFromStrokes(
        result.strokes, result.smooth ?? 0.15, result.size ?? 2, result.color ?? '#a97aff'
      );
      const outputNode = nodes.find((n) => (n.data as any).nodeType === 'output');
      const newEdges = [...se];
      if (outputNode) {
        const meshNode = sn.find((n) => (n.data as any).nodeType === 'sdfToMesh');
        if (meshNode) {
          newEdges.push({
            id: `e-${meshNode.id}-out`,
            source: meshNode.id, sourceHandle: 'mesh',
            target: outputNode.id, targetHandle: 'mesh',
          });
        }
      }
      setNodes((ns) => [...ns, ...sn]);
      setEdges((es) => [...es, ...newEdges]);
      log('success', `SDF 模式完成，${sn.length} 个节点`);
      return;
    }

    if (result.mode === 'lathe' && result.lathe) {
      const latheId = `lathe-${Date.now()}`;
      const outputNode = nodes.find((n) => (n.data as any).nodeType === 'output');
      const newNodes: Node[] = [{
        id: latheId, type: 'custom',
        position: findFreeSpot(nodes, 120, 100),
        data: { nodeType: 'lathe', params: {
          profile: JSON.stringify(result.lathe.profile),
          segments: result.lathe.segments ?? 48,
          color: result.lathe.color ?? '#a8d8ff',
          ox: 0, oy: 0, oz: 0,
        } },
      }];
      const newEdges: Edge[] = [];
      if (outputNode) {
        newEdges.push({
          id: `e-${latheId}`, source: latheId, sourceHandle: 'mesh',
          target: outputNode.id, targetHandle: 'mesh',
        });
      }
      setNodes((ns) => [...ns, ...newNodes]);
      if (newEdges.length) setEdges((es) => [...es, ...newEdges]);
      log('success', `Lathe 模式完成，${result.lathe.profile.length} 个轮廓点`);
      return;
    }

    if (result.nodes?.length) {
      const filteredNodes = result.nodes.filter((n: any) => n.type !== 'output');

      if (filteredNodes.length === 0) {
        log('warn', 'AI 只返回了 output 节点，已忽略');
        return;
      }

      const spots: { x: number; y: number }[] = [];
      for (let i = 0; i < filteredNodes.length; i++) spots.push(findFreeSpot(nodes, 80, 60, spots));
      const newRfNodes = filteredNodes.map((n: any, i: number) => ({
        id: `${n.type}-${Date.now()}-${i}`,
        type: 'custom',
        position: spots[i],
        data: {
          nodeType: n.type,
          params: (() => {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(n.params ?? {})) {
              if (v === null || v === undefined) out[k] = v;
              else if (Array.isArray(v)) out[k] = JSON.stringify(v);
              else if (typeof v === 'object') out[k] = JSON.stringify(v);
              else out[k] = v;
            }
            return out;
          })(),
        },
      }));

      const outputNode = nodes.find((n) => (n.data as any).nodeType === 'output');
      const idMap = new Map<string, string>();
      filteredNodes.forEach((n: any, i: number) => idMap.set(n.id, newRfNodes[i].id));

      const aiEdges: Edge[] = [];
      const fakeOutputIds = new Set(['output', 'out', 'out-1', 'output-1']);

      for (const l of result.links ?? []) {
        if (
          fakeOutputIds.has(String(l.to)) ||
          (String(l.to).includes('output') && !idMap.has(l.to))
        ) {
          if (outputNode) {
            const fromId = idMap.get(l.from);
            if (fromId) {
              aiEdges.push({
                id: `e-${fromId}-out`,
                source: fromId, sourceHandle: l.fromPort,
                target: outputNode.id, targetHandle: 'mesh',
              });
            }
          }
          continue;
        }

        const fromId = idMap.get(l.from);
        const toId = idMap.get(l.to);
        if (fromId && toId) {
          aiEdges.push({
            id: `e-${fromId}-${toId}-${l.toPort}`,
            source: fromId, sourceHandle: l.fromPort,
            target: toId, targetHandle: l.toPort,
          });
        }
      }

      if (aiEdges.length === 0 && outputNode) {
        for (const n of newRfNodes) {
          const def = getNode((n.data as any).nodeType);
          if (def?.outputs.some((o) => o.name === 'mesh')) {
            aiEdges.push({
              id: `e-${n.id}-out`,
              source: n.id, sourceHandle: 'mesh',
              target: outputNode.id, targetHandle: 'mesh',
            });
          }
        }
      }

      // ★ 如果 AI 要求打包成组
      if (result.wrapAsGroup && newRfNodes.length >= 2) {
        const groupName = result.groupName ?? '组';
        const allNodes = [...nodes, ...newRfNodes];
        const allEdges = [...edges, ...aiEdges];
        try {
          const packed = packGroup(newRfNodes, allNodes, allEdges, groupName);
          setNodes(packed.remainingNodes);
          setEdges(packed.remainingEdges);
          log('success', `新增「${groupName}」组，含 ${newRfNodes.length} 个部件`);
          return;
        } catch (e) {
          log('warn', `自动打包失败，直接添加：${(e as Error).message}`);
        }
      }

      setNodes((ns) => [...ns, ...newRfNodes]);
      if (aiEdges.length) setEdges((es) => [...es, ...aiEdges]);
      log('success', `新增 ${newRfNodes.length} 个节点，${aiEdges.length} 条连线`);
      return;
    }

    if (!didSomething && !result.chatReply) {
      log('warn', 'AI 返回为空，未做任何操作');
    }
  }

  async function runAI(text: string) {
    if (aiBusy) return;

    setChatHistory((h) => [...h, { role: 'user', content: text }]);
    log('ai-req', `用户：${text.slice(0, 40)}`, 'AI');
    setAiBusy(true);

    try {
      const graph = rfToGraph(nodes, edges);
      const result = await askAI(aiConfig, text, graph, llmHistory, memory, selectedId);

      if (result.chatReply) {
        setChatHistory((h) => [...h, { role: 'assistant', content: result.chatReply! }]);
        setLlmHistory((h) => [
          ...h,
          { role: 'user', content: text },
          { role: 'assistant', content: result.chatReply! },
        ]);
        log('success', '聊天回复', 'AI');
      } else {
        await applyAIResult(result, false, text);
        if (result.memory) updateMemory(result.memory);

        const parts: string[] = [];
        if (result.nodes?.length) parts.push(`新增 ${result.nodes.length} 个节点`);
        if (result.updates?.length) parts.push(`更新 ${result.updates.length} 个参数`);
        if (result.actions?.length) parts.push(`${result.actions.length} 个操作`);
        if (result.wrapAsGroup) parts.push(`打包「${result.groupName ?? '组'}」`);
        const summary = parts.length > 0 ? `✓ ${parts.join('，')}` : '✓ 完成';

        setChatHistory((h) => [...h, { role: 'assistant', content: summary }]);
        // 不把"✓ 新增…"写进 llmHistory，否则模型会模仿着只回文字、不再输出 JSON
      }
    } catch (e) {
      const errMsg = (e as Error).message;
      setChatHistory((h) => [...h, { role: 'assistant', content: `❌ 出错：${errMsg}` }]);
      log('error', `AI 请求失败：${errMsg}`, 'AI');
    } finally {
      setAiBusy(false);
    }
  }

  async function runSceneAnalysis() {
    if (aiBusy) {
      log('warn', 'AI 正忙，稍后再试', 'AI');
      return;
    }
    if (meshes.length === 0) {
      log('warn', '场景是空的，先做一个模型', 'AI');
      return;
    }

    setAiBusy(true);
    setChatHistory((h) => [...h, { role: 'user', content: '🔍 分析我的场景' }]);
    log('info', '开始分析场景…', 'AI');

    try {
      const graph = rfToGraph(nodes, edges);
      const text = await askSceneAnalysis(aiConfig, graph);
      setChatHistory((h) => [...h, { role: 'assistant', content: text }]);
      setLlmHistory((h) => [
        ...h,
        { role: 'user', content: '分析我的场景' },
        { role: 'assistant', content: text },
      ]);
      log('success', '场景分析完成', 'AI');
    } catch (e) {
      setChatHistory((h) => [...h, { role: 'assistant', content: `分析失败：${(e as Error).message}` }]);
      log('error', `分析失败：${(e as Error).message}`, 'AI');
    } finally {
      setAiBusy(false);
    }
  }

  function handleClearChat() {
    setChatHistory([]);
    setLlmHistory([]);
    try {
      localStorage.removeItem('chat-history');
      localStorage.removeItem('llm-history');
    } catch {}
    log('info', '已清空对话');
  }

  async function runVisionIteration(goal: string, maxRounds = 5) {
    if (iterating || aiBusy) return;
    if (!configSupportsVision(aiConfig)) {
      setChatHistory((h) => [...h, {
        role: 'assistant',
        content: '当前 AI 不支持图片，无法看图迭代。请切换到支持视觉的模型。',
      }]);
      return;
    }
    if (!(window as any).__capture3D) {
      setChatHistory((h) => [...h, {
        role: 'assistant',
        content: '3D 视口未就绪，请稍后再试。',
      }]);
      return;
    }

    setIterating(true);
    setChatHistory((h) => [...h, { role: 'user', content: `【看图迭代】${goal}` }]);
    log('info', `开始看图迭代：${goal}`, 'AI');

    try {
      for (let round = 1; round <= maxRounds; round++) {
        await new Promise((r) => setTimeout(r, 300));
        const image = (window as any).__capture3D();
        if (!image || image.length < 100) break;

        const graph = rfToGraph(nodes, edges);
        const result = await askAIWithImage(
          aiConfig, `用户目标：${goal}`, image, graph, goal, round
        );

        const obs = result.observation ?? '';
        const nxt = result.next ?? '';
        setChatHistory((h) => [...h, {
          role: 'assistant',
          content: `第 ${round} 轮 · 观察：${obs} · 下一步：${nxt}`,
        }]);
        log('ai-res', `第 ${round} 轮：${obs}`, 'AI');

        await applyAIResult(result, false, goal);
        if (result.memory) updateMemory(result.memory);

        if (result.done) {
          setChatHistory((h) => [...h, { role: 'assistant', content: `✓ 完成，共 ${round} 轮。` }]);
          log('success', `迭代完成，共 ${round} 轮`, 'AI');
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (e) {
      setChatHistory((h) => [...h, { role: 'assistant', content: `迭代失败：${(e as Error).message}` }]);
      log('error', `迭代失败：${(e as Error).message}`, 'AI');
    } finally {
      setIterating(false);
    }
  }

  async function runMultiViewGenerate(sketch: SketchSet, goal: string) {
    if (sketchBusy || aiBusy || iterating) return;
    if (!configSupportsVision(aiConfig)) {
      setChatHistory((h) => [...h, {
        role: 'assistant',
        content: '当前 AI 不支持图片，无法分析。请切换到支持视觉的模型。',
      }]);
      return;
    }

    const images: { data: string; label: string }[] = [];
    if (sketch.front?.data) images.push({ data: sketch.front.data, label: '正视图' });
    if (sketch.side?.data) images.push({ data: sketch.side.data, label: '侧视图' });
    if (sketch.top?.data) images.push({ data: sketch.top.data, label: '顶视图' });
    if (sketch.frames?.length) {
      sketch.frames.forEach((f, i) => images.push({ data: f.data, label: `视频第 ${i + 1} 帧` }));
    }

    if (images.length === 0) return;

    setSketchBusy(true);
    setSketchSet(sketch);
    setChatHistory((h) => [...h, { role: 'user', content: `【${images.length} 张图生 3D】${goal || '生成模型'}` }]);
    log('info', `分析 ${images.length} 张图`, 'AI');

    try {
      const result = await askAIMultiView(aiConfig, images, goal);

      if (result.error || result.mode === 'unknown') {
        setChatHistory((h) => [...h, { role: 'assistant', content: `无法识别：${result.error ?? '请重新绘制'}` }]);
        log('warn', `无法识别：${result.error ?? '原因未知'}`, 'AI');
        setSketchBusy(false);
        return;
      }

      if (!result.mode && !result.strokes?.length && !result.lathe && !result.nodes?.length) {
        setChatHistory((h) => [...h, { role: 'assistant', content: '❌ AI 没有返回可用的结构数据，请重试' }]);
        log('error', 'AI 返回空结构', 'AI');
        setSketchBusy(false);
        return;
      }

      const subj = result.subject ?? '（已识别）';
      setChatHistory((h) => [...h, { role: 'assistant', content: `识别为：${subj}（${result.mode}）` }]);
      log('ai-res', `识别为：${subj}`, 'AI');

      const outputNode = nodes.find((n) => (n.data as any).nodeType === 'output');
      if (outputNode) {
        setNodes([outputNode]);
        setEdges([]);
        await new Promise((r) => setTimeout(r, 50));
      }

      await applyAIResult(result, false, goal);
      setSketchOpen(false);
      setChatHistory((h) => [...h, { role: 'assistant', content: `✓ ${result.mode} 模式完成` }]);
    } catch (e) {
      setChatHistory((h) => [...h, { role: 'assistant', content: `❌ 生成失败：${(e as Error).message}` }]);
      log('error', `生成失败：${(e as Error).message}`, 'AI');
    } finally {
      setSketchBusy(false);
    }
  }

  async function handleImageUpload(file: File) {
    try {
      log('info', `上传图片：${file.name}`, 'AI');
      const raw = await fileToDataUrl(file);
      const compressed = await compressImage(raw, 768, 0.82);
      await runMultiViewGenerate({
        front: { data: compressed, updatedAt: Date.now() },
      }, '复刻这张图里的主体');
    } catch (e) {
      log('error', `图片处理失败：${(e as Error).message}`, 'AI');
    }
  }

  async function handleVideoUpload(file: File) {
    log('info', `上传视频：${file.name}`, 'AI');
    setChatHistory((h) => [...h, { role: 'assistant', content: '正在抽取视频帧…' }]);
    try {
      const frames = await extractFrames(file, 6, 640);
      log('info', `抽出 ${frames.length} 帧`, 'AI');
      await runMultiViewGenerate({
        frames: frames.map((d) => ({ data: d, updatedAt: Date.now() })),
      }, '根据视频生成 3D 模型');
    } catch (e) {
      log('error', `视频处理失败：${(e as Error).message}`, 'AI');
    }
  }

  async function handleSketchGenerate(sketch: SketchSet, goal: string) {
    await runMultiViewGenerate(sketch, goal);
  }

  async function handleExport(format: 'obj' | 'gltf' | 'stl') {
    if (meshes.length === 0) return;
    try {
      if (format === 'obj') exportOBJ(meshes, 'model.obj');
      else if (format === 'gltf') await exportGLTF(meshes, 'model.glb', true);
      else exportSTL(meshes, 'model.stl');
      log('success', `导出 ${format.toUpperCase()}，${meshes.length} 个网格`);
    } catch (e) {
      log('error', `导出失败：${(e as Error).message}`);
    }
  }

  function handleNewProject() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setNodes(DEFAULT_NODES);
    setEdges(DEFAULT_EDGES);
    setGraphStack([]);
    setSelectedMeshNodeId(null);
    setSelectedNodeIds([]);
    setSelectedId(null);
    setSketchSet(null);
    setChatHistory([]);
    setLlmHistory([]);
    resetHistoryWith(DEFAULT_NODES, DEFAULT_EDGES);
    log('info', '新建项目');
  }

  async function handleOpenProject() {
    try {
      const data = await openProject();
      setNodes(data.nodes);
      setEdges(data.edges);
      setGraphStack([]);
      setSelectedMeshNodeId(null);
      setSelectedNodeIds([]);
      setSelectedId(null);
      resetHistoryWith(data.nodes, data.edges);
      saveState(data.nodes, data.edges);
      log('success', `打开项目：${data.name}`);
    } catch (e) {
      log('error', `打开失败：${(e as Error).message}`);
    }
  }

  function handleSaveProject() {
    const name = prompt('项目名称', 'untitled') || 'untitled';
    saveProject(nodes, edges, name);
    log('success', `保存项目：${name}`);
  }

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const selectedMeshNode = nodes.find((n) => n.id === selectedMeshNodeId) ?? null;

  const selectedPosition = (() => {
    if (!selectedMeshNode) return null;
    const params = (selectedMeshNode.data as any).params ?? {};
    return {
      x: (params.ox ?? params.x ?? 0) as number,
      y: (params.oy ?? params.y ?? 0) as number,
      z: (params.oz ?? params.z ?? 0) as number,
    };
  })();

  function handlePositionChange(x: number, y: number, z: number) {
    if (!selectedMeshNodeId) return;
    setNodes((ns) => ns.map((n) => {
      if (n.id !== selectedMeshNodeId) return n;
      const params = (n.data as any).params ?? {};
      const patch: Record<string, unknown> = {};
      if (params.ox !== undefined) {
        patch.ox = x; patch.oy = y; patch.oz = z;
      } else if (params.x !== undefined) {
        patch.x = x; patch.y = y; patch.z = z;
      } else {
        patch.ox = x; patch.oy = y; patch.oz = z;
      }
      return { ...n, data: { ...n.data, params: { ...params, ...patch } } };
    }));
  }

  const crumbs = [
    { id: null, label: '顶层' },
    ...graphStack.map((f) => ({ id: f.groupNodeId, label: f.name })),
  ];

  const nodeToolbar = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', background: '#0f1115',
      borderBottom: '1px solid #2a2f3a', flexShrink: 0, flexWrap: 'wrap',
    }}>
      <select
        onChange={(e) => { if (e.target.value) { addNode(e.target.value); e.target.value = ''; } }}
        style={{
          background: '#242832', color: '#eef1f6', border: '1px solid #2a2f3a',
          padding: '4px 8px', borderRadius: 5, fontSize: 11, colorScheme: 'dark',
        }}
      >
        <option value="">+ 节点</option>
        <optgroup label="基础体">
          <option value="box">立方体</option>
          <option value="sphere">球体</option>
          <option value="cylinder">圆柱体</option>
          <option value="lathe">旋转体</option>
        </optgroup>
        <optgroup label="SDF">
          <option value="sdfSphere">SDF 球</option>
          <option value="sdfBox">SDF 方</option>
          <option value="sdfCapsule">SDF 胶囊</option>
          <option value="sdfTorus">SDF 环</option>
          <option value="sdfUnion">SDF 并集</option>
          <option value="sdfSubtract">SDF 差集</option>
          <option value="sdfIntersect">SDF 交集</option>
          <option value="sdfToMesh">SDF → 网格</option>
          <option value="voxelPreview">体素预览</option>
        </optgroup>
        <optgroup label="修改">
          <option value="transform">变换</option>
          <option value="boolean">CSG 布尔</option>
          <option value="linearArray">线性阵列</option>
          <option value="radialArray">环形阵列</option>
          <option value="mirror">镜像</option>
        </optgroup>
        <optgroup label="灯光">
          <option value="ambientLight">环境光</option>
          <option value="directionalLight">平行光</option>
          <option value="pointLight">点光</option>
        </optgroup>
        <optgroup label="相机">
          <option value="camera">相机</option>
        </optgroup>
        <optgroup label="IO">
          <option value="loadModel">导入模型</option>
          <option value="exportOBJ">导出 OBJ</option>
          <option value="exportGLTF">导出 GLTF</option>
          <option value="exportSTL">导出 STL</option>
        </optgroup>
        <option value="output">输出</option>
      </select>

      <button
        onClick={handlePackGroup}
        disabled={selectedNodeIds.length < 2}
        style={{
          background: selectedNodeIds.length >= 2 ? 'linear-gradient(135deg, #3555cc, #5b8cff)' : '#242832',
          color: selectedNodeIds.length >= 2 ? '#fff' : '#4d5460',
          border: 'none', padding: '4px 10px', borderRadius: 5,
          fontSize: 11, cursor: selectedNodeIds.length >= 2 ? 'pointer' : 'not-allowed',
        }}
      >
        📦 打包
      </button>

      <span style={{ color: '#4d5460', fontSize: 11 }}>|</span>
      <span style={{ color: '#7a8292', fontSize: 10 }}>SDF：</span>
      <button onClick={() => handleLoadSDFTemplate('peanut')} style={tinyBtnStyle}>花生</button>
      <button onClick={() => handleLoadSDFTemplate('mushroom')} style={tinyBtnStyle}>蘑菇</button>
      <span style={{ color: '#4d5460', fontSize: 11 }}>|</span>
      <span style={{ color: '#7a8292', fontSize: 10 }}>CSG：</span>
      <button onClick={() => handleLoadCSGTemplate('cube-hole')} style={tinyBtnStyle}>方块挖洞</button>
    </div>
  );

  const viewModeBar = (
    <div style={{
      display: 'flex', gap: 2, padding: '4px 8px',
      background: '#0f1115', borderBottom: '1px solid #2a2f3a',
      flexShrink: 0, alignItems: 'center',
    }}>
      {([
        { id: '3d' as ViewMode, label: '3D' },
        { id: 'split' as ViewMode, label: '分屏' },
        { id: 'nodes' as ViewMode, label: '节点' },
      ]).map((m) => (
        <button
          key={m.id}
          onClick={() => setViewMode(m.id)}
          style={{
            background: viewMode === m.id ? 'rgba(91,140,255,0.15)' : 'transparent',
            color: viewMode === m.id ? '#7ba4ff' : '#7a8292',
            border: `1px solid ${viewMode === m.id ? 'rgba(91,140,255,0.4)' : 'transparent'}`,
            padding: '3px 12px', borderRadius: 5,
            fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#0f1115', overflow: 'hidden',
    }}>
      <TopBar
        onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
        advancedOpen={advancedOpen}
        onExport={handleExport}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        hasModel={meshes.length > 0}
        aiStatus={aiStatus}
        aiLabel={getPreset(aiConfig.provider)?.name ?? 'AI'}
        onTestConnection={testAIConnection}
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          minWidth: 0, borderRight: '1px solid #2a2f3a',
        }}>
          {viewModeBar}

          <div ref={splitContainerRef} style={{
            flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
          }}>
            {(viewMode === '3d' || viewMode === 'split') && (
              <div style={{
                flex: viewMode === '3d' ? 1 : splitRatio,
                minHeight: 100, position: 'relative',
              }}>
                <Viewport
                  meshes={meshes}
                  lights={lights}
                  cameras={cameras}
                  selectedMeshNodeId={selectedMeshNodeId}
                  onSelectMesh={handleSelectMesh}
                  onTransformMesh={handleTransformMesh}
                  onDuplicateMesh={handleDuplicateMesh}
                  onDeleteMesh={handleDeleteMesh}
                  onExportFormat={handleExport}
                  onIsTransformingChange={(v) => { isTransformingRef.current = v; }}
                  selectedPosition={selectedPosition}
                  onPositionChange={handlePositionChange}
                />
              </div>
            )}

            {viewMode === 'split' && (
              <div
                onMouseDown={onSplitterMouseDown}
                style={{
                  height: 8, background: '#0a0c10', cursor: 'row-resize',
                  flexShrink: 0, borderTop: '1px solid #2a2f3a',
                  borderBottom: '1px solid #2a2f3a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <div style={{ width: 40, height: 2, background: '#3a4050', borderRadius: 1 }} />
              </div>
            )}

            {(viewMode === 'nodes' || viewMode === 'split') && (
              <div style={{
                flex: viewMode === 'nodes' ? 1 : (1 - splitRatio),
                minHeight: 100, display: 'flex',
                flexDirection: 'column', position: 'relative',
              }}>
                <Breadcrumb crumbs={crumbs} onNavigate={handleCrumbNavigate} />
                {nodeToolbar}
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <NodeEditor
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={handleNodeClickStable}
                    onSelectionChange={handleSelectionChangeStable}
                    onContextAction={(action, nodeId) => {
                      if (nodeId) setSelectedNodeIds([nodeId]);
                      if (action === 'copy') handleCopy();
                      else if (action === 'paste') handlePaste();
                      else if (action === 'duplicate') handleDuplicate();
                      else if (action === 'delete') handleDelete();
                      else if (action === 'select-all') handleSelectAll();
                      else if (action === 'undo') handleUndo();
                      else if (action === 'redo') handleRedo();
                    }}
                    onAddNode={addNode}
                    onNodeDoubleClick={handleEnterGroup}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div ref={rightContainerRef} style={{
          width: 400, display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{
            flex: rightRatio, minHeight: 120,
            display: 'flex', flexDirection: 'column', minWidth: 0,
          }}>
            <ChatMain
              history={chatHistory}
              busy={aiBusy || iterating || sketchBusy}
              iterating={iterating}
              onSend={runAI}
              onClear={handleClearChat}
              onImageUpload={handleImageUpload}
              onOpenSketch={() => setSketchOpen(true)}
              onVideoUpload={handleVideoUpload}
              onVisionIterate={runVisionIteration}
              onAnalyzeScene={runSceneAnalysis}
              visionAvailable={configSupportsVision(aiConfig)}
              hasModel={meshes.length > 0}
            />
          </div>

          <div
            onMouseDown={onRightSplitterMouseDown}
            style={{
              height: 6, background: '#0a0c10', cursor: 'row-resize',
              flexShrink: 0, borderTop: '1px solid #2a2f3a',
              borderBottom: '1px solid #2a2f3a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ width: 30, height: 2, background: '#3a4050', borderRadius: 1 }} />
          </div>

          <div style={{
            flex: 1 - rightRatio, minHeight: 100,
            overflowY: 'auto', background: '#16181d',
          }}>
            <NodeInspector
              nodeId={selectedId}
              nodeType={selectedNode ? (selectedNode.data as any).nodeType : null}
              params={selectedNode ? ((selectedNode.data as any).params ?? {}) : {}}
              onChange={updateSelectedParams}
            />
          </div>
        </div>
      </div>

      <LogPanel />

      <AdvancedPanel
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        selectedId={selectedId}
        selectedNode={selectedNode}
        updateSelectedParams={updateSelectedParams}
        aiConfig={aiConfig}
        setAIConfig={setAIConfig}
      />

      <SketchPad
        open={sketchOpen}
        onClose={() => setSketchOpen(false)}
        initial={sketchSet}
        onGenerate={handleSketchGenerate}
        busy={sketchBusy}
        available={configSupportsVision(aiConfig)}
      />
    </div>
  );
}

const tinyBtnStyle: React.CSSProperties = {
  background: '#242832', color: '#b8bfcc',
  border: '1px solid #2a2f3a',
  padding: '3px 8px', borderRadius: 4,
  fontSize: 10, cursor: 'pointer',
};