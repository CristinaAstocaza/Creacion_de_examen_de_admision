export interface OpcionesConfirmacion {
  titulo: string;
  mensaje?: string;
  /** Texto adicional resaltado (p. ej. consecuencias de eliminar). */
  advertencia?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Estilo rojo para acciones destructivas. */
  peligro?: boolean;
}

export interface SolicitudConfirmacion extends OpcionesConfirmacion {
  resolver: (aceptado: boolean) => void;
}

type Listener = (solicitud: SolicitudConfirmacion) => void;
let listener: Listener | null = null;

export const registrarConfirmacion = (l: Listener) => {
  listener = l;
  return () => {
    if (listener === l) listener = null;
  };
};

/**
 * Abre el modal de confirmación del sistema (reemplaza a window.confirm).
 * Uso: if (!(await confirmar({ titulo: '¿Eliminar?', peligro: true }))) return;
 * Requiere <ConfirmDialog /> montado una vez en App.
 */
export const confirmar = (opciones: OpcionesConfirmacion): Promise<boolean> =>
  new Promise((resolve) => {
    if (!listener) {
      resolve(window.confirm(opciones.titulo)); // Respaldo si el modal no está montado
      return;
    }
    listener({ ...opciones, resolver: resolve });
  });
