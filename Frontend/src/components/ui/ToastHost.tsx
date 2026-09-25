import { useEffect, useState } from 'react';
import type { ToastPayload } from '../../utils/toast';

interface ToastItem extends ToastPayload {
  id: number;
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      const id = Date.now() + Math.random();
      const item = { id, ...detail };
      setItems(prev => [...prev, item].slice(-4));
      window.setTimeout(() => {
        setItems(prev => prev.filter(x => x.id !== id));
      }, detail.duration ?? 3200);
    };

    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []);

  const palette = {
    success: { bg: '#ecfdf3', fg: '#166534', border: '#bbf7d0', icon: 'check_circle' },
    error: { bg: '#fff1f2', fg: '#b91c1c', border: '#fecdd3', icon: 'error' },
    warning: { bg: '#fffbeb', fg: '#92400e', border: '#fde68a', icon: 'warning' },
    info: { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe', icon: 'info' },
  };

  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 100000, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
      {items.map(item => {
        const p = palette[item.type];
        return (
          <div
            key={item.id}
            role="status"
            style={{
              width: 'min(390px, calc(100vw - 40px))',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '13px 15px',
              borderRadius: 12,
              background: p.bg,
              color: p.fg,
              border: `1px solid ${p.border}`,
              boxShadow: '0 14px 35px rgba(15, 23, 42, .16)',
              fontWeight: 600,
              pointerEvents: 'auto'
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: 20 }}>{p.icon}</span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>{item.message}</span>
            <button
              type="button"
              onClick={() => setItems(prev => prev.filter(x => x.id !== item.id))}
              style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
