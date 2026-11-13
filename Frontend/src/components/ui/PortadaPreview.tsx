import './PortadaPreview.css';
import { colorContraste } from '../../utils/caratulas';

export interface DatosPortada {
  institutionName: string;
  headerText: string;
  modalidad: string;
  footerText?: string;
  instructions?: string;
  logoUrl: string | null;
  temaLetra: string;
  colorPortada: string;
}

/** Ancho al que se dibuja la portada antes de escalarla en las miniaturas. */
const ANCHO_BASE = 400;

/** Portada del examen tal como se imprime (vista previa a tamaño completo). */
export function PortadaPreview({ data, mini = false }: { data: DatosPortada; mini?: boolean }) {
  return (
    <div
      className={`portada ${mini ? 'portada--mini' : ''}`}
      style={{ backgroundColor: data.colorPortada, color: colorContraste(data.colorPortada) }}
    >
      <div className="portada-institucion">{data.institutionName || 'UNIVERSIDAD'}</div>
      {data.logoUrl
        ? <img src={data.logoUrl} alt="" className="portada-logo" />
        : <div className="portada-logo portada-logo--vacio">LOGO</div>}
      <div className="portada-titulo">{data.headerText || 'EXAMEN DE ADMISIÓN'}</div>
      <div className="portada-modalidad">{data.modalidad || 'MODALIDAD'}</div>
      <div className="portada-tema">
        <span>TEMA</span>
        <strong>{data.temaLetra || 'A'}</strong>
      </div>
      {!mini && (
        <div className="portada-instrucciones">
          <strong>Instrucciones:</strong> {data.instructions || 'Sin instrucciones adicionales.'}
        </div>
      )}
      {!mini && data.footerText && <div className="portada-pie">{data.footerText}</div>}
    </div>
  );
}

/** Miniatura escalada de la portada, con el ancho en píxeles indicado. */
export function PortadaMiniatura({ data, ancho = 140 }: { data: DatosPortada; ancho?: number }) {
  const escala = ancho / ANCHO_BASE;
  return (
    <div className="portada-marco" style={{ width: ancho, height: Math.round(ancho * 1.414) }} aria-hidden="true">
      <div style={{ width: ANCHO_BASE, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
        <PortadaPreview data={data} mini />
      </div>
    </div>
  );
}

export default PortadaPreview;
