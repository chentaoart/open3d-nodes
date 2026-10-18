import { useEffect, useState, useRef } from 'react';
import { subscribeLogs, clearLogs, type LogEntry, type LogLevel } from '../core/logger';

const LEVEL_STYLE: Record<LogLevel, { color: string; label: string }> = {
  info: { color: '#7a8292', label: 'INFO' },
  success: { color: '#4dd699', label: 'OK  ' },
  warn: { color: '#ffd93d', label: 'WARN' },
  error: { color: '#ff6b6b', label: 'ERR ' },
  'ai-req': { color: '#5b8cff', label: 'AI→ ' },
  'ai-res': { color: '#a97aff', label: 'AI← ' },
};

export function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const off = subscribeLogs(setEntries);
    return off;
  }, []);

  // ★ 新错误自动展开
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const e of entries) {
        if (e.level === 'error' && e.details && !next.has(e.id)) {
          next.add(e.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [entries]);

  useEffect(() => {
    if (!autoScroll) return;
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    setAutoScroll(atBottom);
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyAll() {
    const text = entries.map((e) => {
      const time = new Date(e.time).toLocaleTimeString('zh-CN', { hour12: false });
      let line = `[${time}] ${e.level.toUpperCase()}${e.tag ? ` [${e.tag}]` : ''} ${e.message}`;
      if (e.details) line += `\n  ${e.details}`;
      return line;
    }).join('\n');
    navigator.clipboard.writeText(text);
    alert('已复制全部日志');
  }

  const errorCount = entries.filter((e) => e.level === 'error').length;

  return (
    <div style={{
      height: collapsed ? 32 : 220,
      background: '#0a0c10',
      borderTop: '1px solid #2a2f3a',
      display: 'flex',
      flexDirection: 'column',
      transition: 'height 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        borderBottom: collapsed ? 'none' : '1px solid #2a2f3a',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            background: 'transparent', color: '#7a8292',
            border: 'none', fontSize: 10, cursor: 'pointer', padding: '2px 4px',
          }}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#b8bfcc', letterSpacing: 0.3 }}>
          日志
        </span>
        <span style={{ fontSize: 10, color: '#4d5460' }}>
          {entries.length} 条
        </span>
        {errorCount > 0 && (
          <span style={{
            fontSize: 10,
            background: 'rgba(255,107,107,0.15)',
            color: '#ff6b6b',
            padding: '1px 6px',
            borderRadius: 8,
          }}>
            {errorCount} 错误
          </span>
        )}

        <div style={{ flex: 1 }} />

        {!autoScroll && !collapsed && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (listRef.current) {
                listRef.current.scrollTop = listRef.current.scrollHeight;
              }
            }}
            style={{
              background: 'rgba(91,140,255,0.15)',
              color: '#7ba4ff',
              border: '1px solid rgba(91,140,255,0.3)',
              fontSize: 10, padding: '2px 8px', borderRadius: 8, cursor: 'pointer',
            }}
          >
            ↓ 回到最新
          </button>
        )}

        <button
          onClick={copyAll}
          style={{
            background: 'transparent', color: '#7a8292',
            border: '1px solid #2a2f3a',
            fontSize: 10, padding: '2px 8px', borderRadius: 8, cursor: 'pointer',
          }}
        >
          复制全部
        </button>

        <button
          onClick={clearLogs}
          style={{
            background: 'transparent', color: '#7a8292',
            border: '1px solid #2a2f3a',
            fontSize: 10, padding: '2px 8px', borderRadius: 8, cursor: 'pointer',
          }}
        >
          清空
        </button>
      </div>

      {!collapsed && (
        <div
          ref={listRef}
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 12px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          {entries.length === 0 && (
            <div style={{ color: '#4d5460', padding: '8px 0', fontStyle: 'italic' }}>
              等待操作…
            </div>
          )}
          {entries.map((e) => {
            const style = LEVEL_STYLE[e.level];
            const isExpanded = expanded.has(e.id);
            const time = new Date(e.time).toLocaleTimeString('zh-CN', { hour12: false });
            return (
              <div key={e.id}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#4d5460', flexShrink: 0 }}>{time}</span>
                  <span style={{ color: style.color, flexShrink: 0, fontWeight: 600 }}>
                    {style.label}
                  </span>
                  {e.tag && (
                    <span style={{ color: '#7a8292', flexShrink: 0 }}>[{e.tag}]</span>
                  )}
                  <span
                    style={{
                      color: e.level === 'error' ? '#ff9b9b' : '#b8bfcc',
                      flex: 1,
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      cursor: e.details ? 'pointer' : 'default',
                    }}
                    onClick={() => e.details && toggleExpand(e.id)}
                  >
                    {e.message}
                    {e.details && (
                      <span style={{ color: '#4d5460', marginLeft: 6 }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    )}
                  </span>
                </div>

                {e.details && isExpanded && (
                  <div style={{
                    marginLeft: 100,
                    padding: '6px 10px',
                    background: e.level === 'error' ? '#2a1015' : '#16181d',
                    border: `1px solid ${e.level === 'error' ? '#4a1a20' : '#2a2f3a'}`,
                    borderRadius: 4,
                    color: e.level === 'error' ? '#ffb3b3' : '#7a8292',
                    fontSize: 10,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    marginTop: 2,
                    marginBottom: 6,
                  }}>
                    {e.details}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}