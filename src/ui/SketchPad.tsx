import { useRef, useState, useEffect, useCallback } from 'react';
import type { SketchSet, SketchView } from '../io/sketchTypes';
import { hasAnyView } from '../io/sketchTypes';

type ViewKey = 'front' | 'side' | 'top';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: SketchSet | null;
  onGenerate: (sketch: SketchSet, goal: string) => void;
  busy: boolean;
  available: boolean;
}

const W = 640;
const H = 480;

export function SketchPad({ open, onClose, initial, onGenerate, busy, available }: Props) {
  const [views, setViews] = useState<SketchSet>(() => initial ?? {});
  const [active, setActive] = useState<ViewKey>('front');
  const [goal, setGoal] = useState(initial?.note ?? '');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<Record<ViewKey, ImageData[]>>({ front: [], side: [], top: [] });

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#111111';

    const v = views[active];
    if (v?.data) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, W, H); };
      img.src = v.data;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  useEffect(() => {
    if (open) {
      setGoal(initial?.note ?? '');
      setViews(initial ?? {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const saveCurrentToViews = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setViews((s) => ({
      ...s,
      [active]: { data: dataUrl, updatedAt: Date.now() } as SketchView,
    }));
  }, [active]);

  function getPos(e: React.PointerEvent): { x: number; y: number } {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!available) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      const h = historyRef.current[active];
      if (h.length > 20) h.shift();
      h.push(ctx.getImageData(0, 0, W, H));
    }
    drawingRef.current = true;
    lastRef.current = getPos(e);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    const last = lastRef.current ?? pos;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
  }

  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    saveCurrentToViews();
  }

  function undo() {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const last = historyRef.current[active].pop();
    if (last) ctx.putImageData(last, 0, 0);
    else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }
    saveCurrentToViews();
  }

  function clearCurrent() {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    setViews((s) => ({ ...s, [active]: undefined }));
  }

  function clearAll() {
    setViews({});
    setGoal('');
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function generate() {
    saveCurrentToViews();
    setTimeout(() => {
      setViews((v) => {
        const withNote: SketchSet = { ...v, note: goal.trim() };
        if (hasAnyView(withNote)) onGenerate(withNote, goal.trim());
        return withNote;
      });
    }, 50);
  }

  if (!open) return null;

  const viewCount = [views.front, views.side, views.top].filter(Boolean).length;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#16181d',
          border: '1px solid #3a4050',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          width: 720, maxWidth: '92vw',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid #2a2f3a',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#eef1f6' }}>✏️ 草图生 3D</span>
          <span style={{ fontSize: 11, color: '#4d5460', flex: 1 }}>
            画正面 / 侧面 / 顶面，AI 综合多视图生成更准确的 3D
          </span>
          <button
            onClick={onClose}
            style={{
              width: 26, height: 26,
              background: 'transparent', color: '#7a8292',
              border: 'none', fontSize: 20, lineHeight: 1,
              borderRadius: 6, cursor: 'pointer',
            }}
          >×</button>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '8px 16px', background: '#0f1115',
          borderBottom: '1px solid #2a2f3a',
        }}>
          {(['front', 'side', 'top'] as ViewKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setActive(k)}
              style={{
                background: active === k ? 'rgba(91,140,255,0.15)' : 'transparent',
                color: active === k ? '#7ba4ff' : '#7a8292',
                border: `1px solid ${active === k ? 'rgba(91,140,255,0.4)' : 'transparent'}`,
                padding: '4px 12px', borderRadius: 12,
                fontSize: 11, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {{ front: '正视图', side: '侧视图', top: '顶视图' }[k]}
              {views[k] ? <span style={{
                display: 'inline-block', width: 6, height: 6,
                borderRadius: '50%', background: '#4dd699',
                marginLeft: 6, verticalAlign: 'middle',
              }} /> : null}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#4d5460' }}>{viewCount} 视图</span>
        </div>

        <div style={{ padding: 16, position: 'relative', background: '#f8f9fb' }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{
              width: '100%', height: 'auto', aspectRatio: '4 / 3',
              borderRadius: 8, background: '#ffffff',
              cursor: available ? 'crosshair' : 'not-allowed',
              touchAction: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              display: 'block',
            }}
          />
          {!available && (
            <div style={{
              position: 'absolute', inset: 16,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(15, 17, 21, 0.88)',
              color: '#ff6b6b', fontSize: 13,
              borderRadius: 8, textAlign: 'center', padding: 20,
              lineHeight: 1.7,
            }}>
              <div>当前 AI 通道不支持图片</div>
              <div style={{ fontSize: 11, marginTop: 6, color: '#7a8292' }}>
                请切换到支持视觉的 AI：gpt-4o / Kimi vision / GLM-4V。
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #2a2f3a',
          display: 'flex', gap: 8, alignItems: 'center',
          background: '#16181d',
        }}>
          <button onClick={undo} style={btnStyle}>↶</button>
          <button onClick={clearCurrent} style={btnStyle}>清当前</button>
          <button onClick={clearAll} style={btnStyle}>清全部</button>
          <input
            placeholder="补充说明（可选）：“做成花瓶”“卡通风格”"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            style={{
              flex: 1,
              background: '#242832', color: '#eef1f6',
              border: '1px solid #2a2f3a',
              padding: '7px 12px', borderRadius: 5,
              fontSize: 12, outline: 'none',
            }}
          />
          <button
            onClick={generate}
            disabled={viewCount === 0 || busy || !available}
            style={{
              background: (viewCount === 0 || busy || !available)
                ? '#2a3a5a' : 'linear-gradient(135deg, #3555cc, #5b8cff)',
              color: '#fff', border: 'none',
              padding: '7px 16px', borderRadius: 5,
              fontSize: 12, fontWeight: 600,
              cursor: (viewCount === 0 || busy || !available) ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? '生成中…' : '→ 生成 3D'}
          </button>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#242832', color: '#b8bfcc', border: '1px solid #2a2f3a',
  padding: '6px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
};