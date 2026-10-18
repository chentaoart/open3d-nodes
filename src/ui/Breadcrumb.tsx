interface Crumb {
  id: string | null;
  label: string;
}

interface Props {
  crumbs: Crumb[];
  onNavigate: (index: number) => void;
}

export function Breadcrumb({ crumbs, onNavigate }: Props) {
  if (crumbs.length <= 1) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '6px 16px',
      background: '#0f1115',
      borderBottom: '1px solid #2a2f3a',
      fontSize: 12,
      flexShrink: 0,
    }}>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && (
              <span style={{ color: '#4d5460', margin: '0 4px' }}>›</span>
            )}
            <button
              onClick={() => onNavigate(i)}
              disabled={isLast}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLast ? '#eef1f6' : '#5b8cff',
                fontWeight: isLast ? 600 : 400,
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 12,
                cursor: isLast ? 'default' : 'pointer',
              }}
            >
              {c.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}