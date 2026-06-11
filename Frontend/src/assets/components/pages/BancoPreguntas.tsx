import { useCallback, useEffect, useMemo, useState } from 'react';
import './BancoPreguntas.css';
import { listarCursos } from '../../../services/cursoService';
import { actualizarPregunta, crearPregunta, listarPreguntas } from '../../../services/preguntaService';

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
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL';
  activo: boolean;
  cursoId: number;
  cursoNombre: string;
  alternativas: AlternativaResponse[];
}

interface AlternativaForm {
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  tipo: 'TEXTO' | 'IMAGEN';
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
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL';
  activo: boolean;
  alternativas: AlternativaForm[];
}

const letras = ['A', 'B', 'C', 'D', 'E'] as const;

const crearFormVacio = (): FormDataPregunta => ({
  codigo: '',
  cursoId: '',
  enunciado: '',
  imagenUrl: '',
  dificultad: 'FACIL',
  activo: true,
  alternativas: letras.map((letra, index) => ({
    letra,
    tipo: 'TEXTO',
    contenidoTexto: '',
    imagenUrl: '',
    esCorrecta: index === 0,
    ordenVisualizacion: index + 1,
  })),
});

const dificultadLabel = (dificultad: string) => {
  if (dificultad === 'FACIL') return 'Fácil';
  if (dificultad === 'MEDIO') return 'Medio';
  return 'Difícil';
};

export default function BancoPreguntas() {
  const [preguntas, setPreguntas] = useState<PreguntaResponse[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCursoId, setFilterCursoId] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState<PreguntaResponse | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormDataPregunta>(crearFormVacio());

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

  const filteredQuestions = useMemo(() => preguntas.filter((q) => {
    const matchesSearch = q.enunciado.toLowerCase().includes(searchTerm.toLowerCase()) || q.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCurso = filterCursoId ? q.cursoId === Number(filterCursoId) : true;
    const matchesDiff = filterDifficulty ? q.dificultad === filterDifficulty : true;
    return matchesSearch && matchesCurso && matchesDiff;
  }), [filterCursoId, filterDifficulty, preguntas, searchTerm]);

  const handleOpenDetail = (question: PreguntaResponse) => {
    setSelectedQuestion(question);
    setIsAnswerRevealed(false);
  };

  const handleOpenCreateForm = () => {
    setEditingId(null);
    setFormData(crearFormVacio());
    setIsFormModalOpen(true);
  };

  const handleOpenEditForm = (question: PreguntaResponse) => {
    setEditingId(question.id);
    setFormData({
      codigo: question.codigo || '',
      cursoId: String(question.cursoId),
      enunciado: question.enunciado,
      imagenUrl: question.imagenUrl || '',
      dificultad: question.dificultad,
      activo: question.activo,
      alternativas: letras.map((letra, index) => {
        const alternativa = question.alternativas.find((item) => item.letra === letra);
        return {
          letra,
          tipo: alternativa?.tipo || 'TEXTO',
          contenidoTexto: alternativa?.contenidoTexto || '',
          imagenUrl: alternativa?.imagenUrl || '',
          esCorrecta: Boolean(alternativa?.esCorrecta),
          ordenVisualizacion: alternativa?.ordenVisualizacion || index + 1,
        };
      }),
    });
    setIsFormModalOpen(true);
  };

  const handleAlternativaChange = (index: number, field: keyof AlternativaForm, value: string | boolean) => {
    const alternativas = [...formData.alternativas];
    alternativas[index] = { ...alternativas[index], [field]: value };
    setFormData({ ...formData, alternativas });
  };

  const handleCorrectaChange = (index: number) => {
    setFormData({
      ...formData,
      alternativas: formData.alternativas.map((alternativa, currentIndex) => ({
        ...alternativa,
        esCorrecta: currentIndex === index,
      })),
    });
  };

  const validarFormulario = () => {
    if (!formData.cursoId || !formData.enunciado.trim()) {
      alert('Selecciona un curso y escribe el enunciado.');
      return false;
    }

    const invalidas = formData.alternativas.some((alternativa) => (
      alternativa.tipo === 'TEXTO' ? !alternativa.contenidoTexto.trim() : !alternativa.imagenUrl.trim()
    ));
    if (invalidas) {
      alert('Cada alternativa debe tener contenido según su tipo TEXTO o IMAGEN.');
      return false;
    }

    if (formData.alternativas.filter((alternativa) => alternativa.esCorrecta).length !== 1) {
      alert('Selecciona exactamente una alternativa correcta.');
      return false;
    }

    return true;
  };

  const handleSaveQuestion = async () => {
    if (!validarFormulario()) return;

    const payload = {
      codigo: formData.codigo.trim() || null,
      enunciado: formData.enunciado.trim(),
      imagenUrl: formData.imagenUrl.trim() || null,
      dificultad: formData.dificultad,
      activo: formData.activo,
      cursoId: Number(formData.cursoId),
      alternativas: formData.alternativas.map((alternativa) => ({
        letra: alternativa.letra,
        tipo: alternativa.tipo,
        contenidoTexto: alternativa.tipo === 'TEXTO' ? alternativa.contenidoTexto.trim() : null,
        imagenUrl: alternativa.tipo === 'IMAGEN' ? alternativa.imagenUrl.trim() : null,
        esCorrecta: alternativa.esCorrecta,
        ordenVisualizacion: alternativa.ordenVisualizacion,
      })),
    };

    try {
      if (editingId) {
        await actualizarPregunta(editingId, payload);
      } else {
        await crearPregunta(payload);
      }
      setIsFormModalOpen(false);
      await cargarDatos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar la pregunta');
    }
  };

  const getDifficultyBadgeClass = (diff: string) => {
    if (diff === 'FACIL') return 'badge-easy';
    if (diff === 'MEDIO') return 'badge-medium';
    return 'badge-hard';
  };

  return (
    <div className="banco-container">
      <div className="page-header">
        <h2 className="page-title">Banco de Preguntas</h2>
        <div className="header-actions">
          <button className="btn-primary" onClick={handleOpenCreateForm}>
            <span className="material-icons-outlined">add</span>
            Nueva Pregunta
          </button>
        </div>
      </div>

      {error && <div className="table-card" style={{ padding: '16px', color: 'var(--danger)' }}>{error}</div>}

      <div className="filters-bar">
        <input type="text" className="filter-input" placeholder="Buscar por código o palabra clave..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <select className="filter-select" value={filterCursoId} onChange={(e) => setFilterCursoId(e.target.value)}>
          <option value="">Todos los Cursos</option>
          {cursos.map((curso) => <option key={curso.id} value={curso.id}>{curso.nombre}</option>)}
        </select>
        <select className="filter-select" value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
          <option value="">Dificultad</option>
          <option value="FACIL">Fácil</option>
          <option value="MEDIO">Medio</option>
          <option value="DIFICIL">Difícil</option>
        </select>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Curso</th>
              <th>Enunciado (Resumen)</th>
              <th>Dificultad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Cargando preguntas reales del backend...</td>
              </tr>
            )}
            {!loading && filteredQuestions.map((q) => (
              <tr key={q.id}>
                <td><strong>{q.codigo}</strong></td>
                <td>{q.cursoNombre}</td>
                <td className="truncate-text" title={q.enunciado}>{q.enunciado}</td>
                <td><span className={`badge ${getDifficultyBadgeClass(q.dificultad)}`}>{dificultadLabel(q.dificultad)}</span></td>
                <td><span className={`badge ${q.activo ? 'badge-active' : 'badge-inactive'}`}>{q.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-icon" title="Ver Detalle" onClick={() => handleOpenDetail(q)}><span className="material-icons-outlined">visibility</span></button>
                    <button className="btn-icon" title="Editar" onClick={() => handleOpenEditForm(q)}><span className="material-icons-outlined">edit</span></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filteredQuestions.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No hay preguntas registradas para los filtros seleccionados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isFormModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar Pregunta' : 'Crear Nueva Pregunta'}</h3>
              <button className="btn-icon" onClick={() => setIsFormModalOpen(false)}><span className="material-icons-outlined">close</span></button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group mb-0">
                  <label>Curso *</label>
                  <select className="form-control" value={formData.cursoId} onChange={(e) => setFormData({ ...formData, cursoId: e.target.value })}>
                    <option value="">Seleccione...</option>
                    {cursos.map((curso) => <option key={curso.id} value={curso.id}>{curso.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group mb-0">
                  <label>Código</label>
                  <input type="text" className="form-control" value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} placeholder="Opcional" />
                </div>
              </div>

              <div className="form-group">
                <label>Enunciado *</label>
                <textarea className="form-control" placeholder="Escribe la pregunta aquí..." value={formData.enunciado} onChange={(e) => setFormData({ ...formData, enunciado: e.target.value })} />
              </div>

              <div className="form-group">
                <label>URL de imagen del enunciado (Opcional)</label>
                <input type="text" className="form-control" value={formData.imagenUrl} onChange={(e) => setFormData({ ...formData, imagenUrl: e.target.value })} placeholder="https://..." />
              </div>

              <div className="form-row">
                <div className="form-group mb-0">
                  <label>Dificultad *</label>
                  <select className="form-control" value={formData.dificultad} onChange={(e) => setFormData({ ...formData, dificultad: e.target.value as FormDataPregunta['dificultad'] })}>
                    <option value="FACIL">Fácil</option>
                    <option value="MEDIO">Medio</option>
                    <option value="DIFICIL">Difícil</option>
                  </select>
                </div>
                <div className="form-group mb-0">
                  <label>Estado</label>
                  <select className="form-control" value={formData.activo ? 'Activo' : 'Inactivo'} onChange={(e) => setFormData({ ...formData, activo: e.target.value === 'Activo' })}>
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Alternativas *</label>
                <div className="options-container">
                  {formData.alternativas.map((alternativa, idx) => (
                    <div className="option-input-group" key={alternativa.letra} style={{ alignItems: 'flex-start' }}>
                      <span className="option-letter" style={{ marginTop: '10px' }}>{alternativa.letra})</span>
                      <div className="option-input-wrapper">
                        <select className="form-control" value={alternativa.tipo} onChange={(e) => handleAlternativaChange(idx, 'tipo', e.target.value)}>
                          <option value="TEXTO">TEXTO</option>
                          <option value="IMAGEN">IMAGEN</option>
                        </select>
                        {alternativa.tipo === 'TEXTO' ? (
                          <input type="text" className="form-control" placeholder={`Texto de la alternativa ${alternativa.letra}`} value={alternativa.contenidoTexto} onChange={(e) => handleAlternativaChange(idx, 'contenidoTexto', e.target.value)} />
                        ) : (
                          <input type="text" className="form-control" placeholder={`URL de imagen alternativa ${alternativa.letra}`} value={alternativa.imagenUrl} onChange={(e) => handleAlternativaChange(idx, 'imagenUrl', e.target.value)} />
                        )}
                        <label className="checkbox-label" style={{ marginTop: '4px' }}>
                          <input type="radio" name="respuestaCorrecta" checked={alternativa.esCorrecta} onChange={() => handleCorrectaChange(idx)} />
                          Alternativa correcta
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setIsFormModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveQuestion}>Guardar Pregunta</button>
            </div>
          </div>
        </div>
      )}

      {selectedQuestion && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Detalle de la Pregunta</h3>
              <button className="btn-icon" onClick={() => setSelectedQuestion(null)}><span className="material-icons-outlined">close</span></button>
            </div>
            <div className="modal-body">
              <div className="question-meta">
                <span className={`badge ${getDifficultyBadgeClass(selectedQuestion.dificultad)}`}>{dificultadLabel(selectedQuestion.dificultad)}</span>
                <span style={{ fontSize: '13px', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>school</span>
                  {selectedQuestion.cursoNombre} ({selectedQuestion.codigo})
                </span>
              </div>
              <div className="question-text">{selectedQuestion.enunciado}</div>
              {selectedQuestion.imagenUrl && <img src={selectedQuestion.imagenUrl} alt="Apoyo visual" className="question-image" />}
              <ul className="options-list">
                {selectedQuestion.alternativas.map((opt) => {
                  const itemClass = isAnswerRevealed && opt.esCorrecta ? 'option-item correct' : 'option-item';
                  return (
                    <li key={opt.letra} className={itemClass}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div><span className="option-letter">{opt.letra})</span> {opt.tipo === 'TEXTO' ? opt.contenidoTexto : opt.imagenUrl}</div>
                        {opt.tipo === 'IMAGEN' && opt.imagenUrl && <img src={opt.imagenUrl} alt={`Opción ${opt.letra}`} className="option-image" />}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!isAnswerRevealed ? (
                <div className="hidden-answer-box">
                  <span className="material-icons-outlined" style={{ fontSize: '32px', color: '#9aa0a6' }}>lock</span>
                  <p>La respuesta correcta está oculta por seguridad.</p>
                  <button className="btn-outline" style={{ marginTop: '8px' }} onClick={() => setIsAnswerRevealed(true)}><span className="material-icons-outlined">visibility</span>Revelar Respuesta</button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button className="btn-outline" onClick={() => setIsAnswerRevealed(false)}><span className="material-icons-outlined">visibility_off</span>Ocultar Respuesta</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
