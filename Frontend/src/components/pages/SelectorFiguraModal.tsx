import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './SelectorFiguraModal.css';
import { toast } from '../ui/toast';
import type { FuenteImagen } from '../../utils/importacion';

interface Props {
  titulo: string;
  fuentes: FuenteImagen[];
  fuenteInicialId?: string;
  onClose: () => void;
  onSave: (blob: Blob) => Promise<void> | void;
  /** Para recordar las imágenes subidas desde el equipo y reutilizarlas en otras preguntas. */
  onAgregarFuente?: (fuente: FuenteImagen) => void;
}

/**
 * Elegir una figura para una pregunta o alternativa:
 * recortarla de una página del documento / imagen importada, o subirla desde el equipo.
 */
export function SelectorFiguraModal({ titulo, fuentes: fuentesIniciales, fuenteInicialId, onClose, onSave, onAgregarFuente }: Props) {
  const [fuentes, setFuentes] = useState<FuenteImagen[]>(fuentesIniciales);
  const [activaId, setActivaId] = useState<string | undefined>(
    fuenteInicialId && fuentesIniciales.some((f) => f.id === fuenteInicialId) ? fuenteInicialId : fuentesIniciales[0]?.id,
  );
  /** Imagen ya cargada, asociada a la fuente de la que vino (así se sabe si sigue cargando). */
  const [cargada, setCargada] = useState<{ id: string; url: string } | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [guardando, setGuardando] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const activa = fuentes.find((f) => f.id === activaId);
  const url = cargada && cargada.id === activaId ? cargada.url : null;
  const cargando = !!activa && !url;

  useEffect(() => {
    if (!activa) return;
    let vigente = true;
    activa.obtenerUrl()
      .then((u) => { if (vigente) setCargada({ id: activa.id, url: u }); })
      .catch(() => toast.error('No se pudo cargar esa página.'));
    return () => { vigente = false; };
  }, [activa]);

  /** Cambia de página/imagen y descarta el recorte marcado en la anterior. */
  const elegirFuente = (id: string) => {
    setActivaId(id);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !guardando) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [guardando, onClose]);

  const subirDesdeEquipo = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (archivoRef.current) archivoRef.current.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen (PNG, JPG…).');
      return;
    }
    const objectUrl = URL.createObjectURL(archivo);
    const nueva: FuenteImagen = { id: `archivo-${Date.now()}`, etiqueta: archivo.name, obtenerUrl: async () => objectUrl };
    setFuentes((prev) => [...prev, nueva]);
    elegirFuente(nueva.id);
    onAgregarFuente?.(nueva);
  };

  const guardar = async (blob: Blob) => {
    setGuardando(true);
    try {
      await onSave(blob);
    } finally {
      setGuardando(false);
    }
  };

  const guardarRecorte = () => {
    const img = imgRef.current;
    if (!img || !completedCrop?.width || !completedCrop.height) {
      toast.error('Marca primero el área a recortar.');
      return;
    }
    const escalaX = img.naturalWidth / img.width;
    const escalaY = img.naturalHeight / img.height;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(completedCrop.width * escalaX);
    canvas.height = Math.round(completedCrop.height * escalaY);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      img,
      completedCrop.x * escalaX, completedCrop.y * escalaY,
      completedCrop.width * escalaX, completedCrop.height * escalaY,
      0, 0, canvas.width, canvas.height,
    );
    canvas.toBlob((blob) => {
      if (blob) void guardar(blob);
      else toast.error('No se pudo generar el recorte.');
    }, 'image/png');
  };

  const usarCompleta = async () => {
    if (!url) return;
    try {
      void guardar(await (await fetch(url)).blob());
    } catch {
      toast.error('No se pudo usar la imagen completa.');
    }
  };

  return (
    <div className="sf-overlay" onMouseDown={() => !guardando && onClose()}>
      <div className="sf-modal" role="dialog" aria-modal="true" aria-labelledby="sf-titulo" onMouseDown={(e) => e.stopPropagation()}>
        <header className="sf-header">
          <div>
            <h3 id="sf-titulo">{titulo}</h3>
            <p>Elige la página o imagen, marca el área del gráfico y guarda el recorte.</p>
          </div>
          <button type="button" className="sf-cerrar" onClick={onClose} disabled={guardando} aria-label="Cerrar">
            <span className="material-icons-outlined">close</span>
          </button>
        </header>

        <div className="sf-fuentes">
          {fuentes.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`sf-fuente ${f.id === activaId ? 'is-active' : ''}`}
              onClick={() => elegirFuente(f.id)}
              title={f.tieneGraficos ? 'Se detectaron imágenes o gráficos en esta página' : undefined}
            >
              {f.tieneGraficos && <span className="material-icons-outlined sf-fuente-alerta">image</span>}
              {f.etiqueta}
            </button>
          ))}
          <button type="button" className="sf-fuente sf-fuente-subir" onClick={() => archivoRef.current?.click()}>
            <span className="material-icons-outlined">upload</span> Subir imagen del equipo
          </button>
          <input ref={archivoRef} type="file" accept="image/*" hidden onChange={subirDesdeEquipo} />
        </div>

        <div className="sf-cuerpo">
          {!activa && (
            <div className="sf-vacio">
              <span className="material-icons-outlined">add_photo_alternate</span>
              <p>Este documento no tiene páginas de imagen.<br />Sube la figura desde tu equipo.</p>
            </div>
          )}
          {activa && cargando && <div className="sf-vacio"><div className="spinner-small" /> Cargando…</div>}
          {activa && url && !cargando && (
            <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)}>
              <img ref={imgRef} src={url} alt={activa.etiqueta} className="sf-imagen" crossOrigin="anonymous" />
            </ReactCrop>
          )}
        </div>

        <footer className="sf-footer">
          <button type="button" className="btn btn-secondary" onClick={usarCompleta} disabled={!url || guardando}>
            Usar imagen completa
          </button>
          <span className="sf-espacio" />
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={guardarRecorte} disabled={!completedCrop?.width || guardando}>
            {guardando ? 'Guardando…' : 'Guardar recorte'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default SelectorFiguraModal;
