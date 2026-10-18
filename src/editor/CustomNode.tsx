import { Handle, Position, type NodeProps } from '@xyflow/react';
import { getNode } from '../core/registry';

const CATEGORY_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  geometry: { bg: '#1a2030', border: '#2e4a7a', dot: '#5b8cff' },
  modify:   { bg: '#231a30', border: '#5a3a7a', dot: '#a97aff' },
  sdf:      { bg: '#1f2a1a', border: '#4a7a2e', dot: '#4dd699' },
  light:    { bg: '#3a2f15', border: '#7a6320', dot: '#ffd93d' },
  camera:   { bg: '#2a1a3a', border: '#5a3a7a', dot: '#c07aff' },
  output:   { bg: '#1a2a20', border: '#3a7a4a', dot: '#4dd699' },
};

const FALLBACK_COLORS = {
  bg: '#1a1d24',
  border: '#3a4050',
  dot: '#7a8292',
};

export function CustomNode({ data, selected }: NodeProps) {
  const nodeType = (data as any)?.nodeType as string | undefined;

  if (!nodeType) {
    return (
      <div style={{
        padding: 10, borderRadius: 8,
        background: '#3a1e1e', border: '2px solid #ff6b6b',
        color: '#f99', fontSize: 11,
        minWidth: 120,
      }}>
        ⚠ 节点缺少类型
        <div style={{ fontSize: 10, color: '#fcc', marginTop: 4 }}>
          data: {JSON.stringify(data).slice(0, 60)}
        </div>
      </div>
    );
  }

  const def = getNode(nodeType);

  if (!def) {
    return (
      <div style={{
        padding: 10, borderRadius: 8,
        background: '#3a1e1e', border: '2px solid #ff6b6b',
        color: '#f99', fontSize: 11,
        minWidth: 120,
      }}>
        ⚠ 未注册的类型：<b>{nodeType}</b>
        <div style={{ fontSize: 10, color: '#fcc', marginTop: 4 }}>
          检查是否在 nodes/index.ts 里 import
        </div>
      </div>
    );
  }

  const colors = CATEGORY_COLORS[def.category] || FALLBACK_COLORS;

  return (
    <div
      style={{
        minWidth: 150,
        background: colors.bg,
        border: `2px solid ${selected ? '#5b8cff' : colors.border}`,
        borderRadius: 10,
        boxShadow: selected
          ? '0 0 0 3px rgba(91,140,255,0.4), 0 8px 24px rgba(0,0,0,0.5)'
          : '0 4px 12px rgba(0,0,0,0.4)',
        color: '#eef1f6',
        overflow: 'visible',
        transition: 'all 0.15s ease',
      }}
    >
      {/* 标题栏 */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px 8px 0 0',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: colors.dot,
          boxShadow: `0 0 8px ${colors.dot}99`,
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 600, fontSize: 12, letterSpacing: 0.2 }}>
          {def.label}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 9,
          color: '#7a8292',
          background: 'rgba(255,255,255,0.05)',
          padding: '1px 6px',
          borderRadius: 8,
        }}>
          {def.category}
        </span>
      </div>

      {/* 端口 */}
      <div style={{ padding: '8px 12px', minHeight: 20 }}>
        {def.inputs.length === 0 && def.outputs.length === 0 && (
          <div style={{ fontSize: 10, color: '#4d5460', fontStyle: 'italic' }}>
            （无端口）
          </div>
        )}

        {def.inputs.map((input) => (
          <div key={input.name} style={{ position: 'relative', marginTop: 6 }}>
            <Handle
              type="target"
              position={Position.Left}
              id={input.name}
              style={{
                background: colors.dot,
                left: -6,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 10, height: 10,
                border: '2px solid #0f1115',
              }}
            />
            <span style={{ fontSize: 11, color: '#b8bfcc' }}>
              {input.label ?? input.name}
            </span>
          </div>
        ))}

        {def.outputs.map((output) => (
          <div key={output.name} style={{ position: 'relative', marginTop: 6, textAlign: 'right' }}>
            <Handle
              type="source"
              position={Position.Right}
              id={output.name}
              style={{
                background: colors.dot,
                right: -6,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 10, height: 10,
                border: '2px solid #0f1115',
              }}
            />
            <span style={{ fontSize: 11, color: '#b8bfcc' }}>
              {output.label ?? output.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}