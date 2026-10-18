import { useRef, useState } from 'react';
import { extractFrames } from '../io/video';

interface Props {
  onExtracted: (frames: string[], goal: string) => void;
  busy: boolean;
  available: boolean;
}

export function VideoInput({ onExtracted, busy, available }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [goal, setGoal] = useState('');

  async function pick(f: File) {
    if (!available) return;
    setExtracting(true);
    try {
      const frames = await extractFrames(f, 6, 640);
      onExtracted(frames, goal.trim());
    } catch (e) {
      alert(`抽帧失败：${(e as Error).message}`);
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div style={{ padding: 8, borderBottom: '1px solid #2a2f3a' }}>
      <div
        onClick={() => available && ref.current?.click()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: 10,
          border: '1.5px dashed #3a4050',
          borderRadius: 8,
          background: '#242832',
          cursor: available ? 'pointer' : 'not-allowed',
          fontSize: 11, color: '#7a8292',
          opacity: available ? 1 : 0.5,
        }}
      >
        <span style={{ fontSize: 18 }}>🎬</span>
        <span>{extracting ? '抽帧中…' : busy ? '生成中…' : '上传环绕视频'}</span>
        <span style={{ fontSize: 10, color: '#4d5460' }}>手机环绕物体拍 5-10 秒</span>
        <input
          ref={ref}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
          }}
        />
      </div>
      <input
        placeholder="补充说明（可选）"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        style={{
          width: '100%', marginTop: 6,
          background: '#1e2129', color: '#eef1f6',
          border: '1px solid #2a2f3a', padding: '5px 8px',
          borderRadius: 5, fontSize: 11, outline: 'none',
        }}
      />
    </div>
  );
}