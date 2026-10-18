import {
  ReactFlow, Background, Controls, MiniMap,
  useReactFlow, ReactFlowProvider,
  type Node, type Edge, type Connection,
  type NodeChange, type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useState } from 'react';
import { CustomNode } from './CustomNode';
import { ContextMenu, type MenuItem } from '../ui/ContextMenu';
import { listNodes } from '../core/registry';

const nodeTypes = { custom: CustomNode };

const CATEGORY_LABELS: Record<string, string> = {
  geometry: '基础体',
  sdf: 'SDF',
  modify: '修改',
  light: '灯光',
  camera: '相机',
  output: '输出',
};

const CATEGORY_ORDER = ['geometry', 'sdf', 'modify', 'light', 'camera', 'output'];

export type NodeContextAction =
  | 'copy' | 'paste' | 'duplicate' | 'delete'
  | 'select-all' | 'undo' | 'redo';

interface Props {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  onNodeClick: (id: string) => void;
  onSelectionChange?: (ids: string[]) => void;
  onContextAction?: (action: NodeContextAction, nodeId?: string) => void;
  onAddNode?: (type: string) => void;
  onNodeDoubleClick?: (id: string) => void;
}

/** 从 registry 自动生成"添加节点"菜单项，按类别分组 */
function buildAddNodeItems(onAddNode?: (type: string) => void): MenuItem[] {
  const all = listNodes();
  const byCategory = new Map<string, typeof all>();
  for (const def of all) {
    if (!byCategory.has(def.category)) byCategory.set(def.category, []);
    byCategory.get(def.category)!.push(def);
  }

  const sortedCategories = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...Array.from(byCategory.keys()).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  const items: MenuItem[] = [];
  for (const cat of sortedCategories) {
    const defs = byCategory.get(cat)!;
    // 类别标题（禁用项，仅作视觉分组）
    items.push({
      label: `━━ ${CATEGORY_LABELS[cat] ?? cat} ━━`,
      disabled: true,
      onClick: () => {},
    });
    for (const def of defs) {
      items.push({
        label: `  ＋ ${def.label}`,
        onClick: () => onAddNode?.(def.type),
      });
    }
  }
  return items;
}

function NodeEditorInner({
  nodes, edges, onNodesChange, onEdgesChange,
  onConnect, onNodeClick, onSelectionChange,
  onContextAction, onAddNode, onNodeDoubleClick,
}: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const { fitView, getNodes } = useReactFlow();

  // 节点数变化后，如果节点跑出视野，自动 fitView
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const allNodes = getNodes();
        if (allNodes.length === 0) return;
        fitView({ padding: 0.2, duration: 300 });
      } catch {
        // ignore
      }
    }, 200);
    return () => clearTimeout(t);
  }, [nodes.length, fitView, getNodes]);

  const handleSelectionChange = useCallback(
    ({ nodes: sel }: { nodes: Node[] }) => {
      if (!onSelectionChange) return;
      onSelectionChange(sel.map((n) => n.id));
    },
    [onSelectionChange]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, n: Node) => {
      onNodeClick(n.id);
    },
    [onNodeClick]
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, n: Node) => {
      onNodeDoubleClick?.(n.id);
    },
    [onNodeDoubleClick]
  );

  function handleNodeContextMenu(e: React.MouseEvent, node: Node) {
    e.preventDefault();
    onNodeClick(node.id);
    const isGroup = (node.data as any).nodeType === 'group';

    const items: MenuItem[] = [];

    if (isGroup) {
      items.push({
        label: '进入组内编辑',
        onClick: () => onNodeDoubleClick?.(node.id),
      });
      items.push({ divider: true, label: '', onClick: () => {} });
    }

    items.push(
      { label: '复制', shortcut: 'Ctrl+C', onClick: () => onContextAction?.('copy', node.id) },
      { label: '再制', shortcut: 'Ctrl+D', onClick: () => onContextAction?.('duplicate', node.id) },
      { divider: true, label: '', onClick: () => {} },
      { label: '删除节点', shortcut: 'Del', onClick: () => onContextAction?.('delete', node.id) }
    );

    setMenu({ x: e.clientX, y: e.clientY, items });
  }

  function handleEdgeContextMenu(e: React.MouseEvent, edge: Edge) {
    e.preventDefault();
    e.stopPropagation();

    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    const sourceType = sourceNode ? (sourceNode.data as any).nodeType : '';
    const targetType = targetNode ? (targetNode.data as any).nodeType : '';

    const items: MenuItem[] = [
      {
        label: '删除这条连线',
        onClick: () => onEdgesChange([{ id: edge.id, type: 'remove' }]),
      },
      { divider: true, label: '', onClick: () => {} },
      {
        label: `选源节点 (${sourceType})`,
        disabled: !sourceNode,
        onClick: () => { if (sourceNode) onNodeClick(sourceNode.id); },
      },
      {
        label: `选目标节点 (${targetType})`,
        disabled: !targetNode,
        onClick: () => { if (targetNode) onNodeClick(targetNode.id); },
      },
      { divider: true, label: '', onClick: () => {} },
      {
        label: '删除源节点',
        disabled: !sourceNode,
        onClick: () => { if (sourceNode) onContextAction?.('delete', sourceNode.id); },
      },
      {
        label: '删除目标节点',
        disabled: !targetNode,
        onClick: () => { if (targetNode) onContextAction?.('delete', targetNode.id); },
      },
    ];
    setMenu({ x: e.clientX, y: e.clientY, items });
  }

  function handlePaneContextMenu(e: React.MouseEvent | MouseEvent) {
    e.preventDefault();

    const items: MenuItem[] = [
      { label: '适应视图', shortcut: 'F', onClick: () => fitView({ padding: 0.2, duration: 300 }) },
      { divider: true, label: '', onClick: () => {} },
      { label: '粘贴', shortcut: 'Ctrl+V', onClick: () => onContextAction?.('paste') },
      { label: '全选', shortcut: 'Ctrl+A', onClick: () => onContextAction?.('select-all') },
      { divider: true, label: '', onClick: () => {} },
      { label: '撤销', shortcut: 'Ctrl+Z', onClick: () => onContextAction?.('undo') },
      { label: '重做', shortcut: 'Ctrl+Shift+Z', onClick: () => onContextAction?.('redo') },
      { divider: true, label: '', onClick: () => {} },
    ];

    // ★ 从 registry 自动生成所有节点，按类别分组
    items.push(...buildAddNodeItems(onAddNode));

    const ev = e as MouseEvent;
    setMenu({ x: ev.clientX, y: ev.clientY, items });
  }

  // F 键：适应视图
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        fitView({ padding: 0.2, duration: 300 });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fitView]);

  return (
    <>
      <div style={{
        position: 'absolute',
        top: 8, left: 8,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        zIndex: 5,
        background: 'rgba(20,22,28,0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #2a2f3a',
        borderRadius: 6,
        padding: '4px 8px',
      }}>
        <button
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
          title="适应视图 (F)"
          style={{
            background: 'transparent',
            color: '#b8bfcc',
            border: '1px solid #3a4050',
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          ⤢ 适应视图
        </button>
        <span style={{ fontSize: 10, color: '#7a8292' }}>
          {nodes.length} 节点 · {edges.length} 连线
        </span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onSelectionChange={handleSelectionChange}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        selectionOnDrag
        multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
        panOnDrag={[1, 2]}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#16181d', width: '100%', height: '100%' }}
      >
        <Background color="#22262f" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const nt = (n.data as any)?.nodeType;
            if (nt === 'output') return '#4dd699';
            if (nt?.startsWith('sdf')) return '#4dd699';
            if (nt?.includes('Light')) return '#ffd93d';
            if (nt === 'camera') return '#c07aff';
            if (['boolean', 'transform', 'linearArray', 'radialArray', 'mirror'].includes(nt)) return '#a97aff';
            return '#5b8cff';
          }}
          maskColor="rgba(0,0,0,0.6)"
          style={{
            background: '#16181d',
            border: '1px solid #2a2f3a',
          }}
        />
      </ReactFlow>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

export function NodeEditor(props: Props) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlowProvider>
        <NodeEditorInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}