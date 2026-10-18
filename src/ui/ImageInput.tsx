import { useRef, useState } from 'react';

interface Props {
  onUpload: (file: File, goal: string) => void;
  busy: boolean;
  available: boolean;
}

export function ImageInput({ onUpload, busy, available }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [goal, setGoal] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  function pick(f: File) {
    setPending(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  function go() {
    if (!pending) return;
    onUpload(pending, goal.trim());
    setPending(null);
    setPreview(null);
    setGoal('');
  }

  return (
    <div style={{ padding: 8, borderBottom: '1px solid #2a2f3a' }}>
      <div
        onClick={() => available && fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!available) return;
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith('image/')) pick(f);
        }}
        style={{
          border: pending ? '1.5px solid #5b8cff' : '1.5px dashed #3a4050',
          borderRadius: 8,
          padding: pending ? 6 : 14,
          textAlign: 'center',
          cursor: available ? 'pointer' : 'not-allowed',
          background: '#242832',
          minHeight: 70,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: available ? 1 : 0.5,
        }}
      >
        {preview ? (
          <img src={preview} alt="参考图" style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 6, display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#7a8292', fontSize: 11 }}>
            {available ? (
              <>
                <span style={{ fontSize: 20, opacity: 0.7 }}>🖼</span>
                <span>拖入参考图，或点击选择</span>
              </>
            ) : (
              <span>当前 AI 不支持图片</span>
            )}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
          }}
        />
      </div>

      {pending && (
        <>
          <input
            placeholder="补充说明（可选）"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            style={inp}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setPending(null); setPreview(null); setGoal(''); }}
              style={btn}
            >
              取消
            </button>
            <button onClick={go} disabled={busy} style={btnPrimary}>
              {busy ? '生成中…' : '生成 3D'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', marginTop: 6,
  background: '#1e2129', color: '#eef1f6',
  border: '1px solid #2a2f3a', padding: '5px 8px',
  borderRadius: 5, fontSize: 11, outline: 'none',
};
const btn: React.CSSProperties = {
  background: '#242832', color: '#b8bfcc', border: '1px solid #2a2f3a',
  padding: '5px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #3555cc, #5b8cff)',
  color: '#fff', border: 'none',
  padding: '5px 12px', borderRadius: 5, fontSize: 11,
  fontWeight: 600, cursor: 'pointer',
};