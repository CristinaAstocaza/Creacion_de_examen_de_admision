import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './BancoPreguntas.css';
import './Gestion.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { listarCursos } from '../../services/cursoService';
import {
  actualizarPregunta,
  crearPregunta,
  listarPreguntas,
  eliminarPregunta,
  obtenerPregunta,
} from '../../services/preguntaService';
import { ContentRenderer } from '../ui/ContentRenderer';
import { EditorRico } from '../ui/editor/EditorRico';
import {
  bloquesATextoEditable,
  imagenPrincipalVisible,
  parsearBloques,
  tieneBloquesImagen,
} from '../../utils/contenidoBloques';
import { tieneContenido } from '../../utils/importacion';
import { quitarFormato } from '../../utils/formatoTexto';
import { toast } from '../ui/toast';
import { confirmar } from '../ui/confirm';

interface Curso {
  id: number;
  nombre: string;
  codigo: string | null;
  activo: boolean;
}

interface AlternativaResponse {
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  tipo: 'TEXTO' | 'IMAGEN';
  contenidoTexto: string | null;
  imagenUrl: string | null;
  esCorrecta: boolean;
  ordenVisualizacion: number | null;
}

interface PreguntaResponse {
  id: number;
  codigo: string;
  enunciado: string;
  imagenUrl: string | null;
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL'; // kept for backend compatibility
  activo: boolean;
  cursoId: number;
  cursoNombre: string;
  alternativas: AlternativaResponse[];
}

interface AlternativaForm {
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  /** Contenido enriquecido (JSON de bloques): texto, fórmulas, imágenes, tablas… */
  contenido: string;
  esCorrecta: boolean;
  ordenVisualizacion: number;
}

interface FormDataPregunta {
  codigo: string;
  cursoId: string;
  /** Contenido enriquecido (JSON de bloques). */
  enunciado: string;
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL'; // hidden from UI, always sent as 'MEDIO'
  activo: boolean;
  alternativas: AlternativaForm[];
}

const letras = ['A', 'B', 'C', 'D', 'E'] as const;

const crearFormVacio = (): FormDataPregunta => ({
  codigo: '',
  cursoId: '',
  enunciado: '',
  dificultad: 'MEDIO',
  activo: true,
  alternativas: letras.map((letra, index) => ({
    letra,
    contenido: '',
    esCorrecta: false,
    ordenVisualizacion: index + 1,
  })),
});

/** Texto plano para la tabla y la búsqueda (sin marcas de formato ni $ de fórmulas). */
const textoPlano = (contenido: string) => quitarFormato(bloquesATextoEditable(contenido)).replace(/\$([^$]+)\$/g, '$1');

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Preguntas por página en la tabla. */
const POR_PAGINA = 25;

/** Tiene alguna figura (en el enunciado, en una alternativa o como imagen suelta antigua). */
const tieneImagenAlguna = (q: PreguntaResponse) =>
  tieneBloquesImagen(q.enunciado)
  || !!imagenPrincipalVisible(q.enunciado, q.imagenUrl)
  || q.alternativas?.some((a) => tieneBloquesImagen(a.contenidoTexto) || !!imagenPrincipalVisible(a.contenidoTexto, a.imagenUrl));

/** Tiene fórmulas LaTeX. */
const tieneFormula = (contenido: string) =>
  parsearBloques(contenido).some((b) => b.tipo === 'latex' || /\$[^$]+\$/.test(b.valor ?? ''));

/**
 * Las preguntas antiguas guardaban la figura en el campo imagenUrl (fuera del contenido).
 * Al editar se pasa al contenido para que el editor la muestre y no se pierda.
 */
const conImagenSuelta = (contenido: string | null | undefined, imagenUrl: string | null | undefined): string => {
  const suelta = imagenPrincipalVisible(contenido, imagenUrl);
  if (!suelta) return contenido ?? '';
  return JSON.stringify([...parsearBloques(contenido), { tipo: 'imagen', url: suelta }]);
};

export default function BancoPreguntas() {
  const [preguntas, setPreguntas] = useState<PreguntaResponse[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  // Se puede llegar filtrado desde la sección Cursos: /banco?curso=3
  const [filterCursoId, setFilterCursoId] = useState(() => searchParams.get('curso') ?? '');
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'activas' | 'inactivas'>('todas');
  const [soloConImagen, setSoloConImagen] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [selectedQuestion, setSelectedQuestion] = useState<PreguntaResponse | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormDataPregunta>(crearFormVacio());
  /** Cambia al abrir el formulario para que los editores arranquen con el contenido correcto. */
  const [formKey, setFormKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [preguntasData, cursosData] = await Promise.all([listarPreguntas(), listarCursos()]);
      setPreguntas(preguntasData);
      setCursos(cursosData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar preguntas y cursos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const filteredQuestions = useMemo(() => {
    const termino = sinTildes(searchTerm.trim());
    return preguntas.filter((q) => {
      const matchesSearch = !termino
        || sinTildes(textoPlano(q.enunciado)).includes(termino)
        || q.codigo.toLowerCase().includes(termino);
      const matchesCurso = filterCursoId ? q.cursoId === Number(filterCursoId) : true;
      const matchesEstado = filtroEstado === 'todas' || (filtroEstado === 'activas' ? q.activo : !q.activo);
      const matchesImagen = !soloConImagen || tieneImagenAlguna(q);
      return matchesSearch && matchesCurso && matchesEstado && matchesImagen;
    });
  }, [filterCursoId, preguntas, searchTerm, filtroEstado, soloConImagen]);

  // Al cambiar un filtro se vuelve a la primera página.
  const filtrar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPagina(1); };
  const cambiarCurso = (id: string) => {
    filtrar(setFilterCursoId)(id);
    const p = new URLSearchParams(searchParams);
    if (id) p.set('curso', id); else p.delete('curso');
    setSearchParams(p, { replace: true });
  };

  const totalPaginas = Math.max(1, Math.ceil(filteredQuestions.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const enPagina = filteredQuestions.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const activas = preguntas.filter((q) => q.activo).length;
  const conImagen = preguntas.filter(tieneImagenAlguna).length;
  const cursosConPreguntas = new Set(preguntas.map((q) => q.cursoId)).size;
  const hayFiltros = !!(searchTerm || filterCursoId || filtroEstado !== 'todas' || soloConImagen);
  const limpiarFiltros = () => {
    setSearchTerm('');
    cambiarCurso('');
    setFiltroEstado('todas');
    setSoloConImagen(false);
  };

  // ── Auto-generate PREG-XXXXX code ──
  const generarCodigoAutomatico = (lista: PreguntaResponse[]): string => {
    const nums = lista
      .map((p) => p.codigo)
      .filter((c) => /^PREG-\d+$/.test(c))
      .map((c) => parseInt(c.replace('PREG-', ''), 10))
      .filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `PREG-${String(max + 1).padStart(5, '0')}`;
  };

  const handleOpenDetail = async (question: PreguntaResponse) => {
    try {
      const data = await obtenerPregunta(question.id);
      setSelectedQuestion(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al obtener detalle de la pregunta');
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!(await confirmar({ titulo: '¿Eliminar esta pregunta?', mensaje: 'Se eliminará junto con sus alternativas.', peligro: true }))) return;
    try {
      await eliminarPregunta(id);
      await cargarDatos();
      toast.success('Pregunta eliminada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la pregunta');
    }
  };

  const abrirFormulario = (datos: FormDataPregunta, id: number | null) => {
    setEditingId(id);
    setFormData(datos);
    setFormKey((k) => k + 1);
    setIsFormModalOpen(true);
  };

  const handleOpenCreateForm = () => {
    const nuevo = crearFormVacio();
    nuevo.codigo = generarCodigoAutomatico(preguntas);
    abrirFormulario(nuevo, null);
  };

  const handleOpenEditForm = (question: PreguntaResponse) => {
    abrirFormulario({
      codigo: question.codigo || '',
      cursoId: String(question.cursoId),
      enunciado: conImagenSuelta(question.enunciado, question.imagenUrl),
      dificultad: question.dificultad || 'MEDIO',
      activo: question.activo,
      alternativas: letras.map((letra, index) => {
        const alt = question.alternativas.find((a) => a.letra === letra);
        return {
          letra,
          contenido: conImagenSuelta(alt?.contenidoTexto, alt?.imagenUrl),
          esCorrecta: alt?.esCorrecta || false,
          ordenVisualizacion: alt?.ordenVisualizacion || index + 1,
        };
      }),
    }, question.id);
  };

  const cambiarAlternativa = (index: number, contenido: string) => {
    setFormData((prev) => ({
      ...prev,
      alternativas: prev.alternativas.map((a, i) => (i === index ? { ...a, contenido } : a)),
    }));
  };

  const validarFormulario = (): boolean => {
    if (!formData.cursoId || !tieneContenido(formData.enunciado)) {
      toast.error('Selecciona un curso y escribe el enunciado.');
      return false;
    }
    const vacias = formData.alternativas.filter((alt) => !tieneContenido(alt.contenido)).map((a) => a.letra);
    if (vacias.length) {
      toast.error(`Completa las alternativas: ${vacias.join(', ')}.`);
      return false;
    }
    return true;
  };

  const handleSaveQuestion = async () => {
    if (!validarFormulario()) return;
    setIsSaving(true);
    try {
      const payload = {
        codigo: formData.codigo.trim() || null,
        // Texto con formato, fórmulas, imágenes y tablas: todo va en los bloques del contenido.
        enunciado: formData.enunciado,
        imagenUrl: null,
        tieneImagen: tieneBloquesImagen(formData.enunciado),
        dificultad: formData.dificultad,
        activo: formData.activo,
        cursoId: Number(formData.cursoId),
        alternativas: formData.alternativas.map((alt) => ({
          letra: alt.letra,
          tipo: 'TEXTO' as const,
          contenidoTexto: alt.contenido,
          imagenUrl: null,
          esCorrecta: alt.esCorrecta,
          ordenVisualizacion: alt.ordenVisualizacion,
        })),
      };

      if (editingId) {
        await actualizarPregunta(editingId, payload);
      } else {
        await crearPregunta(payload);
      }
      setIsFormModalOpen(false);
      await cargarDatos();
      toast.success(editingId ? 'Pregunta actualizada correctamente.' : 'Pregunta creada correctamente.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar la pregunta');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="banco-container gs">
      <header className="gs-cabecera">
        <div>
          <h1>Banco de preguntas</h1>
          <p>Todas las preguntas disponibles para generar exámenes. Busca, filtra por curso y edita con el editor de fórmulas e imágenes.</p>
        </div>
        <button type="button" className="gs-btn gs-btn-primario" id="btn-nueva-pregunta" onClick={handleOpenCreateForm}>
          <span className="material-icons-outlined">add</span> Nueva pregunta
        </button>
      </header>

      <section className="gs-resumen" aria-label="Resumen">
        <div className="gs-kpi"><span className="gs-kpi-icono"><span className="material-icons-outlined">quiz</span></span><div><strong>{preguntas.length.toLocaleString('es-PE')}</strong><span>Preguntas</span></div></div>
        <div className="gs-kpi gs-kpi--verde"><span className="gs-kpi-icono"><span className="material-icons-outlined">check_circle</span></span><div><strong>{activas.toLocaleString('es-PE')}</strong><span>Activas</span></div></div>
        <div className="gs-kpi gs-kpi--ambar"><span className="gs-kpi-icono"><span className="material-icons-outlined">image</span></span><div><strong>{conImagen.toLocaleString('es-PE')}</strong><span>Con imagen</span></div></div>
        <div className="gs-kpi gs-kpi--gris"><span className="gs-kpi-icono"><span className="material-icons-outlined">school</span></span><div><strong>{cursosConPreguntas}</strong><span>Cursos con preguntas</span></div></div>
      </section>

      <div className="gs-barra">
        <label className="gs-buscar">
          <span className="material-icons-outlined">search</span>
          <input
            placeholder="Buscar en el enunciado o por código…"
            value={searchTerm}
            onChange={(e) => filtrar(setSearchTerm)(e.target.value)}
            aria-label="Buscar pregunta"
          />
          {searchTerm && <button type="button" onClick={() => filtrar(setSearchTerm)('')} aria-label="Limpiar búsqueda"><span className="material-icons-outlined">close</span></button>}
        </label>
        <div className="gs-filtro-curso">
          <Select value={filterCursoId} onValueChange={cambiarCurso}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Todos los cursos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los cursos</SelectItem>
              {[...cursos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((curso) => (
                <SelectItem key={curso.id} value={String(curso.id)}>{curso.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="gs-segmentado" role="group" aria-label="Filtrar por estado">
          {(['todas', 'activas', 'inactivas'] as const).map((f) => (
            <button key={f} type="button" className={filtroEstado === f ? 'is-activo' : ''} onClick={() => filtrar(setFiltroEstado)(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <label className="gs-switch" title="Mostrar solo preguntas con figuras">
          <input type="checkbox" checked={soloConImagen} onChange={(e) => filtrar(setSoloConImagen)(e.target.checked)} />
          <span className="gs-switch-pista" aria-hidden="true" />
          Con imagen
        </label>
        <span className="gs-conteo">
          {filteredQuestions.length.toLocaleString('es-PE')} de {preguntas.length.toLocaleString('es-PE')}
          {hayFiltros && <> · <button type="button" className="bp-limpiar" onClick={limpiarFiltros}>Quitar filtros</button></>}
        </span>
      </div>

      <div className="gs-tabla-marco">
        {loading ? (
          <div className="gs-cargando">Cargando preguntas…</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="gs-vacio">
            <span className="material-icons-outlined">quiz</span>
            <strong>{preguntas.length ? 'Ninguna pregunta coincide con los filtros' : 'El banco está vacío'}</strong>
            {preguntas.length
              ? <button type="button" className="gs-btn" onClick={limpiarFiltros}>Quitar filtros</button>
              : <span>Crea una pregunta o impórtalas desde un documento, imagen o escáner.</span>}
          </div>
        ) : (
          <>
            <table className="gs-tabla">
              <thead>
                <tr>
                  <th>Pregunta</th>
                  <th className="gs-ocultar-movil">Curso</th>
                  <th className="gs-col-num">Estado</th>
                  <th className="gs-col-acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {enPagina.map((q) => (
                  <tr key={q.id} className="is-clicable" onClick={() => void handleOpenDetail(q)}>
                    <td>
                      <span className="gs-recortado bp-enunciado">{textoPlano(q.enunciado) || 'Sin texto (solo imagen)'}</span>
                      <span className="bp-etiquetas">
                        <span className="gs-chip gs-chip--codigo">{q.codigo}</span>
                        {tieneImagenAlguna(q) && <span className="gs-chip gs-chip--azul"><span className="material-icons-outlined">image</span>Imagen</span>}
                        {tieneFormula(q.enunciado) && <span className="gs-chip gs-chip--azul"><span className="material-icons-outlined">functions</span>Fórmula</span>}
                      </span>
                    </td>
                    <td className="gs-ocultar-movil">{q.cursoNombre}</td>
                    <td className="gs-col-num">
                      <span className={`gs-chip ${q.activo ? 'gs-chip--activo' : 'gs-chip--inactivo'}`}>{q.activo ? 'Activa' : 'Inactiva'}</span>
                    </td>
                    <td className="gs-col-acciones" onClick={(e) => e.stopPropagation()}>
                      <span className="gs-acciones">
                        <button type="button" className="gs-icono" title="Ver" onClick={() => void handleOpenDetail(q)}><span className="material-icons-outlined">visibility</span></button>
                        <button type="button" className="gs-icono" title="Editar" onClick={() => handleOpenEditForm(q)}><span className="material-icons-outlined">edit</span></button>
                        <button type="button" className="gs-icono peligro" title="Eliminar" onClick={() => void handleDeleteQuestion(q.id)}><span className="material-icons-outlined">delete_outline</span></button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPaginas > 1 && (
              <div className="gs-paginacion">
                <span>
                  {((paginaActual - 1) * POR_PAGINA + 1).toLocaleString('es-PE')}–{Math.min(paginaActual * POR_PAGINA, filteredQuestions.length).toLocaleString('es-PE')} de {filteredQuestions.length.toLocaleString('es-PE')}
                </span>
                <div>
                  <button type="button" className="gs-btn gs-btn-sm" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>
                    <span className="material-icons-outlined">chevron_left</span> Anterior
                  </button>
                  <span>Página {paginaActual} de {totalPaginas}</span>
                  <button type="button" className="gs-btn gs-btn-sm" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}>
                    Siguiente <span className="material-icons-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal: Crear / Editar pregunta ── */}
      {isFormModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <div className="modal-header">
              <h3>{editingId ? 'Editar Pregunta' : 'Nueva Pregunta'}</h3>
              <button className="btn-icon" onClick={() => setIsFormModalOpen(false)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="modal-body" key={formKey}>
              <div className="bp-form-fila">
                <div className="form-group mb-0">
                  <label>Curso *</label>
                  <Select
                    value={formData.cursoId}
                    onValueChange={(value) => setFormData({ ...formData, cursoId: value })}
                  >
                    <SelectTrigger className="w-full px-3 py-2 text-left">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {cursos.map((curso) => (
                        <SelectItem key={curso.id} value={String(curso.id)} className="px-3 py-2 cursor-pointer">
                          {curso.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-group mb-0">
                  <label>Estado</label>
                  <Select
                    value={formData.activo ? 'Activo' : 'Inactivo'}
                    onValueChange={(value) => setFormData({ ...formData, activo: value === 'Activo' })}
                  >
                    <SelectTrigger className="w-full px-3 py-2 text-left">
                      <SelectValue placeholder="Seleccione estado" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="Activo" className="px-3 py-2 cursor-pointer">Activo</SelectItem>
                      <SelectItem value="Inactivo" className="px-3 py-2 cursor-pointer">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Enunciado */}
              <div className="form-group">
                <label>Enunciado *</label>
                <EditorRico
                  value={formData.enunciado}
                  onChange={(enunciado) => setFormData((prev) => ({ ...prev, enunciado }))}
                  placeholder="Escribe la pregunta aquí. Usa la barra para formato, imágenes, tablas y ecuaciones."
                  alturaMinima={140}
                  etiqueta="Enunciado"
                />
              </div>

              {/* Alternativas */}
              <div className="form-group">
                <label>Alternativas *</label>
                <div className="bp-alternativas">
                  {formData.alternativas.map((alt, idx) => (
                    <div className="bp-alternativa" key={alt.letra}>
                      <div className="alt-letter-badge">{alt.letra}</div>
                      <div className="bp-alternativa-editor">
                        <EditorRico
                          value={alt.contenido}
                          onChange={(contenido) => cambiarAlternativa(idx, contenido)}
                          placeholder={`Alternativa ${alt.letra}`}
                          alturaMinima={52}
                          etiqueta={`Alternativa ${alt.letra}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setIsFormModalOpen(false)} disabled={isSaving}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSaveQuestion} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <span className="material-icons-outlined" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>sync</span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined">save</span>
                    Guardar Pregunta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Detalle de pregunta ── */}
      {selectedQuestion && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Detalle de la Pregunta</h3>
              <button className="btn-icon" onClick={() => setSelectedQuestion(null)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="question-meta" style={{ marginBottom: 12 }}>
                <span style={{ fontSize: '13px', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>school</span>
                  {selectedQuestion.cursoNombre}
                </span>
              </div>
              <div className="question-text" style={{ marginBottom: 16 }}>
                <ContentRenderer contentStr={selectedQuestion.enunciado} />
              </div>
              {/* Imagen suelta antigua: nunca la captura completa de una importación */}
              {imagenPrincipalVisible(selectedQuestion.enunciado, selectedQuestion.imagenUrl) && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <img
                    src={selectedQuestion.imagenUrl!}
                    alt="Imagen del enunciado"
                    className="question-image-detail"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}

              <ul className="options-list">
                {selectedQuestion.alternativas.map((opt) => (
                  <li key={opt.letra} className="option-item">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span className="option-letter">{opt.letra})</span>
                      <div style={{ flex: 1 }}>
                        {opt.contenidoTexto && <ContentRenderer contentStr={opt.contenidoTexto} inline={true} />}
                        {imagenPrincipalVisible(opt.contenidoTexto, opt.imagenUrl) && (
                          <img
                            src={opt.imagenUrl!}
                            alt={`Alternativa ${opt.letra}`}
                            className="option-image-detail"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
