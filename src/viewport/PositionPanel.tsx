import { useEffect, useState } from 'react';

interface Props {
  visible: boolean;
  x: number;
  y: number;
  z: number;
  onChange: (x: number, y: number, z: number) => void;
  onClose?: () => void;
}

function NumberInput({
  value, onChange, color,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  const [draft, setDraft] = useState(Number(value.toFixed(3)).toString());
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(Number(value.toFixed(3)).toString());
    }
  }, [value, focused]);

  function commit() {
    const v = parseFloat(draft);
    if (!isNaN(v)) onChange(v);
    else setDraft(Number(value.toFixed(3)).toString());
  }

  return (
    <input
      type="number"
      value={draft}
      step={0.1}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      style={{
        width: 68,
        background: '#1a1c20',
        color: '#eef1f6',
        border: `1px solid ${focused ? color : '#2a2f3a'}`,
        borderRadius: 4,
        padding: '3px 6px',
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        outline: 'none',
        colorScheme: 'dark',
      }}
    />
  );
}

function AxisRow({
  label, value, color, onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 14,
        color,
        fontWeight: 600,
        fontFamily: 'monospace',
        fontSize: 11,
        textAlign: 'center',
      }}>
        {label}
      </span>
      <NumberInput value={value} onChange={onChange} color={color} />
      <input
        type="range"
        min={-5}
        max={5}
        step={0.01}
        value={Math.max(-5, Math.min(5, value))}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1,
          accentColor: color,
          height: 14,
          minWidth: 60,
        }}
      />
    </div>
  );
}

export function PositionPanel({
  visible, x, y, z, onChange,
}: Props) {
  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: 14,
      background: 'rgba(20,22,28,0.85)',
      backdropFilter: 'blur(8px)',
      border: '1px solid #2a2f3a',
      borderRadius: 8,
      padding: '8px 10px',
      zIndex: 10,
      minWidth: 260,
    }}>
      <div style={{
        color: '#7a8292',
        fontSize: 10,
        marginBottom: 6,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        fontWeight: 600,
      }}>
        位置
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <AxisRow label="X" value={x} color="#ff4d4d" onChange={(v) => onChange(v, y, z)} />
        <AxisRow label="Y" value={y} color="#4dff88" onChange={(v) => onChange(x, v, z)} />
        <AxisRow label="Z" value={z} color="#4d88ff" onChange={(v) => onChange(x, y, v)} />
      </div>
    </div>
  );
}