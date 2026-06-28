import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './GenerarExamen.css';
import CustomSelect from '../ui/CustomSelect';
import { listarCategorias, listarConfigCursos } from '../../services/categoriaService';
import { listarCursos } from '../../services/cursoService';
import { generarExamen } from '../../services/examenService';

interface CategoriaExamen {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface Curso {
  id: number;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  activo: boolean;
}

interface CategoriaCursoConfig {
  id: number;
  cursoId: number;
  cursoNombre: string;
  cursoCodigo: string | null;
  cantidadSugerida: number | null;
  activo: boolean;
}

interface Quantities {
  total: number;
  facil: number;
  medio: number;
  dificil: number;
}

interface ExamenGenerado {
  id: number;
  codigo: string;
  nombre: string;
  categoriaExamenNombre: string;
}

const emptyQuantities = (): Quantities => ({ total: 0, facil: 0, medio: 0, dificil: 0 });

export default function GenerarExamen() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<CategoriaExamen[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [configs, setConfigs] = useState<CategoriaCursoConfig[]>([]);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number | ''>('');
  const [nombreExamen, setNombreExamen] = useState('Examen de admisión');
  const [numVersions, setNumVersions] = useState<number>(1);
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [selectedCourses, setSelectedCourses] = useState<Record<number, boolean>>({});
  const [quantities, setQuantities] = useState<Record<number, Quantities>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [_examenGenerado, setExamenGenerado] = useState<ExamenGenerado | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const cargarCategoriasYCursos = async () => {
    try {
      setLoading(true);
      const [categoriasData, cursosData] = await Promise.all([listarCategorias(), listarCursos()]);
      setCategorias(categoriasData.filter((categoria: CategoriaExamen) => categoria.activo));
      setCursos(cursosData.filter((curso: Curso) => curso.activo));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con el backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCategoriasYCursos();
  }, []);

  useEffect(() => {
    const cargarSugerencias = async () => {
      if (!selectedCategoriaId) {
        setConfigs([]);
        return;
      }

      try {
        const sugerencias = await listarConfigCursos(selectedCategoriaId);
        const activas = sugerencias.filter((config: CategoriaCursoConfig) => config.activo);
        const selected: Record<number, boolean> = {};
        const nextQuantities: Record<number, Quantities> = {};

        activas.forEach((config: CategoriaCursoConfig) => {
          selected[config.cursoId] = Boolean(config.cantidadSugerida && config.cantidadSugerida > 0);
          nextQuantities[config.cursoId] = {
            total: config.cantidadSugerida || 0,
            facil: 0,
            medio: 0,
            dificil: 0,
          };
        });

        setConfigs(activas);
        setSelectedCourses(selected);
        setQuantities(nextQuantities);
        setError('');
      } catch (err) {
        setConfigs([]);
        setSelectedCourses({});
        setQuantities({});
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las sugerencias de cursos');
      }
    };

    cargarSugerencias();
  }, [selectedCategoriaId]);

  const cursosProcesados = useMemo(() => cursos.map((curso) => {
    const config = configs.find((item) => item.cursoId === curso.id);
    const req = quantities[curso.id] || emptyQuantities();
    const dificultadTotal = req.facil + req.medio + req.dificil;
    const usaDificultades = dificultadTotal > 0;
    const errorDificultad = selectedCourses[curso.id] && usaDificultades && dificultadTotal !== req.total;

    return {
      ...curso,
      sugerido: Boolean(config),
      cantidadSugerida: config?.cantidadSugerida || null,
      isSelected: Boolean(selectedCourses[curso.id]),
      req,
      errorDificultad,
    };
  }), [configs, cursos, quantities, selectedCourses]);

  const totalSelected = cursosProcesados.reduce((total, curso) => total + (curso.isSelected ? curso.req.total : 0), 0);
  const hasErrors = cursosProcesados.some((curso) => curso.errorDificultad || (curso.isSelected && curso.req.total <= 0));
  const isGenerateDisabled = !selectedCategoriaId || hasErrors || totalSelected !== 100 || numVersions < 1 || generating;
  const summaryMessage = totalSelected !== 100
    ? 'El total debe ser exactamente 100 preguntas.'
    : hasErrors
      ? 'Revisa las cantidades por curso y la suma por dificultad.'
      : 'Configuración válida para generar el examen.';
  const summaryMessageColor = totalSelected === 100 && !hasErrors ? 'var(--success-text)' : 'var(--danger)';

  const selectedCategoria = categorias.find((categoria) => categoria.id === selectedCategoriaId);

  const handleToggleCourse = (id: number, checked: boolean) => {
    setSelectedCourses((prev) => ({ ...prev, [id]: checked }));
    setQuantities((prev) => ({
      ...prev,
      [id]: checked ? (prev[id] || emptyQuantities()) : emptyQuantities(),
    }));
  };

  const handleQuantityChange = (id: number, level: keyof Quantities, value: string) => {
    const val = Math.max(parseInt(value, 10) || 0, 0);
    setQuantities((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || emptyQuantities()),
        [level]: val,
      },
    }));
  };

  const handleGenerate = async () => {
    if (isGenerateDisabled) return;

    // Validación del diseño de la carátula
    const savedConfig = localStorage.getItem('configuracionExamen');
    let configValida = false;
    let parsedConfig: any = null;

    if (savedConfig) {
      try {
        parsedConfig = JSON.parse(savedConfig);
        // Validamos que existan y no estén vacíos los campos requeridos para la portada
        if (parsedConfig.institutionName && parsedConfig.headerText && parsedConfig.modalidad && parsedConfig.colorPortada) {
          configValida = true;
        }
      } catch (e) {}
    }

    if (!configValida) {
      alert("Aún no hay un diseño hecho para la categoría seleccionada. Por favor, configure el formato antes de generar.");
      return;
    }

    const confirmacion = window.confirm(`Vas a generar ${numVersions} versión(es) de un examen con 100 preguntas. ¿Deseas continuar?`);
    if (!confirmacion || !selectedCategoriaId) return;

    const cursosPayload = cursosProcesados
      .filter((curso) => curso.isSelected)
      .map((curso) => {
        const dificultadTotal = curso.req.facil + curso.req.medio + curso.req.dificil;
        return {
          idCurso: curso.id,
          cantidadTotal: curso.req.total,
          cantidadFacil: dificultadTotal > 0 ? curso.req.facil : null,
          cantidadMedio: dificultadTotal > 0 ? curso.req.medio : null,
          cantidadDificil: dificultadTotal > 0 ? curso.req.dificil : null,
        };
      });

    try {
      setGenerating(true);
      setError('');
      
      const payloadConfig = {
        nombreUniversidad: parsedConfig.institutionName.trim(),
        tituloExamen: parsedConfig.headerText.trim(),
        modalidad: parsedConfig.modalidad.trim(),
        colorPortada: parsedConfig.colorPortada,
        logoUrl: parsedConfig.logoUrl || null,
        instruccionesPortada: parsedConfig.instructions?.trim() || null,
      };

      const examen = await generarExamen({
        idCategoria: selectedCategoriaId,
        nombreExamen: nombreExamen.trim() || 'Examen de admisión',
        cantidadVersiones: numVersions,
        aleatorizarPreguntas: randomizeQuestions,
        aleatorizarAlternativas: randomizeOptions,
        cursos: cursosPayload,
        ...payloadConfig
      });

      setExamenGenerado(examen);
      setShowSuccessModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el examen');
    } finally {
      setGenerating(false);
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    navigate('/historial');
  };

  return (
    <div className="generar-container">
      <div className="page-header">
        <h2 className="page-title">Generación de Exámenes</h2>
      </div>

      {error && <div className="card error-banner">{error}</div>}


      <div className="generator-layout">
        <div className="config-section">
          <div className="card">
            <h3 className="card-title"><span className="material-icons-outlined">settings</span> Parámetros del Examen</h3>
            <div className="config-grid">
              <div className="form-group">
                <label>Categoría del examen</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <CustomSelect
                    options={categorias.map((c) => ({ value: String(c.id), label: c.nombre }))}
                    value={selectedCategoriaId !== '' ? String(selectedCategoriaId) : ''}
                    onChange={(val) => setSelectedCategoriaId(val ? Number(val) : '')}
                    placeholder="Selecciona una categoría"
                    disabled={loading}
                  />
                  <button type="button" className="btn-outline" onClick={cargarCategoriasYCursos} disabled={loading}>
                    Recargar
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Nombre del archivo</label>
                <input className="form-control" placeholder="Nombre del archivo" value={nombreExamen} onChange={(e) => setNombreExamen(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Número de Versiones</label>
                <input type="number" className="form-control" min="1" value={numVersions} onChange={(e) => setNumVersions(parseInt(e.target.value, 10) || 1)} />
              </div>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={randomizeQuestions} onChange={(e) => setRandomizeQuestions(e.target.checked)} />
                  Aleatorizar orden de preguntas
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={randomizeOptions} onChange={(e) => setRandomizeOptions(e.target.checked)} />
                  Aleatorizar alternativas (A, B, C...)
                </label>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="card-title" style={{ marginBottom: '4px' }}>
                  <span className="material-icons-outlined">format_list_numbered</span> Selección de Cursos
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Se muestran todos los cursos globales. Las sugerencias de la categoría se precargan, pero no limitan la selección.
                </p>
              </div>
            </div>

            <table className="shadcn-table">
              <thead>
                <tr>
                  <th className="col-checkbox">Incluir</th>
                  <th>Curso</th>
                  <th style={{ textAlign: 'right' }}>Cantidad total</th>
                  <th style={{ textAlign: 'right' }}>Dificultad opcional</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      Cargando cursos desde el backend...
                    </td>
                  </tr>
                )}
                {!loading && cursosProcesados.map((curso) => (
                  <tr key={curso.id} style={{ backgroundColor: curso.isSelected ? '#f8fbff' : 'transparent' }}>
                    <td className="col-checkbox">
                      <input type="checkbox" className="row-checkbox" checked={curso.isSelected} onChange={(e) => handleToggleCourse(curso.id, e.target.checked)} />
                    </td>
                    <td>
                      <strong style={{ color: curso.isSelected ? 'var(--primary-blue)' : 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        {curso.nombre}
                      </strong>
                      <span className="category-badge">{curso.sugerido ? `Sugerido${curso.cantidadSugerida ? `: ${curso.cantidadSugerida}` : ''}` : 'Curso global'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input type="number" className="input-number" min="0" disabled={!curso.isSelected} value={curso.isSelected && curso.req.total ? curso.req.total : ''} placeholder="0" onChange={(e) => handleQuantityChange(curso.id, 'total', e.target.value)} />
                    </td>
                    <td>
                      <div className="difficulty-group">
                        <div className="diff-item">
                          <span className="diff-label">Fácil</span>
                          <input type="number" className="input-number-sm" value={curso.isSelected && curso.req.facil ? curso.req.facil : ''} placeholder="0" min="0" disabled={!curso.isSelected} onChange={(e) => handleQuantityChange(curso.id, 'facil', e.target.value)} />
                        </div>
                        <div className="diff-item">
                          <span className="diff-label">Medio</span>
                          <input type="number" className="input-number-sm" value={curso.isSelected && curso.req.medio ? curso.req.medio : ''} placeholder="0" min="0" disabled={!curso.isSelected} onChange={(e) => handleQuantityChange(curso.id, 'medio', e.target.value)} />
                        </div>
                        <div className="diff-item">
                          <span className="diff-label">Difícil</span>
                          <input type="number" className="input-number-sm" value={curso.isSelected && curso.req.dificil ? curso.req.dificil : ''} placeholder="0" min="0" disabled={!curso.isSelected} onChange={(e) => handleQuantityChange(curso.id, 'dificil', e.target.value)} />
                        </div>
                      </div>
                      {curso.errorDificultad && <span className="error-text">La dificultad debe sumar {curso.req.total}.</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="summary-section">
          <div className="summary-card">
            <h3 className="card-title"><span className="material-icons-outlined">receipt_long</span> Resumen del Examen</h3>
            <div style={{ marginTop: '24px' }}>
              {cursosProcesados.map((curso) => (
                curso.isSelected && curso.req.total > 0 && (
                  <div className="summary-row" key={curso.id} style={{ color: curso.errorDificultad ? 'var(--danger)' : 'inherit' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{curso.nombre}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {curso.req.facil} F - {curso.req.medio} M - {curso.req.dificil} D
                      </span>
                    </div>
                    <strong style={{ display: 'flex', alignItems: 'center' }}>{curso.req.total}</strong>
                  </div>
                )
              ))}
              {totalSelected === 0 && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  {selectedCategoria ? 'Selecciona cursos para generar el examen.' : 'Selecciona una categoría para cargar sugerencias.'}
                </div>
              )}
            </div>

            <div className="summary-total">
              <span>Total de Preguntas</span>
              <span style={{ color: totalSelected === 100 && !hasErrors ? 'var(--success-text)' : 'var(--danger)' }}>{totalSelected}</span>
            </div>

            <p style={{ fontSize: '12px', color: summaryMessageColor, marginTop: '12px', textAlign: 'center' }}>
              {summaryMessage}
            </p>

            <button className={`btn-primary ${isGenerateDisabled ? 'btn-disabled' : ''}`} disabled={isGenerateDisabled} onClick={handleGenerate}>
              <span className="material-icons-outlined">note_add</span>
              {generating ? 'Generando...' : 'Generar Examen'}
            </button>
          </div>
        </div>
      </div>

      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <span className="material-icons-outlined success-icon">check_circle</span>
            <h3>¡Generación Exitosa!</h3>
            <p>Exámenes generados con éxito. Ya fueron cargados en la sección Historial de Exámenes con la configuración determinada.</p>
            <button className="btn-primary" onClick={handleCloseSuccessModal}>
              Ir al Historial
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
