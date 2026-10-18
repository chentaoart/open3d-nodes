import type { CSSProperties } from 'react';

export type AIStatus = 'unknown' | 'checking' | 'connected' | 'error';

interface TopBarProps {
  onToggleAdvanced: () => void;
  advancedOpen: boolean;
  onExport: (format: 'obj' | 'gltf' | 'stl') => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasModel: boolean;
  aiStatus: AIStatus;
  aiLabel?: string;
  onTestConnection: () => void;
}

export function TopBar({
  onToggleAdvanced, advancedOpen,
  onExport, onNewProject, onOpenProject, onSaveProject,
  onUndo, onRedo, canUndo, canRedo, hasModel,
  aiStatus, aiLabel, onTestConnection,
}: TopBarProps) {
  const dot = statusDot(aiStatus);

  return (
    <div style={{
      height: 48,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '0 16px',
      background: '#16181d',
      borderBottom: '1px solid #2a2f3a',
      flexShrink: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#5b8cff',
          boxShadow: '0 0 10px #5b8cff',
        }} />
        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.3, color: '#eef1f6' }}>
          Open3D
        </span>
      </div>

      <button
        onClick={onTestConnection}
        title={`${aiLabel ?? 'AI'}：${dot.tooltip}（点击重新检测）`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: dot.bg,
          border: `1px solid ${dot.border}`,
          padding: '4px 10px',
          borderRadius: 12,
          fontSize: 11,
          color: dot.text,
          cursor: 'pointer',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: dot.color,
          boxShadow: `0 0 8px ${dot.color}80`,
          animation: aiStatus === 'checking' ? 'blink 1s ease-in-out infinite' : 'none',
        }} />
        <span>{aiLabel ?? 'AI'}</span>
        <span style={{ opacity: 0.7, fontSize: 10 }}>{dot.short}</span>
      </button>

      <div style={dividerStyle} />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="撤销 (Ctrl+Z)"
        style={iconBtnStyle(canUndo)}
      >↶</button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="重做 (Ctrl+Shift+Z)"
        style={iconBtnStyle(canRedo)}
      >↷</button>

      <div style={dividerStyle} />

      <select
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'new') onNewProject();
          else if (v === 'open') onOpenProject();
          else if (v === 'save') onSaveProject();
          e.target.value = '';
        }}
        style={selStyle}
      >
        <option value="">文件</option>
        <option value="new">新建</option>
        <option value="open">打开…</option>
        <option value="save">保存</option>
      </select>

      <button
        onClick={onToggleAdvanced}
        title="高级面板（节点图、参数、设置）"
        style={{
          background: advancedOpen ? 'rgba(91,140,255,0.15)' : '#242832',
          color: advancedOpen ? '#7ba4ff' : '#eef1f6',
          border: advancedOpen ? '1px solid rgba(91,140,255,0.4)' : '1px solid #2a2f3a',
          padding: '5px 12px', borderRadius: 5,
          fontSize: 12, fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        ⚙ 高级
      </button>

      <div style={{ flex: 1 }} />

      <select
        disabled={!hasModel}
        onChange={(e) => {
          const v = e.target.value as 'obj' | 'gltf' | 'stl';
          if (v) { onExport(v); e.target.value = ''; }
        }}
        style={{
          background: hasModel
            ? 'linear-gradient(135deg, #3555cc, #5b8cff)'
            : '#242832',
          color: hasModel ? '#fff' : '#4d5460',
          border: hasModel ? '1px solid transparent' : '1px solid #2a2f3a',
          padding: '5px 12px', borderRadius: 5,
          fontSize: 12, fontWeight: 600,
          cursor: hasModel ? 'pointer' : 'not-allowed',
          flexShrink: 0,
        }}
      >
        <option value="">{hasModel ? '⤓ 导出' : '无模型'}</option>
        <option value="obj">导出 OBJ</option>
        <option value="gltf">导出 GLTF/GLB</option>
        <option value="stl">导出 STL</option>
      </select>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function statusDot(status: AIStatus) {
  switch (status) {
    case 'connected':
      return {
        color: '#4dd699',
        text: '#4dd699',
        bg: 'rgba(77,214,153,0.1)',
        border: 'rgba(77,214,153,0.35)',
        short: '●',
        tooltip: '已连接',
      };
    case 'checking':
      return {
        color: '#ffd93d',
        text: '#ffd93d',
        bg: 'rgba(255,217,61,0.1)',
        border: 'rgba(255,217,61,0.35)',
        short: '⋯',
        tooltip: '正在检测…',
      };
    case 'error':
      return {
        color: '#ff6b6b',
        text: '#ff6b6b',
        bg: 'rgba(255,107,107,0.1)',
        border: 'rgba(255,107,107,0.35)',
        short: '✕',
        tooltip: '未连接',
      };
    default:
      return {
        color: '#7a8292',
        text: '#7a8292',
        bg: '#242832',
        border: '#2a2f3a',
        short: '○',
        tooltip: '未检测',
      };
  }
}

const selStyle: CSSProperties = {
  background: '#242832', color: '#eef1f6',
  border: '1px solid #2a2f3a',
  padding: '5px 10px', borderRadius: 5,
  fontSize: 12, flexShrink: 0,
  colorScheme: 'dark',
};

const dividerStyle: CSSProperties = {
  width: 1, height: 20,
  background: '#2a2f3a',
  margin: '0 4px', flexShrink: 0,
};

function iconBtnStyle(enabled: boolean): CSSProperties {
  return {
    background: '#242832', color: '#eef1f6',
    border: '1px solid #2a2f3a',
    width: 32, height: 30,
    borderRadius: 5, fontSize: 15,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.35,
    transition: 'all 0.15s',
  };
}