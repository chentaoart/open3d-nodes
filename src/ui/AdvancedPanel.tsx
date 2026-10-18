import { useState } from 'react';
import type { Node } from '@xyflow/react';
import { NodeInspector } from './NodeInspector';
import { AISettings } from './AISettings';
import type { AIConfig } from '../ai/provider';

type TabId = 'params' | 'settings';

interface Props {
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  selectedNode: Node | null;
  updateSelectedParams: (patch: Record<string, unknown>) => void;
  aiConfig: AIConfig;
  setAIConfig: (c: AIConfig) => void;
}

export function AdvancedPanel({
  open, onClose,
  selectedId, selectedNode, updateSelectedParams,
  aiConfig, setAIConfig,
}: Props) {
  const [tab, setTab] = useState<TabId>('params');

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 9000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92vw',
          maxWidth: 560,
          height: '100vh',
          background: '#16181d',
          borderLeft: '1px solid #3a4050',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.2s ease',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          borderBottom: '1px solid #2a2f3a',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#eef1f6' }}>
            ⚙ 高级
          </span>

          <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
            {([
              { id: 'params' as TabId, label: '节点参数' },
              { id: 'settings' as TabId, label: 'AI 设置' },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: tab === t.id ? 'rgba(91,140,255,0.15)' : 'transparent',
                  color: tab === t.id ? '#7ba4ff' : '#7a8292',
                  border: tab === t.id ? '1px solid rgba(91,140,255,0.4)' : '1px solid transparent',
                  padding: '5px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={onClose}
            style={{
              width: 30, height: 30,
              background: 'transparent',
              color: '#7a8292',
              border: '1px solid #2a2f3a',
              borderRadius: 6,
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'params' && (
            <NodeInspector
              nodeId={selectedId}
              nodeType={selectedNode ? (selectedNode.data as any).nodeType : null}
              params={selectedNode ? ((selectedNode.data as any).params ?? {}) : {}}
              onChange={updateSelectedParams}
            />
          )}
          {tab === 'settings' && (
            <AISettings config={aiConfig} onChange={setAIConfig} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}