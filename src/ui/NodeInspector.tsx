import { getNode } from '../core/registry';
import { LATHE_PRESETS } from '../nodes/lathe';

interface Props {
  nodeId: string | null;
  nodeType: string | null;
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}

function findPresetId(profileStr: string): string {
  try {
    const cur = JSON.stringify(JSON.parse(profileStr));
    for (const [id, p] of Object.entries(LATHE_PRESETS)) {
      if (JSON.stringify(p.profile) === cur) return id;
    }
  } catch {}
  return '';
}

function countPoints(profileStr: string): number {
  try {
    const arr = JSON.parse(profileStr);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

function renderParam(
  nodeType: string,
  p: {
    name: string;
    label?: string;
    type: string;
    default: unknown;
    min?: number;
    max?: number;
    step?: number;
    accept?: string;
    options?: { value: string; label: string }[];
  },
  params: Record<string, unknown>,
  onChange: (patch: Record<string, unknown>) => void
) {
  // lathe 的 profile 用预设下拉
  if (nodeType === 'lathe' && p.name === 'profile') {
    const currentId = findPresetId((params.profile as string) ?? '');
    const count = countPoints((params.profile as string) ?? '');

    return (
      <label key={p.name} style={{ display: 'block', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#7a8292', marginBottom: 6 }}>预设形状</div>
        <select
          value={currentId}
          onChange={(e) => {
            const preset = LATHE_PRESETS[e.target.value];
            if (preset) onChange({ profile: JSON.stringify(preset.profile) });
          }}
          style={selectStyle}
        >
          <option value="">自定义（{count} 个点）</option>
          {Object.entries(LATHE_PRESETS).map(([id, preset]) => (
            <option key={id} value={id}>{preset.label}</option>
          ))}
        </select>
      </label>
    );
  }

  // CSG 布尔的 op
  if (nodeType === 'boolean' && p.name === 'op') {
    return (
      <label key={p.name} style={{ display: 'block', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#7a8292', marginBottom: 6 }}>运算类型</div>
        <select
          value={(params[p.name] as string) ?? 'union'}
          onChange={(e) => onChange({ [p.name]: e.target.value })}
          style={selectStyle}
        >
          <option value="union">并集（合并 A + B）</option>
          <option value="subtract">差集（A 挖掉 B）</option>
          <option value="intersect">交集（A 和 B 共同部分）</option>
        </select>
      </label>
    );
  }

  // 通用 enum
  if (p.type === 'enum' && p.options) {
    return (
      <label key={p.name} style={{ display: 'block', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#7a8292', marginBottom: 6 }}>
          {p.label ?? p.name}
        </div>
        <select
          value={(params[p.name] as string) ?? (p.default as string)}
          onChange={(e) => onChange({ [p.name]: e.target.value })}
          style={selectStyle}
        >
          {p.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>
    );
  }

  if (p.type === 'file') {
    return (
      <label key={p.name} style={{ display: 'block', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#7a8292', marginBottom: 6 }}>
          {p.label ?? p.name}
        </div>
        <input
          type="file"
          accept={p.accept ?? '*'}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange({ [p.name]: URL.createObjectURL(file) });
          }}
          style={{
            width: '100%', fontSize: 11, color: '#b8bfcc',
            background: '#242832', border: '1px solid #2a2f3a',
            padding: '6px 8px', borderRadius: 5,
          }}
        />
        {params[p.name] ? (
          <div style={{ fontSize: 10, color: '#4dd699', marginTop: 4 }}>✓ 已选择文件</div>
        ) : null}
      </label>
    );
  }

  if (p.type === 'color') {
    return (
      <label key={p.name} style={{ display: 'block', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#7a8292', marginBottom: 6 }}>
          {p.label ?? p.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={(params[p.name] as string) ?? (p.default as string)}
            onChange={(e) => onChange({ [p.name]: e.target.value })}
            style={{
              width: 32, height: 26,
              border: '1px solid #3a4050', borderRadius: 5,
              background: 'transparent', cursor: 'pointer', padding: 0,
            }}
          />
          <span style={{ fontSize: 11, color: '#b8bfcc', fontFamily: 'monospace' }}>
            {(params[p.name] as string) ?? (p.default as string)}
          </span>
        </div>
      </label>
    );
  }

  if (p.type === 'number') {
    return (
      <label key={p.name} style={{ display: 'block', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#7a8292', marginBottom: 6 }}>
          {p.label ?? p.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range"
            min={p.min}
            max={p.max}
            step={p.step}
            value={(params[p.name] as number) ?? (p.default as number)}
            onChange={(e) => onChange({ [p.name]: Number(e.target.value) })}
            style={{ flex: 1, accentColor: '#5b8cff' }}
          />
          <span style={{
            minWidth: 42, textAlign: 'right',
            fontSize: 11, color: '#b8bfcc', fontFamily: 'monospace',
          }}>
            {String(params[p.name] ?? p.default)}
          </span>
        </div>
      </label>
    );
  }

  return (
    <label key={p.name} style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: '#7a8292', marginBottom: 6 }}>
        {p.label ?? p.name}
      </div>
      <input
        value={(params[p.name] as string) ?? (p.default as string)}
        onChange={(e) => onChange({ [p.name]: e.target.value })}
        style={{
          width: '100%', background: '#242832', color: '#eef1f6',
          border: '1px solid #2a2f3a', padding: '6px 10px',
          borderRadius: 5, fontSize: 12, outline: 'none',
        }}
      />
    </label>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%', background: '#242832', color: '#eef1f6',
  border: '1px solid #2a2f3a', padding: '6px 10px',
  borderRadius: 5, fontSize: 12, outline: 'none',
  colorScheme: 'dark',
};

export function NodeInspector({ nodeId, nodeType, params, onChange }: Props) {
  if (!nodeId || !nodeType) {
    return (
      <div style={{
        padding: 20, color: '#4d5460', fontSize: 12,
        textAlign: 'center', lineHeight: 1.8,
      }}>
        选中一个节点<br />这里会显示参数
      </div>
    );
  }

  const def = getNode(nodeType);
  if (!def) return null;

  return (
    <div style={{ padding: 12, fontSize: 13, color: '#eef1f6' }}>
      <div style={{
        fontWeight: 600, fontSize: 12, marginBottom: 12,
        paddingBottom: 8, borderBottom: '1px solid #2a2f3a',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{def.label}</span>
        <span style={{
          fontSize: 10, color: '#7a8292',
          background: '#242832', padding: '2px 8px',
          borderRadius: 10, textTransform: 'uppercase',
        }}>
          {def.category}
        </span>
      </div>

      {def.params.map((p) => renderParam(nodeType, p, params, onChange))}
    </div>
  );
}