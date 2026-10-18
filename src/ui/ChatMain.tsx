import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from './AIPanel';

interface Props {
  history: ChatMessage[];
  busy: boolean;
  iterating: boolean;
  onSend: (text: string) => void;
  onClear: () => void;
  onImageUpload: (file: File) => void;
  onOpenSketch: () => void;
  onVideoUpload: (file: File) => void;
  onVisionIterate: (goal: string) => void;
  onAnalyzeScene: () => void;
  visionAvailable: boolean;
  hasModel: boolean;
}

export function ChatMain({
  history, busy, iterating,
  onSend, onClear,
  onImageUpload, onOpenSketch, onVideoUpload,
  onVisionIterate, onAnalyzeScene,
  visionAvailable, hasModel,
}: Props) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [history, busy]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [text]);

  function send() {
    if (!text.trim() || busy) return;
    onSend(text.trim());
    setText('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleVisionIterate() {
    const goal = prompt(
      'AI 会反复截图 → 修改 → 截图，直到接近目标。\n\n请输入目标：',
      '让它更圆润一些'
    );
    if (goal) onVisionIterate(goal);
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      background: '#16181d',
      borderTop: '1px solid #2a2f3a',
    }}>
      <div ref={listRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {history.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4d5460',
            textAlign: 'center',
            padding: 20,
            gap: 16,
          }}>
            <div style={{ fontSize: 32, opacity: 0.6 }}>✨</div>
            <div style={{ fontSize: 15, color: '#b8bfcc', fontWeight: 500 }}>
              说说你想做什么
            </div>
            <div style={{ fontSize: 12, lineHeight: 2, color: '#7a8292' }}>
              试试："做一把椅子"<br />
              或："做一个金属茶壶"<br />
              或：点下面的 <span style={{ color: '#7ba4ff' }}>📎</span> 上传参考图<br />
              或：点 <span style={{ color: '#7ba4ff' }}>🔍</span> 让 AI 分析当前场景
            </div>
          </div>
        )}

        {history.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                flexDirection: isUser ? 'row-reverse' : 'row',
                maxWidth: '100%',
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
                background: isUser
                  ? 'linear-gradient(135deg, #4a7aff, #6b9aff)'
                  : 'linear-gradient(135deg, #7a3aff, #a97aff)',
              }}>
                {isUser ? '你' : 'AI'}
              </div>
              <div style={{
                padding: '9px 14px',
                borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                background: isUser ? 'rgba(91,140,255,0.15)' : '#242832',
                border: isUser ? '1px solid rgba(91,140,255,0.25)' : '1px solid #2a2f3a',
                color: '#eef1f6',
                fontSize: 13,
                lineHeight: 1.6,
                maxWidth: '72%',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {m.content}
              </div>
            </div>
          );
        })}

        {busy && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'linear-gradient(135deg, #7a3aff, #a97aff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>AI</div>
            <div style={{
              padding: '9px 14px',
              borderRadius: '4px 14px 14px 14px',
              background: '#242832',
              border: '1px solid #2a2f3a',
              color: '#7a8292', fontSize: 12,
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {iterating ? '看图迭代中' : '思考中'}
              <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4 }}>
                <i style={dotStyle(0)} /><i style={dotStyle(0.2)} /><i style={dotStyle(0.4)} />
              </span>
            </div>
          </div>
        )}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 20px',
        borderTop: '1px solid #2a2f3a',
        background: '#0f1115',
        flexWrap: 'wrap',
      }}>
        {visionAvailable && (
          <button
            onClick={handleVisionIterate}
            disabled={busy || !hasModel}
            title={!hasModel ? '先做一个模型' : 'AI 看着 3D 画面自动迭代优化'}
            style={{
              background: (busy || !hasModel) ? '#242832' : 'rgba(91,140,255,0.12)',
              color: (busy || !hasModel) ? '#4d5460' : '#7ba4ff',
              border: '1px solid ' + ((busy || !hasModel) ? '#2a2f3a' : 'rgba(91,140,255,0.35)'),
              padding: '5px 12px', borderRadius: 14,
              fontSize: 11, fontWeight: 500,
              cursor: (busy || !hasModel) ? 'not-allowed' : 'pointer',
            }}
          >
            📸 看图迭代
          </button>
        )}

        <button
          onClick={onAnalyzeScene}
          disabled={busy || !hasModel}
          title={!hasModel ? '先做一个模型' : 'AI 分析当前场景并给出改进建议'}
          style={{
            background: (busy || !hasModel) ? '#242832' : 'rgba(169,122,255,0.12)',
            color: (busy || !hasModel) ? '#4d5460' : '#a97aff',
            border: '1px solid ' + ((busy || !hasModel) ? '#2a2f3a' : 'rgba(169,122,255,0.35)'),
            padding: '5px 12px', borderRadius: 14,
            fontSize: 11, fontWeight: 500,
            cursor: (busy || !hasModel) ? 'not-allowed' : 'pointer',
          }}
        >
          🔍 分析场景
        </button>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => {
            if (confirm('重置 AI 上下文？\n\n清空对话记录 + AI 记忆，解决响应变慢的问题。')) {
              onClear();
              try {
                localStorage.removeItem('llm-history');
                localStorage.removeItem('ai-memory');
              } catch {}
            }
          }}
          title="清空对话记录和 AI 上下文"
          style={{
            background: 'transparent',
            color: '#7a8292',
            border: '1px solid #2a2f3a',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          重置上下文
        </button>
      </div>

      <div style={{
        padding: '0 20px 16px',
        background: '#0f1115',
      }}>
        <div style={{
          background: '#242832',
          border: '1px solid #2a2f3a',
          borderRadius: 12,
          padding: '8px 12px',
          transition: 'border-color 0.15s',
        }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={busy ? 'AI 正在思考……' : '说说你想要什么……'}
            disabled={busy}
            rows={1}
            style={{
              width: '100%',
              background: 'transparent',
              color: '#eef1f6',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: 'inherit',
              padding: '4px 0',
              maxHeight: 160,
              overflowY: 'auto',
            }}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
          }}>
            <button
              onClick={() => imageRef.current?.click()}
              disabled={busy}
              title="上传参考图"
              style={iconBtn(busy)}
            >📎</button>
            <button
              onClick={onOpenSketch}
              disabled={busy}
              title="画草图"
              style={iconBtn(busy)}
            >✏️</button>
            <button
              onClick={() => videoRef.current?.click()}
              disabled={busy}
              title="上传环绕视频"
              style={iconBtn(busy)}
            >🎬</button>

            <div style={{ flex: 1 }} />

            <button
              onClick={send}
              disabled={busy || !text.trim()}
              style={{
                background: (busy || !text.trim())
                  ? '#2a3a5a'
                  : 'linear-gradient(135deg, #3555cc, #5b8cff)',
                color: '#fff',
                border: 'none',
                padding: '6px 18px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: (busy || !text.trim()) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {busy ? '…' : '发送'}
            </button>
          </div>

          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImageUpload(f);
              e.target.value = '';
            }}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onVideoUpload(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    color: '#b8bfcc',
    border: 'none',
    width: 30, height: 30,
    borderRadius: 6,
    fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'all 0.15s',
  };
}

function dotStyle(delay: number): React.CSSProperties {
  return {
    display: 'inline-block',
    width: 4, height: 4,
    borderRadius: '50%',
    background: '#7a8292',
    animation: `pulse 1s ease-in-out ${delay}s infinite`,
  };
}