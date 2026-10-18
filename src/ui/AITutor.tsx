import { useEffect, useState } from 'react';

interface Props {
  suggestion: string | null;
  onRun: () => void;
  onDismiss: () => void;
}

export function AITutor({ suggestion, onRun, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (suggestion) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 30000);
      return () => clearTimeout(t);
    }
  }, [suggestion]);

  if (!suggestion || !visible) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: 'linear-gradient(90deg, rgba(91,140,255,0.12), rgba(169,122,255,0.06))',
      borderBottom: '1px solid rgba(91,140,255,0.25)',
      animation: 'tutorIn 0.3s ease',
    }}>
      <span style={{ fontSize: 16, filter: 'drop-shadow(0 0 6px rgba(255,217,61,0.4))' }}>💡</span>
      <div style={{ flex: 1, fontSize: 12, color: '#eef1f6', lineHeight: 1.4 }}>
        {suggestion}
      </div>
      <button onClick={onRun} style={{
        background: 'rgba(91,140,255,0.2)', color: '#7ba4ff',
        border: '1px solid rgba(91,140,255,0.4)',
        padding: '3px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
      }}>
        换一个
      </button>
      <button onClick={() => { setVisible(false); onDismiss(); }} style={{
        background: 'transparent', color: '#7a8292',
        border: 'none', padding: '3px 6px', fontSize: 14, cursor: 'pointer',
      }}>
        ×
      </button>
      <style>{`
        @keyframes tutorIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}