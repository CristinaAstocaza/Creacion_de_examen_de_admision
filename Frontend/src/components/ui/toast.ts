export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  leaving?: boolean;
}

type Listener = (toast: ToastItem) => void;

const listeners = new Set<Listener>();
let nextId = 1;

const emitir = (type: ToastType, message: string) => {
  const item: ToastItem = { id: nextId++, type, message };
  listeners.forEach((l) => l(item));
};

export const suscribirToasts = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Notificaciones tipo burbuja (esquina superior derecha, 2 s).
 * Uso: toast.success('Guardado'), toast.error('No se pudo guardar').
 * Requiere <Toaster /> montado una vez en App.
 */
export const toast = {
  success: (message: string) => emitir('success', message),
  error: (message: string) => emitir('error', message),
  info: (message: string) => emitir('info', message),
};

/** Extrae un mensaje legible de un error desconocido. */
export const mensajeError = (err: unknown, porDefecto: string) =>
  err instanceof Error && err.message ? err.message : porDefecto;
