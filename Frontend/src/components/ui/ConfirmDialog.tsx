import { useEffect, useRef, useState } from 'react';
import './ConfirmDialog.css';
import { registrarConfirmacion, type SolicitudConfirmacion } from './confirm';

/** Modal de confirmación global. Se monta una sola vez en App. */
export function ConfirmDialog() {
  const [solicitud, setSolicitud] = useState<SolicitudConfirmacion | null>(null);
  const botonCancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => registrarConfirmacion((nueva) => {
    setSolicitud((actual) => {
      actual?.resolver(false); // Si había otra abierta, se cancela
      return nueva;
    });
  }), []);

  const cerrar = (aceptado: boolean) => {
    solicitud?.resolver(aceptado);
    setSolicitud(null);
  };

  useEffect(() => {
    if (!solicitud) return;
    // En acciones destructivas el foco inicia en "Cancelar" para evitar borrados accidentales con Enter
    botonCancelar.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        solicitud.resolver(false);
        setSolicitud(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [solicitud]);

  if (!solicitud) return null;
  const { titulo, mensaje, advertencia, textoConfirmar, textoCancelar, peligro } = solicitud;

  return (
    <div className="cd-overlay" onMouseDown={() => cerrar(false)}>
      <div
        className="cd-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-titulo"
        aria-describedby={mensaje ? 'cd-mensaje' : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className={`cd-icono material-icons-outlined ${peligro ? 'is-danger' : ''}`}>
          {peligro ? 'delete_forever' : 'help_outline'}
        </span>
        <h3 id="cd-titulo">{titulo}</h3>
        {mensaje && <p id="cd-mensaje">{mensaje}</p>}
        {advertencia && (
          <div className="cd-advertencia">
            <span className="material-icons-outlined">warning_amber</span>
            <span>{advertencia}</span>
          </div>
        )}
        <div className="cd-acciones">
          <button ref={botonCancelar} type="button" className="cd-btn cd-btn-cancelar" onClick={() => cerrar(false)}>
            {textoCancelar || 'Cancelar'}
          </button>
          <button type="button" className={`cd-btn ${peligro ? 'cd-btn-peligro' : 'cd-btn-primario'}`} onClick={() => cerrar(true)}>
            {textoConfirmar || (peligro ? 'Eliminar' : 'Aceptar')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
