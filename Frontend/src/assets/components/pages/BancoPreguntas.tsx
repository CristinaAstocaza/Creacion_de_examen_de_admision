import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './BancoPreguntas.css';
import { listarCursos } from '../../../services/cursoService';
import {
  actualizarPregunta,
  crearPregunta,
  listarPreguntas,
  eliminarPregunta,
  obtenerPregunta,
  uploadRecorte,
} from '../../../services/preguntaService';
import { ContentRenderer } from '../ui/ContentRenderer';

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
  tipo: 'TEXTO' | 'IMAGEN'; // auto-computed on save, kept for compatibility
  contenidoTexto: string;
  imagenUrl: string;
  esCorrecta: boolean;
  ordenVisualizacion: number;
}

interface FormDataPregunta {
  codigo: string;
  cursoId: string;
  enunciado: string;
  imagenUrl: string;
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL'; // hidden from UI, always sent as 'MEDIO'
  activo: boolean;
  alternativas: AlternativaForm[];
}

const letras = ['A', 'B', 'C', 'D', 'E'] as const;

const crearFormVacio = (): FormDataPregunta => ({
  codigo: '',
  cursoId: '',
  enunciado: '',
  imagenUrl: '',
  dificultad: 'MEDIO',
  activo: true,
  alternativas: letras.map((letra, index) => ({
    letra,
    tipo: 'TEXTO',
    contenidoTexto: '',
    imagenUrl: '',
    esCorrecta: false,
    ordenVisualizacion: index + 1,
  })),
});

const extractTextFromBlocks = (contentStr: string): string => {
  if (!contentStr) return '';
  try {
    const blocks = JSON.parse(contentStr);
    if (Array.isArray(blocks)) {
      return blocks
        .filter((b: any) => b.tipo === 'texto' || b.tipo === 'latex')
        .map((b: any) => b.valor || '')
        .join(' ');
    }
  } catch (_e) {}
  return contentStr;
};

const isBlockFormat = (contentStr: string): boolean => {
  if (!contentStr) return false;
  try {
    return Array.isArray(JSON.parse(contentStr));
  } catch (_e) {
    return false;
  }
};

export default function BancoPreguntas() {
  const [preguntas, setPreguntas] = useState<PreguntaResponse[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCursoId, setFilterCursoId] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState<PreguntaResponse | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormDataPregunta>(crearFormVacio());
  const [isSaving, setIsSaving] = useState(false);

  // ── Enunciado image state ──
  const [enunciadoImageFile, setEnunciadoImageFile] = useState<File | null>(null);
  const [enunciadoImagePreview, setEnunciadoImagePreview] = useState('');
  const [enunciadoUrlMode, setEnunciadoUrlMode] = useState(false);
  const enunciadoFileRef = useRef<HTMLInputElement>(null);

  // ── Alternativas image state (5 slots A-E) ──
  const [altImageFiles, setAltImageFiles] = useState<(File | null)[]>([null, null, null, null, null]);
  const [altImagePreviews, setAltImagePreviews] = useState<string[]>(['', '', '', '', '']);
  const [altUrlModes, setAltUrlModes] = useState<boolean[]>([false, false, false, false, false]);
  const altFileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null]);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [preguntasData, cursosData] = await Promise.all([listarPreguntas(), listarCursos()]);
      setPreguntas(preguntasData);
      setCursos(cursosData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar preguntas y cursos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const filteredQuestions = useMemo(
    () =>
      preguntas.filter((q) => {
        const matchesSearch =
          q.enunciado.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.codigo.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCurso = filterCursoId ? q.cursoId === Number(filterCursoId) : true;
        return matchesSearch && matchesCurso;
      }),
    [filterCursoId, preguntas, searchTerm]
  );

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

  const resetImageState = () => {
    setEnunciadoImageFile(null);
    setEnunciadoImagePreview('');
    setEnunciadoUrlMode(false);
    setAltImageFiles([null, null, null, null, null]);
    setAltImagePreviews(['', '', '', '', '']);
    setAltUrlModes([false, false, false, false, false]);
    if (enunciadoFileRef.current) enunciadoFileRef.current.value = '';
    altFileRefs.current.forEach((ref) => { if (ref) ref.value = ''; });
  };

  const handleOpenDetail = async (question: PreguntaResponse) => {
    try {
      const data = await obtenerPregunta(question.id);
      setSelectedQuestion(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al obtener detalle de la pregunta');
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!window.confirm('¿Está seguro de eliminar esta pregunta?')) return;
    try {
      await eliminarPregunta(id);
      await cargarDatos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar la pregunta');
    }
  };

  const handleOpenCreateForm = () => {
    setEditingId(null);
    const nuevo = crearFormVacio();
    nuevo.codigo = generarCodigoAutomatico(preguntas);
    setFormData(nuevo);
    resetImageState();
    setIsFormModalOpen(true);
  };

  const handleOpenEditForm = (question: PreguntaResponse) => {
    setEditingId(question.id);
    setFormData({
      codigo: question.codigo || '',
      cursoId: String(question.cursoId),
      enunciado: question.enunciado,
      imagenUrl: question.imagenUrl || '',
      dificultad: question.dificultad || 'MEDIO',
      activo: question.activo,
      alternativas: letras.map((letra, index) => {
        const alt = question.alternativas.find((a) => a.letra === letra);
        return {
          letra,
          tipo: alt?.tipo || 'TEXTO',
          contenidoTexto: alt?.contenidoTexto || '',
          imagenUrl: alt?.imagenUrl || '',
          esCorrecta: false,
          ordenVisualizacion: alt?.ordenVisualizacion || index + 1,
        };
      }),
    });
    resetImageState();
    if (question.imagenUrl) setEnunciadoImagePreview(question.imagenUrl);
    const existingPreviews = letras.map((l) => {
      const a = question.alternativas.find((alt) => alt.letra === l);
      return a?.imagenUrl || '';
    });
    setAltImagePreviews(existingPreviews);
    setIsFormModalOpen(true);
  };

  const handleAlternativaChange = (index: number, field: keyof AlternativaForm, value: string | boolean) => {
    const alternativas = [...formData.alternativas];
    alternativas[index] = { ...alternativas[index], [field]: value };
    setFormData({ ...formData, alternativas });
  };

  // ── Enunciado image handlers ──
  const handleEnunciadoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setEnunciadoImageFile(file);
    setEnunciadoImagePreview(preview);
    setFormData((prev) => ({ ...prev, imagenUrl: '' }));
    setEnunciadoUrlMode(false);
  };

  const handleEnunciadoUrlChange = (url: string) => {
    setFormData((prev) => ({ ...prev, imagenUrl: url }));
    setEnunciadoImagePreview(url);
    setEnunciadoImageFile(null);
  };

  const handleClearEnunciadoImage = () => {
    setEnunciadoImageFile(null);
    setEnunciadoImagePreview('');
    setEnunciadoUrlMode(false);
    setFormData((prev) => ({ ...prev, imagenUrl: '' }));
    if (enunciadoFileRef.current) enunciadoFileRef.current.value = '';
  };

  // ── Alternativa image handlers ──
  const handleAltFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    const newFiles = [...altImageFiles];
    const newPreviews = [...altImagePreviews];
    newFiles[index] = file;
    newPreviews[index] = preview;
    setAltImageFiles(newFiles);
    setAltImagePreviews(newPreviews);
    handleAlternativaChange(index, 'imagenUrl', '');
    const newModes = [...altUrlModes];
    newModes[index] = false;
    setAltUrlModes(newModes);
  };

  const handleAltUrlChange = (index: number, url: string) => {
    handleAlternativaChange(index, 'imagenUrl', url);
    const newPreviews = [...altImagePreviews];
    newPreviews[index] = url;
    setAltImagePreviews(newPreviews);
    const newFiles = [...altImageFiles];
    newFiles[index] = null;
    setAltImageFiles(newFiles);
  };

  const handleClearAltImage = (index: number) => {
    const newFiles = [...altImageFiles];
    const newPreviews = [...altImagePreviews];
    const newModes = [...altUrlModes];
    newFiles[index] = null;
    newPreviews[index] = '';
    newModes[index] = false;
    setAltImageFiles(newFiles);
    setAltImagePreviews(newPreviews);
    setAltUrlModes(newModes);
    handleAlternativaChange(index, 'imagenUrl', '');
    if (altFileRefs.current[index]) altFileRefs.current[index]!.value = '';
  };

  const toggleAltUrlMode = (index: number) => {
    const newModes = [...altUrlModes];
    newModes[index] = !newModes[index];
    setAltUrlModes(newModes);
  };

  const validarFormulario = (): boolean => {
    if (!formData.cursoId || !formData.enunciado.trim()) {
      alert('Selecciona un curso y escribe el enunciado.');
      return false;
    }
    const invalidas = formData.alternativas.some((alt, idx) => {
      const hasText = alt.contenidoTexto.trim().length > 0;
      const hasUrl = alt.imagenUrl.trim().length > 0;
      const hasFile = altImageFiles[idx] !== null;
      return !hasText && !hasUrl && !hasFile;
    });
    if (invalidas) {
      alert('Cada alternativa debe tener al menos texto o imagen.');
      return false;
    }
    return true;
  };

  const handleSaveQuestion = async () => {
    if (!validarFormulario()) return;
    setIsSaving(true);
    try {
      // 1. Upload enunciado image file if present
      let enunciadoFinalUrl = formData.imagenUrl;
      if (enunciadoImageFile) {
        enunciadoFinalUrl = await uploadRecorte(enunciadoImageFile);
      }

      // 2. Upload alternativa image files if present, auto-compute tipo
      const alternativasFinales = await Promise.all(
        formData.alternativas.map(async (alt, idx) => {
          let finalAltUrl = alt.imagenUrl;
          if (altImageFiles[idx]) {
            finalAltUrl = await uploadRecorte(altImageFiles[idx]!);
          }
          const hasText = alt.contenidoTexto.trim().length > 0;
          const hasImage = finalAltUrl.trim().length > 0;
          // Auto-compute tipo: only IMAGEN when no text, else TEXTO (contenidoTexto carries content)
          const tipo: 'TEXTO' | 'IMAGEN' = hasImage && !hasText ? 'IMAGEN' : 'TEXTO';
          return { ...alt, imagenUrl: finalAltUrl, tipo };
        })
      );

      const payload = {
        codigo: formData.codigo.trim() || null,
        enunciado: formData.enunciado.trim(),
        imagenUrl: enunciadoFinalUrl.trim() || null,
        tieneImagen: !!enunciadoFinalUrl.trim(),
        dificultad: 'MEDIO' as const, // hidden from UI, always MEDIO
        activo: formData.activo,
        cursoId: Number(formData.cursoId),
        alternativas: alternativasFinales.map((alt) => ({
          letra: alt.letra,
          tipo: alt.tipo,
          contenidoTexto: alt.contenidoTexto.trim() || null,
          imagenUrl: alt.imagenUrl.trim() || null,
          esCorrecta: false,
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar la pregunta');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="banco-container">
      <div className="page-header">
        <h2 className="page-title">Banco de Preguntas</h2>
        <div className="header-actions">
          <button className="btn-primary" id="btn-nueva-pregunta" onClick={handleOpenCreateForm}>
            <span className="material-icons-outlined">add</span>
            Nueva Pregunta
          </button>
        </div>
      </div>

      {error && <div className="table-card" style={{ padding: '16px', color: 'var(--danger)' }}>{error}</div>}

      <div className="filters-bar">
        <input
          type="text"
          className="filter-input"
          placeholder="Buscar por código o palabra clave..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select className="filter-select" value={filterCursoId} onChange={(e) => setFilterCursoId(e.target.value)}>
          <option value="">Todos los Cursos</option>
          {cursos.map((curso) => (
            <option key={curso.id} value={curso.id}>{curso.nombre}</option>
          ))}
        </select>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Curso</th>
              <th>Enunciado (Resumen)</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Cargando preguntas...
                </td>
              </tr>
            )}
            {!loading && filteredQuestions.map((q) => (
              <tr key={q.id}>
                <td><strong>{q.codigo}</strong></td>
                <td>{q.cursoNombre}</td>
                <td className="truncate-text" title={extractTextFromBlocks(q.enunciado)}>
                  {extractTextFromBlocks(q.enunciado)}
                </td>
                <td>
                  <span className={`badge ${q.activo ? 'badge-active' : 'badge-inactive'}`}>
                    {q.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-icon" title="Ver Detalle" onClick={() => handleOpenDetail(q)}>
                      <span className="material-icons-outlined">visibility</span>
                    </button>
                    <button className="btn-icon" title="Editar" onClick={() => handleOpenEditForm(q)}>
                      <span className="material-icons-outlined">edit</span>
                    </button>
                    <button className="btn-icon" title="Eliminar" onClick={() => handleDeleteQuestion(q.id)} style={{ color: 'var(--danger)' }}>
                      <span className="material-icons-outlined">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filteredQuestions.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No hay preguntas registradas para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal Crear / Editar ── */}
      {isFormModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <div className="modal-header">
              <h3>{editingId ? 'Editar Pregunta' : 'Nueva Pregunta'}</h3>
              <button className="btn-icon" onClick={() => setIsFormModalOpen(false)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="modal-body">
              {/* Fila: Curso + Código (readonly) */}
              <div className="form-row">
                <div className="form-group mb-0" style={{ flex: 2 }}>
                  <label>Curso *</label>
                  <select
                    className="form-control"
                    value={formData.cursoId}
                    onChange={(e) => setFormData({ ...formData, cursoId: e.target.value })}
                  >
                    <option value="">Seleccione...</option>
                    {cursos.map((curso) => (
                      <option key={curso.id} value={curso.id}>{curso.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group mb-0" style={{ flex: 1 }}>
                  <label>Código</label>
                  <div className="code-readonly-box">
                    <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>tag</span>
                    <span className="code-readonly-text">{formData.codigo || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Enunciado */}
              <div className="form-group">
                <label>Enunciado *</label>
                <textarea
                  className="form-control"
                  placeholder="Escribe la pregunta aquí..."
                  value={formData.enunciado}
                  onChange={(e) => setFormData({ ...formData, enunciado: e.target.value })}
                />
              </div>

              {/* Imagen del enunciado */}
              <div className="form-group">
                <label>Imagen del enunciado <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Opcional)</span></label>
                <div className="image-upload-zone">
                  {!enunciadoImagePreview ? (
                    <div className="image-upload-placeholder">
                      <span className="material-icons-outlined" style={{ fontSize: '32px', color: 'var(--text-muted)' }}>image</span>
                      <div className="image-upload-actions">
                        <button
                          type="button"
                          className="btn-upload-action"
                          onClick={() => enunciadoFileRef.current?.click()}
                        >
                          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>upload</span>
                          Subir imagen
                        </button>
                        <button
                          type="button"
                          className="btn-upload-action btn-upload-url"
                          onClick={() => setEnunciadoUrlMode((v) => !v)}
                        >
                          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>link</span>
                          Ingresar URL
                        </button>
                      </div>
                      {enunciadoUrlMode && (
                        <input
                          type="text"
                          className="form-control"
                          placeholder="https://..."
                          value={formData.imagenUrl}
                          onChange={(e) => handleEnunciadoUrlChange(e.target.value)}
                          style={{ marginTop: '8px' }}
                        />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        ref={enunciadoFileRef}
                        style={{ display: 'none' }}
                        onChange={handleEnunciadoFileSelect}
                      />
                    </div>
                  ) : (
                    <div className="image-preview-zone">
                      <img
                        src={enunciadoImagePreview}
                        alt="Preview enunciado"
                        className="image-preview-img"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <div className="image-preview-actions">
                        <button type="button" className="btn-upload-action" onClick={() => enunciadoFileRef.current?.click()}>
                          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>swap_horiz</span>
                          Reemplazar
                        </button>
                        <button type="button" className="btn-upload-action btn-delete-action" onClick={handleClearEnunciadoImage}>
                          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>delete</span>
                          Eliminar
                        </button>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        ref={enunciadoFileRef}
                        style={{ display: 'none' }}
                        onChange={handleEnunciadoFileSelect}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Estado */}
              <div className="form-group">
                <label>Estado</label>
                <select
                  className="form-control"
                  value={formData.activo ? 'Activo' : 'Inactivo'}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.value === 'Activo' })}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>

              {/* Alternativas */}
              <div className="form-group">
                <label>Alternativas *</label>
                <div className="options-container">
                  {formData.alternativas.map((alt, idx) => {
                    const hasPreview = altImagePreviews[idx];
                    return (
                      <div className="alt-mixed-group" key={alt.letra}>
                        <div className="alt-letter-badge">{alt.letra}</div>
                        <div className="alt-fields">
                          {/* Texto */}
                          <input
                            type="text"
                            className="form-control"
                            placeholder={`Texto de la alternativa ${alt.letra} (opcional)`}
                            value={alt.contenidoTexto}
                            onChange={(e) => handleAlternativaChange(idx, 'contenidoTexto', e.target.value)}
                          />

                          {/* Imagen */}
                          {!hasPreview ? (
                            <div className="alt-image-row">
                              <button
                                type="button"
                                className="btn-upload-sm"
                                onClick={() => altFileRefs.current[idx]?.click()}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>upload</span>
                                Imagen
                              </button>
                              <button
                                type="button"
                                className={`btn-upload-sm ${altUrlModes[idx] ? 'btn-upload-sm-active' : ''}`}
                                onClick={() => toggleAltUrlMode(idx)}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>link</span>
                                URL
                              </button>
                              {altUrlModes[idx] && (
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="https://imagen..."
                                  value={alt.imagenUrl}
                                  onChange={(e) => handleAltUrlChange(idx, e.target.value)}
                                  style={{ flex: 1 }}
                                />
                              )}
                            </div>
                          ) : (
                            <div className="alt-image-preview-row">
                              <img
                                src={hasPreview}
                                alt={`Alt ${alt.letra}`}
                                className="alt-mini-preview"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                              <button
                                type="button"
                                className="btn-upload-sm btn-delete-action"
                                onClick={() => handleClearAltImage(idx)}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>delete</span>
                                Eliminar imagen
                              </button>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            ref={(el) => { altFileRefs.current[idx] = el; }}
                            style={{ display: 'none' }}
                            onChange={(e) => handleAltFileSelect(idx, e)}
                          />
                        </div>
                      </div>
                    );
                  })}
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

      {/* ── Modal Detalle ── */}
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
                <span style={{ fontSize: '12px', color: '#9aa0a6', background: '#f1f3f4', padding: '2px 10px', borderRadius: '12px' }}>
                  {selectedQuestion.codigo}
                </span>
              </div>
              <div className="question-text" style={{ marginBottom: 16 }}>
                <ContentRenderer contentStr={selectedQuestion.enunciado} />
              </div>
              {/* Solo mostrar imagen legacy si no es formato de bloques */}
              {selectedQuestion.imagenUrl && !isBlockFormat(selectedQuestion.enunciado) && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <img
                    src={selectedQuestion.imagenUrl}
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
                        {/* Renderizar texto si existe */}
                        {opt.contenidoTexto && (
                          <ContentRenderer contentStr={opt.contenidoTexto} inline={true} />
                        )}
                        {/* Renderizar imagen si existe */}
                        {opt.imagenUrl && !isBlockFormat(opt.contenidoTexto || '') && (
                          <img
                            src={opt.imagenUrl}
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
