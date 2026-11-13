import { useState } from 'react';
import './RevisionPregunta.css';
import { ContentRenderer } from '../ui/ContentRenderer';
import { EditorRico } from '../ui/editor/EditorRico';
import { parsearBloques } from '../../utils/contenidoBloques';
import {
  type AnalyzedQuestion,
  tieneContenido,
  listaParaGuardar,
  quitarImagen,
} from '../../utils/importacion';

/** Dónde se colocará la imagen elegida. */
export interface DestinoImagen {
  tipo: 'enunciado' | 'alternativa';
  indiceAlternativa?: number;
  /** Bloque de imagen pendiente a completar; si falta se agrega una imagen nueva. */
  indiceBloque?: number;
}

interface Props {
  pregunta: AnalyzedQuestion;
  onChange: (q: AnalyzedQuestion) => void;
  onEliminar: () => void;
  onElegirImagen: (destino: DestinoImagen) => void;
  /** Para el botón de imagen del editor: abre el selector y devuelve la URL elegida (o null). */
  onPedirImagen: () => Promise<string | null>;
  onVerImagen: (url: string) => void;
  /** Guarda solo esta pregunta en el banco (y la quita de la revisión). */
  onGuardar: () => void;
  guardando?: boolean;
}

type Edicion = { tipo: 'enunciado' } | { tipo: 'alternativa'; indice: number } | null;

/**
 * Editor enriquecido de un contenido (enunciado o alternativa).
 * Las figuras que la IA marcó y aún no se recortaron no se ven en el editor: se conservan al aplicar.
 */
function EditorContenido({ contenido, onGuardar, onCancelar, pedirImagen }: {
  contenido: string | null;
  onGuardar: (nuevo: string) => void;
  onCancelar: () => void;
  pedirImagen: () => Promise<string | null>;
}) {
  const [actual, setActual] = useState(contenido ?? '');

  const aplicar = () => {
    const pendientes = parsearBloques(contenido).filter((b) => b.tipo === 'imagen' && !b.url);
    const nuevos = parsearBloques(actual);
    onGuardar(pendientes.length ? JSON.stringify([...nuevos, ...pendientes]) : actual);
  };

  return (
    <div className="rp-editor">
      <EditorRico
        autoFocus
        value={actual}
        onChange={setActual}
        pedirImagen={pedirImagen}
        alturaMinima={90}
        placeholder="Escribe el texto. Usa la barra para formato, imágenes, tablas y ecuaciones."
      />
      <div className="rp-editor-acciones">
        <button type="button" className="btn-small" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="btn-small rp-btn-ok" onClick={aplicar}>Aplicar</button>
      </div>
    </div>
  );
}

export function RevisionPregunta({ pregunta: q, onChange, onEliminar, onElegirImagen, onPedirImagen, onVerImagen, onGuardar, guardando }: Props) {
  const [edicion, setEdicion] = useState<Edicion>(null);
  const lista = listaParaGuardar(q);
  const estado = !q.isValid ? 'error' : q.needsReview || !lista ? 'warning' : '';

  return (
    <div className={`preview-item ${estado}`}>
      <div className="status-icon">
        <span className={`material-icons-outlined rp-estado ${!q.isValid ? 'is-error' : estado ? 'is-aviso' : 'is-ok'}`}>
          {!q.isValid ? 'cancel' : estado ? 'warning_amber' : 'check_circle'}
        </span>
      </div>
      <div className="question-content">
        <div className="q-badges">
          {q.tipo_bloque && q.tipo_bloque !== 'pregunta' && <span className="badge badge-warning"><span className="material-icons-outlined mi">notes</span> Bloque: {q.tipo_bloque}</span>}
          {q.confianza_extraccion !== undefined && q.confianza_extraccion < 80 && (
            <span className="badge badge-purple"><span className="material-icons-outlined mi">help_outline</span> Confianza baja ({q.confianza_extraccion}%)</span>
          )}
          {q.posible_incompleta && <span className="badge badge-danger"><span className="material-icons-outlined mi">content_cut</span> Incompleta</span>}
          {(q.enunciadoNeedsImage || q.parsedAlternativas.some((a) => a.needsImage)) && (
            <span className="badge badge-warning"><span className="material-icons-outlined mi">crop</span> Falta recortar figura</span>
          )}
        </div>

        {q.avisoGraficos && !q.avisoRevisado && (
          <div className="rp-aviso">
            <span className="material-icons-outlined">image_search</span>
            <div>
              <p>{q.avisoGraficos}</p>
              <div className="rp-aviso-acciones">
                <button type="button" className="btn-small" onClick={() => onElegirImagen({ tipo: 'enunciado' })}>
                  <span className="material-icons-outlined mi">add_photo_alternate</span> Agregar gráfico al enunciado
                </button>
                <button type="button" className="btn-small" onClick={() => onChange({ ...q, avisoRevisado: true })}>
                  No necesita imagen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enunciado */}
        <div className="rp-bloque">
          <div className="rp-bloque-head">
            <strong>Enunciado</strong>
            {edicion?.tipo !== 'enunciado' && (
              <div className="rp-iconos">
                <button type="button" title="Editar texto" aria-label="Editar enunciado" onClick={() => setEdicion({ tipo: 'enunciado' })}>
                  <span className="material-icons-outlined">edit</span>
                </button>
                <button type="button" title="Agregar imagen o gráfico" aria-label="Agregar imagen al enunciado" onClick={() => onElegirImagen({ tipo: 'enunciado' })}>
                  <span className="material-icons-outlined">add_photo_alternate</span>
                </button>
              </div>
            )}
          </div>
          {edicion?.tipo === 'enunciado' ? (
            <EditorContenido
              pedirImagen={onPedirImagen}
              contenido={q.enunciado}
              onCancelar={() => setEdicion(null)}
              onGuardar={(nuevo) => { onChange({ ...q, enunciado: nuevo }); setEdicion(null); }}
            />
          ) : tieneContenido(q.enunciado) || q.enunciadoNeedsImage ? (
            <div className="q-text">
              <ContentRenderer
                contentStr={q.enunciado}
                onImageClick={onVerImagen}
                onCropClick={(i) => onElegirImagen({ tipo: 'enunciado', indiceBloque: i })}
                onQuitarImagen={(i) => onChange({ ...q, enunciado: quitarImagen(q.enunciado, i) })}
              />
            </div>
          ) : (
            <button type="button" className="rp-vacio" onClick={() => setEdicion({ tipo: 'enunciado' })}>
              Sin enunciado — haz clic para escribirlo
            </button>
          )}
        </div>

        {/* Alternativas A–E (siempre visibles para poder completar las faltantes) */}
        <div className="rp-alternativas">
          {q.parsedAlternativas.map((alt, idx) => {
            const vacia = !tieneContenido(alt.contenidoTexto) && !alt.imagenUrl;
            const editando = edicion?.tipo === 'alternativa' && edicion.indice === idx;
            return (
              <div key={alt.letra} className={`rp-alt ${editando ? 'is-editando' : ''} ${vacia ? 'is-vacia' : ''} ${alt.needsImage ? 'is-pendiente' : ''}`}>
                <div className="rp-alt-head">
                  <span className="rp-letra">{alt.letra}</span>
                  {!editando && (
                    <div className="rp-iconos">
                      <button type="button" title="Editar texto" aria-label={`Editar alternativa ${alt.letra}`} onClick={() => setEdicion({ tipo: 'alternativa', indice: idx })}>
                        <span className="material-icons-outlined">edit</span>
                      </button>
                      <button type="button" title="Agregar imagen" aria-label={`Agregar imagen a la alternativa ${alt.letra}`} onClick={() => onElegirImagen({ tipo: 'alternativa', indiceAlternativa: idx })}>
                        <span className="material-icons-outlined">add_photo_alternate</span>
                      </button>
                    </div>
                  )}
                </div>
                {editando ? (
                  <EditorContenido
                    pedirImagen={onPedirImagen}
                    contenido={alt.contenidoTexto}
                    onCancelar={() => setEdicion(null)}
                    onGuardar={(nuevo) => {
                      const alts = q.parsedAlternativas.map((a, i) => (i === idx ? { ...a, contenidoTexto: nuevo } : a));
                      onChange({ ...q, parsedAlternativas: alts });
                      setEdicion(null);
                    }}
                  />
                ) : vacia && !alt.needsImage ? (
                  <span className="rp-alt-vacia">Vacía · escribe el texto o agrega una imagen</span>
                ) : (
                  <>
                    <ContentRenderer
                      contentStr={alt.contenidoTexto}
                      onImageClick={onVerImagen}
                      onCropClick={(i) => onElegirImagen({ tipo: 'alternativa', indiceAlternativa: idx, indiceBloque: i })}
                      onQuitarImagen={(i) => {
                        const alts = q.parsedAlternativas.map((a, j) => (j === idx ? { ...a, contenidoTexto: quitarImagen(a.contenidoTexto, i) } : a));
                        onChange({ ...q, parsedAlternativas: alts });
                      }}
                    />
                    {alt.imagenUrl && (
                      <div className="rp-alt-img-marco">
                        <img className="rp-alt-img" src={alt.imagenUrl} alt={`Alternativa ${alt.letra}`} onClick={() => onVerImagen(alt.imagenUrl!)} />
                        <button
                          type="button"
                          className="cr-quitar-imagen"
                          title="Quitar imagen"
                          aria-label="Quitar imagen"
                          onClick={() => onChange({ ...q, parsedAlternativas: q.parsedAlternativas.map((a, j) => (j === idx ? { ...a, imagenUrl: undefined } : a)) })}
                        >
                          <span className="material-icons-outlined">close</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {q.errorMessage && <div className="q-error-msg">{q.errorMessage}</div>}

        <div className="q-actions rp-acciones">
          <button type="button" className="btn-small danger" onClick={onEliminar} disabled={guardando}>
            <span className="material-icons-outlined mi">delete_outline</span> Descartar
          </button>
          <span className="rp-acciones-espacio" />
          {!lista && <span className="rp-acciones-nota">Complétala para poder guardarla</span>}
          <button
            type="button"
            className="rp-btn-guardar"
            onClick={onGuardar}
            disabled={!lista || guardando || edicion !== null}
            title={edicion !== null ? 'Aplica o cancela la edición primero' : lista ? 'Guardar en el banco y quitarla de la revisión' : 'Faltan datos'}
          >
            <span className="material-icons-outlined mi">{guardando ? 'hourglass_empty' : 'save'}</span>
            {guardando ? 'Guardando…' : 'Guardar pregunta'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RevisionPregunta;
