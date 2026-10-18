import { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean;
  shortcut?: string;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleScroll() {
      onClose();
    }
    document.addEventListener('mousedown', handleMouse);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleMouse);
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (x + rect.width > window.innerWidth - 8) nx = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) ny = window.innerHeight - rect.height - 8;
    if (nx < 4) nx = 4;
    if (ny < 4) ny = 4;
    el.style.left = nx + 'px';
    el.style.top = ny + 'px';
  }, [x, y]);

  return (
    <div
      ref={ref}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: '#1e2129',
        border: '1px solid #3a4050',
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        padding: 4,
        minWidth: 180,
        zIndex: 10000,
        fontSize: 12,
        color: '#eef1f6',
        animation: 'ctxIn 0.1s ease',
      }}
    >
      <style>{`
        @keyframes ctxIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={i} style={{ height: 1, background: '#2a2f3a', margin: '4px 2px' }} />;
        }
        return (
          <div
            key={i}
            onClick={() => {
              if (item.disabled) return;
              item.onClick();
              onClose();
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 5,
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              color: item.disabled ? '#4d5460' : '#eef1f6',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.1s',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) (e.currentTarget as HTMLElement).style.background = '#2a2f3a';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ fontSize: 10, color: '#7a8292', fontFamily: 'monospace' }}>
                {item.shortcut}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}