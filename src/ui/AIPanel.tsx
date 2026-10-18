import { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  history: ChatMessage[];
  onSend: (text: string) => void;
  onClear: () => void;
  busy?: boolean;
  onVisionIterate: (goal: string) => void;
  visionAvailable: boolean;
  iterating: boolean;
  autoIterate: boolean;
  onAutoIterateChange: (v: boolean) => void;
}

export function AIPanel({
  history, onSend, onClear, busy, onVisionIterate, visionAvailable, iterating,
  autoIterate, onAutoIterateChange,
}: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [history, busy]);

  function send() {
    if (!text.trim() || busy) return;
    const t = text.trim();
    onSend(t);
    setText('');
  }

  function startVisionIterate() {
    const goal = prompt(
      '看图迭代：AI 会反复截图 → 修改 → 截图，直到接近目标。\n\n请输入目标：',
      '让它更圆润一些'
    );
    if (goal) onVisionIterate(goal);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#16181d' }}>
      <div style={{
        padding: '8px 12px', borderBottom: '1px solid #2a2f3a',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: '#eef1f6', flex: 1 }}>AI 助手</span>

        <button
          onClick={() => {
            if (history.length === 0) return;
            if (confirm('清空对话记录？')) onClear();
          }}
          title="清空对话"
          style={{
            background: 'transparent', color: '#7a8292',
            border: '1px solid #2a2f3a',
            padding: '3px 8px', borderRadius: 10,
            fontSize: 10, cursor: 'pointer',
          }}
        >
          清空
        </button>

        <label
          title="参考图生成后自动进入看图迭代"
          style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#7a8292', cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={autoIterate}
            onChange={(e) => onAutoIterateChange(e.target.checked)}
          />
          自动迭代
        </label>

        <button
          onClick={startVisionIterate}
          disabled={!visionAvailable || iterating}
          title={visionAvailable ? 'AI 看着 3D 视口自动迭代修改' : '当前模型不支持图片'}
          style={{
            background: visionAvailable && !iterating
              ? 'linear-gradient(135deg, #3555cc, #5b8cff)'
              : '#242832',
            color: visionAvailable && !iterating ? '#fff' : '#4d5460',
            border: 'none',
            padding: '4px 10px', borderRadius: 12,
            fontSize: 10, fontWeight: 600,
            cursor: (visionAvailable && !iterating) ? 'pointer' : 'not-allowed',
          }}
        >
          {iterating ? '迭代中…' : '📸 看图迭代'}
        </button>
      </div>

      <div ref={listRef} style={{
        flex: 1, overflowY: 'auto', padding: 12,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {history.length === 0 && (
          <div style={{
            color: '#4d5460', fontSize: 12, textAlign: 'center',
            padding: '20px 12px', lineHeight: 1.8,
          }}>
            可以跟我聊天，也可以让我建模型。<br />
            试试"你好"、"加一个花瓶"、"能做什么"。
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
              background: m.role === 'user'
                ? 'linear-gradient(135deg, #4a7aff, #6b9aff)'
                : 'linear-gradient(135deg, #7a3aff, #a97aff)',
            }}>
              {m.role === 'user' ? '你' : 'AI'}
            </div>
            <div style={{
              padding: '7px 11px', borderRadius: 10,
              background: m.role === 'user' ? 'rgba(91,140,255,0.15)' : '#242832',
              color: '#eef1f6', fontSize: 12, lineHeight: 1.5,
              maxWidth: '80%', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#7a8292', fontSize: 11 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'linear-gradient(135deg, #7a3aff, #a97aff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
            }}>AI</div>
            思考中…
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid #2a2f3a' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="说点什么，或者让我建模型…"
          disabled={busy}
          style={{
            flex: 1, background: '#242832', color: '#eef1f6',
            border: '1px solid #2a2f3a', padding: '7px 10px',
            borderRadius: 5, fontSize: 12, outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          style={{
            background: busy ? '#2a3a5a' : 'linear-gradient(135deg, #3555cc, #5b8cff)',
            color: '#fff', border: 'none', padding: '0 14px',
            borderRadius: 5, fontSize: 12, fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy ? '…' : '发送'}
        </button>
      </div>
    </div>
  );
}