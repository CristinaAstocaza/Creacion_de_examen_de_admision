import { useEffect, useState } from 'react';
import './Toaster.css';
import { suscribirToasts, type ToastItem, type ToastType } from './toast';

const DURACION_MS = 2000;
const SALIDA_MS = 250;

const ICONOS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
};

/** Contenedor de notificaciones tipo burbuja. Se monta una sola vez en App. */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const quitar = (id: number) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), SALIDA_MS);
    };

    return suscribirToasts((item) => {
      // Evita burbujas duplicadas idénticas visibles al mismo tiempo
      setToasts((prev) => (prev.some((t) => t.message === item.message && t.type === item.type && !t.leaving)
        ? prev
        : [...prev, item]));
      window.setTimeout(() => quitar(item.id), DURACION_MS);
    });
  }, []);

  return (
    <div className="toaster" role="region" aria-label="Notificaciones">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type} ${t.leaving ? 'toast-leaving' : ''}`}
          role={t.type === 'error' ? 'alert' : 'status'}
          aria-live={t.type === 'error' ? 'assertive' : 'polite'}
        >
          <span className="material-icons-outlined toast-icon">{ICONOS[t.type]}</span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default Toaster;
