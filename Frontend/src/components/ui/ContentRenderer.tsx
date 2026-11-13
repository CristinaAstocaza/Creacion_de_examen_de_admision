import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './ContentRenderer.css';
import { partirFormato, etiquetaDeTramo } from '../../utils/formatoTexto';
import { parsearBloques, type Bloque } from '../../utils/contenidoBloques';

/** @deprecated usar Bloque de utils/contenidoBloques */
export type ContentBlock = Bloque;

interface Props {
  contentStr: string | null | undefined;
  className?: string;
  onImageClick?: (url: string) => void;
  onCropClick?: (blockIndex: number) => void;
  /** Si se indica, cada imagen muestra un botón para quitarla. */
  onQuitarImagen?: (blockIndex: number) => void;
  inline?: boolean;
}

const BotonQuitarImagen: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    className="cr-quitar-imagen"
    title="Quitar imagen"
    aria-label="Quitar imagen"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
  >
    <span className="material-icons-outlined">close</span>
  </button>
);

const ALINEACION_CSS: Record<NonNullable<Bloque['alineacion']>, React.CSSProperties['textAlign']> = {
  izquierda: 'left', centro: 'center', derecha: 'right', justificado: 'justify',
};

/** Fórmula LaTeX con KaTeX; si es inválida se muestra el código tal cual. */
const Formula: React.FC<{ latex: string; display?: boolean }> = ({ latex, display = false }) => {
  let html: string | null = null;
  try {
    html = katex.renderToString(latex.replace(/\$\$/g, ''), { throwOnError: true, displayMode: display });
  } catch {
    // Fórmula inválida: se muestra el código tal cual.
  }
  if (html === null) return <span className="cr-texto">{latex}</span>;
  return display
    ? <div className="latex-block" dangerouslySetInnerHTML={{ __html: html }} />
    : <span className="latex-inline" dangerouslySetInnerHTML={{ __html: html }} />;
};

/** Texto con **negrita**, *cursiva*, __subrayado__, fórmulas $...$ y saltos de línea. */
const TextoEnLinea: React.FC<{ texto: string }> = ({ texto }) => {
  const partes: React.ReactNode[] = [];
  let ultimo = 0;
  let clave = 0;
  const agregarTexto = (fragmento: string) => {
    partirFormato(fragmento).forEach((t) => {
      const lineas = t.texto.split('\n').flatMap((l, i) => (i > 0 ? [<br key={`br${clave++}`} />, l] : [l]));
      const Etiqueta = etiquetaDeTramo(t);
      partes.push(Etiqueta ? <Etiqueta key={clave++}>{lineas}</Etiqueta> : <React.Fragment key={clave++}>{lineas}</React.Fragment>);
    });
  };
  for (const m of texto.matchAll(/\$([^$]+)\$/g)) {
    agregarTexto(texto.slice(ultimo, m.index));
    partes.push(<Formula key={clave++} latex={m[1]} />);
    ultimo = (m.index ?? 0) + m[0].length;
  }
  agregarTexto(texto.slice(ultimo));
  return <>{partes}</>;
};

export const ContentRenderer: React.FC<Props> = ({ contentStr, className, onImageClick, onCropClick, onQuitarImagen, inline = false }) => {
  const blocks = useMemo(() => parsearBloques(contentStr), [contentStr]);
  if (blocks.length === 0) return null;

  return (
    <div className={`content-renderer ${inline ? 'cr-inline' : ''} ${className || ''}`}>
      {blocks.map((b, i) => {
        switch (b.tipo) {
          case 'texto':
            // Formato original: el texto fluye en línea; solo interpretamos marcas de formato.
            return (
              <span key={i} className="cr-texto">
                {partirFormato(b.valor || '').map((t, j) => {
                  const Etiqueta = etiquetaDeTramo(t);
                  return Etiqueta ? <Etiqueta key={j}>{t.texto}</Etiqueta> : <React.Fragment key={j}>{t.texto}</React.Fragment>;
                })}
              </span>
            );

          case 'latex': {
            const display = !inline && (!!b.valor?.includes('$$') || !!b.valor?.includes('\\begin{'));
            return <Formula key={i} latex={b.valor || ''} display={display} />;
          }

          case 'parrafo': {
            const estilo = { textAlign: b.alineacion ? ALINEACION_CSS[b.alineacion] : undefined };
            const contenido = <TextoEnLinea texto={b.valor || ''} />;
            if (b.estilo === 'codigo') return <pre key={i} className="cr-codigo">{b.valor}</pre>;
            if (b.estilo === 'cita') return <blockquote key={i} className="cr-cita" style={estilo}>{contenido}</blockquote>;
            if (b.estilo === 'h1') return <h3 key={i} className="cr-h1" style={estilo}>{contenido}</h3>;
            if (b.estilo === 'h2') return <h4 key={i} className="cr-h2" style={estilo}>{contenido}</h4>;
            if (b.estilo === 'h3') return <h5 key={i} className="cr-h3" style={estilo}>{contenido}</h5>;
            return <p key={i} className="cr-parrafo" style={estilo}>{contenido}</p>;
          }

          case 'lista': {
            const Lista = b.ordenada ? 'ol' : 'ul';
            return (
              <Lista key={i} className="cr-lista">
                {(b.items ?? []).map((item, j) => <li key={j}><TextoEnLinea texto={item} /></li>)}
              </Lista>
            );
          }

          case 'tabla':
            return (
              <div key={i} className="cr-tabla-wrap">
                <table className="cr-tabla">
                  <tbody>
                    {(b.filas ?? []).map((fila, j) => (
                      <tr key={j}>
                        {fila.map((celda, k) => {
                          const Celda = j === 0 && b.encabezado ? 'th' : 'td';
                          return <Celda key={k}><TextoEnLinea texto={celda} /></Celda>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'imagen':
            if (!b.url) {
              return (
                <div key={i} className="cr-imagen-pendiente">
                  <span className="material-icons-outlined mi">image_not_supported</span> Imagen pendiente de recorte
                  {(onCropClick || onQuitarImagen) && (
                    <div className="cr-imagen-pendiente-acciones">
                      {onCropClick && (
                        <button className="btn-small" onClick={() => onCropClick(i)}><span className="material-icons-outlined mi">crop</span> Recortar imagen</button>
                      )}
                      {onQuitarImagen && (
                        <button className="btn-small danger" onClick={() => onQuitarImagen(i)}><span className="material-icons-outlined mi">close</span> No hace falta</button>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div
                key={i}
                className={`q-image-container cr-imagen ${onQuitarImagen ? 'cr-imagen--editable' : ''}`}
                onClick={() => onImageClick?.(b.url!)}
                style={{ cursor: onImageClick ? 'pointer' : 'default' }}
              >
                <div className="cr-imagen-marco">
                  <img src={b.url} alt="Figura" />
                  {onQuitarImagen && <BotonQuitarImagen onClick={() => onQuitarImagen(i)} />}
                </div>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
};
