import { useState, useEffect, type MouseEvent } from 'react';
import './HistorialExamenes.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  listarExamenes,
  obtenerExamen,
  obtenerVersionExamen,
  descargarPdfVersion,
  descargarPdfSolucionario,
  descargarPdfsVersiones
} from '../../services/examenService';
import { listarCategorias } from '../../services/categoriaService';

interface Version {
  id: number;
  codigoVersion: string;
}

interface ExamenCursoUsado {
  idCurso: number;
  cursoNombre: string;
  cantidadTotal: number;
}

interface Examen {
  id: number;
  codigo: string;
  fechaCreacion: string;
  nombre: string;
  categoriaExamenNombre: string;
  cantidadVersiones: number;
  aleatorizarPreguntas: boolean;
  versiones?: Version[];
  cursosUsados?: ExamenCursoUsado[];
}

export const HistorialExamenes = () => {
  const [examenes, setExamenes] = useState<Examen[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroCodigo, setFiltroCodigo] = useState<string>('');
  const [filtroArea, setFiltroArea] = useState<string>('');
  const [categorias, setCategorias] = useState<any[]>([]);

  const [examenSeleccionado, setExamenSeleccionado] = useState<Examen | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState<boolean>(false);

  const [vistaActiva, setVistaActiva] = useState<'tabla' | 'previsualizacion'>('tabla');
  const [versionActivaNombre, setVersionActivaNombre] = useState<string>('');
  const [versionData, setVersionData] = useState<any>(null);
  const [loadingVersion, setLoadingVersion] = useState<boolean>(false);

  useEffect(() => {
    cargarExamenes();
    cargarCategorias();
  }, []);

  const cargarCategorias = async () => {
    try {
      const data = await listarCategorias();
      setCategorias(data);
    } catch (err) {
      console.error('Error al cargar categorias:', err);
    }
  };

  const cargarExamenes = async () => {
    try {
      setLoading(true);
      const data = await listarExamenes();
      setExamenes(data);
      setError(null);
    } catch (err) {
      console.error('Error al listar examenes:', err);
      setError('Error al cargar el historial de exámenes.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (exam: Examen) => {
    try {
      setLoadingDetalle(true);
      setExamenSeleccionado(exam);
      const dataCompleta = await obtenerExamen(exam.id);
      setExamenSeleccionado(dataCompleta);
    } catch (err) {
      console.error('Error al obtener detalle del examen:', err);
      alert('Error al cargar los detalles del examen');
    } finally {
      setLoadingDetalle(false);
    }
  };

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleVerPreviewA4 = async (examenId: number, examenNombre: string, versionLetra: string) => {
    setVersionActivaNombre(`${examenNombre} - Versión ${versionLetra}`);
    setVistaActiva('previsualizacion');
    setExamenSeleccionado(null);

    try {
      setLoadingVersion(true);
      const data = await obtenerVersionExamen(examenId, versionLetra);
      setVersionData({ ...data, examenId, codigoVersion: versionLetra });
    } catch (err) {
      console.error('Error al cargar la versión del examen:', err);
      alert('Error al cargar la vista previa de esta versión.');
      setVistaActiva('tabla');
    } finally {
      setLoadingVersion(false);
    }
  };

  const handleDescargarZip = async (examenId: number) => {
    try {
      await descargarPdfsVersiones(examenId);
    } catch (err) {
      console.error('Error al descargar ZIP:', err);
      alert('Hubo un error al intentar descargar el paquete ZIP de versiones.');
    }
  };

  const calcularTotalPreguntas = (exam: Examen) => {
    if (!exam.cursosUsados) return 0;
    return exam.cursosUsados.reduce((sum, c) => sum + c.cantidadTotal, 0);
  };

  const formatFecha = (fecha: string) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString();
  };

  const getCoverConfig = () => {
    const savedConfig = localStorage.getItem('configuracionExamen');
    let config = {
      institutionName: 'UNIVERSIDAD NACIONAL',
      headerText: 'EXAMEN DE ADMISIÓN 2025',
      instructions: 'Lea cuidadosamente cada pregunta y marque solo una alternativa.',
      logoUrl: null,
      modalidad: 'MODALIDAD ORDINARIO',
      colorPortada: '#6366f1'
    };
    if (savedConfig) {
      try {
        config = { ...config, ...JSON.parse(savedConfig) };
      } catch (e) {}
    }
    return config;
  };

  const getContrastColor = (hexColor: string) => {
    const hex = (hexColor || '#ffffff').replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? '#0f172a' : '#ffffff';
    }
    return '#ffffff';
  };

  // Renderizado de la Vista Previa A4 (Dos páginas)
  if (vistaActiva === 'previsualizacion') {
    const coverConfig = getCoverConfig();
    const previewTextColor = getContrastColor(coverConfig.colorPortada);
    
    // Agrupar preguntas por curso con numeracion global 1-100
    const preguntasPorCurso: Record<string, any[]> = {};
    if (versionData && versionData.preguntas) {
      let globalCounter = 1;
      versionData.preguntas.forEach((p: any) => {
        const curso = p.cursoNombre || 'OTROS';
        if (!preguntasPorCurso[curso]) {
          preguntasPorCurso[curso] = [];
        }
        preguntasPorCurso[curso].push({ ...p, globalNumber: globalCounter++ });
      });
    }

    return (
      <div className="preview-container">
        <div className="preview-toolbar">
          <div>
            <h2>Vista Previa del Examen</h2>
            <p style={{ margin: '4px 0 0 0', color: '#5f6368', fontSize: '0.9rem' }}>{versionActivaNombre}</p>
          </div>
          <div className="toolbar-actions">
            <button className="btn btn-outline" onClick={() => setVistaActiva('tabla')}>
              Volver al Historial
            </button>
            {versionData && (
              <button
                className="btn btn-primary"
                onClick={() => descargarPdfVersion(versionData.examenId, versionData.codigoVersion)}
              >
                Descargar PDF
              </button>
            )}
          </div>
        </div>

        <div className="a4-preview-scroll-wrapper" onContextMenu={handleContextMenu}>
          <div className="a4-pages-flex">
            
            {/* PÁGINA 1: PORTADA */}
            <div className="a4-sheet cover-page" style={{ backgroundColor: coverConfig.colorPortada, color: previewTextColor }}>
              <div className="cover-preview-content">
                <div className="cover-institution">
                  {coverConfig.institutionName || 'UNIVERSIDAD'}
                </div>
                
                {coverConfig.logoUrl ? (
                  <img src={coverConfig.logoUrl} alt="Logo" className="cover-logo" />
                ) : (
                  <div className="cover-logo-placeholder" style={{ borderColor: previewTextColor }}>LOGO</div>
                )}
                
                <div className="cover-title">
                  {coverConfig.headerText || 'EXAMEN DE ADMISIÓN'}
                </div>

                <div className="cover-modality">
                  {coverConfig.modalidad || 'MODALIDAD'}
                </div>

                <div className="cover-theme-section" style={{ borderColor: previewTextColor }}>
                  <div className="cover-theme-label">TEMA</div>
                  <div className="cover-theme-letter">{versionData?.codigoVersion || 'A'}</div>
                  <div className="cover-theme-hint">(Generado automáticamente)</div>
                </div>

                <div className="cover-instructions" style={{ borderColor: previewTextColor }}>
                  <strong>Instrucciones:</strong> {coverConfig.instructions || 'Sin instrucciones adicionales.'}
                </div>
                
                <div className="cover-footer-text">
                  Examen de Admisión Oficial
                </div>
              </div>
            </div>

            {/* PÁGINA 2: CONTENIDO ORDENADO POR CURSOS */}
            <div className="a4-sheet questions-page">
              <header className="exam-header-compact">
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 'bold' }}>TEMA {versionData?.codigoVersion || 'A'}</span>
                  <span style={{ textTransform: 'uppercase' }}>{coverConfig.institutionName}</span>
                </div>
              </header>

              {loadingVersion ? (
                <p style={{ textAlign: 'center', marginTop: '20px' }}>Cargando preguntas de la versión...</p>
              ) : Object.keys(preguntasPorCurso).length > 0 ? (
                <div className="questions-grouped-container">
                  {Object.entries(preguntasPorCurso).map(([curso, listaPreguntas]) => (
                    <div key={curso} className="course-group-section">
                      <h3 className="course-group-title">{curso.toUpperCase()}</h3>
                      <div className="questions-list-by-course">
                        {listaPreguntas.map((p: any) => (
                          <div className="question-item-grouped" key={p.id || p.globalNumber}>
                            <p className="question-text-grouped">
                              <strong>{p.globalNumber}.</strong> {p.enunciado.replace(/^\d+[\.\-\)]\s*/, '')}
                            </p>
                            <div className="options-grid-grouped">
                              {p.alternativas?.map((alt: any) => (
                                <div className="option-item-grouped" key={alt.id}>
                                  <strong>{alt.letra})</strong> {alt.contenidoTexto}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ textAlign: 'center', marginTop: '20px' }}>No hay datos disponibles para esta versión.</p>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  const examenesFiltrados = examenes.filter((exam) => {
    const matchesCodigo = exam.codigo.toLowerCase().includes(filtroCodigo.toLowerCase());
    const matchesArea = filtroArea === '' || exam.categoriaExamenNombre === filtroArea;
    return matchesCodigo && matchesArea;
  });

  return (
    <div className="historial-container">
      <h2>Historial de Exámenes</h2>

      <div className="header-filters-section">
        <div className="filters-group">
          <div className="input-control">
            <label>Buscar por código</label>
            <input 
              type="text" 
              placeholder="Ej. EXM-2026..." 
              value={filtroCodigo}
              onChange={(e) => setFiltroCodigo(e.target.value)}
            />
          </div>
            <div className="input-control">
            <label>Filtrar por Área</label>
            <Select value={filtroArea} onValueChange={(value) => setFiltroArea(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Todas las áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las áreas</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.nombre}>{cat.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <p style={{ padding: '20px', textAlign: 'center' }}>Cargando exámenes...</p>
        ) : error ? (
          <p style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</p>
        ) : examenesFiltrados.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center' }}>No se encontraron exámenes con los filtros aplicados.</p>
        ) : (
          <table className="shadcn-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>Nombre del Examen</th>
                <th>Área / Categoría</th>
                <th>Vers.</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {examenesFiltrados.map((exam) => (
                <tr key={exam.id}>
                  <td className="exam-code">{exam.codigo}</td>
                  <td>{formatFecha(exam.fechaCreacion)}</td>
                  <td>{exam.nombre}</td>
                  <td>
                    <div className="chip-container">
                      <span className="chip">{exam.categoriaExamenNombre}</span>
                    </div>
                  </td>
                  <td>{exam.cantidadVersiones}</td>
                  <td className="action-cell">
                    <button
                      className="btn-icon"
                      title="Ver detalle de versiones"
                      onClick={() => handleVerDetalle(exam)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      className="btn-icon"
                      title="Descargar paquete ZIP (Todas las versiones)"
                      onClick={() => handleDescargarZip(exam.id)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL DETALLE DE VERSIONES */}
      {examenSeleccionado && (
        <div className="modal-overlay" onClick={() => setExamenSeleccionado(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <h3>Detalle del Examen {loadingDetalle && <small>(Cargando...)</small>}</h3>
              </div>
              <button className="close-btn" onClick={() => setExamenSeleccionado(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="summary-section">
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Nombre del Examen</span>
                    <span className="summary-value">{examenSeleccionado.nombre}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Código</span>
                    <span className="summary-value">{examenSeleccionado.codigo}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Fecha Creación</span>
                    <span className="summary-value">{formatFecha(examenSeleccionado.fechaCreacion)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Área / Categoría</span>
                    <span className="summary-value">{examenSeleccionado.categoriaExamenNombre}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Preguntas</span>
                    <span className="summary-value">
                      {examenSeleccionado.cursosUsados ? calcularTotalPreguntas(examenSeleccionado) : '...'} preguntas
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Aleatorización</span>
                    <span className="summary-value">
                      {examenSeleccionado.aleatorizarPreguntas ? 'Aleatorio (Preguntas y Alternativas)' : 'Orden Fijo'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="versions-section">
                <h4>Versiones Generadas ({examenSeleccionado.versiones?.length || examenSeleccionado.cantidadVersiones})</h4>
                {examenSeleccionado.versiones?.map((v) => (
                  <div className="version-item" key={v.id}>
                    <div className="version-info">
                      <div className="version-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="version-details">
                        <p className="version-name">Versión {v.codigoVersion}</p>
                        <p className="version-meta">Generado por sistema</p>
                      </div>
                    </div>
                    <div className="version-actions">
                      <button
                        className="btn-action btn-action-primary"
                        onClick={() => handleVerPreviewA4(examenSeleccionado.id, examenSeleccionado.nombre, v.codigoVersion)}
                      >
                        Vista Previa A4
                      </button>
                      <button
                        className="btn-action btn-action-outline"
                        onClick={() => descargarPdfSolucionario(examenSeleccionado.id, v.codigoVersion)}
                      >
                        Solucionario
                      </button>
                      <button
                        className="btn-action btn-action-outline"
                        onClick={() => descargarPdfVersion(examenSeleccionado.id, v.codigoVersion)}
                      >
                        PDF
                      </button>
                    </div>
                  </div>
                ))}
                {!examenSeleccionado.versiones && !loadingDetalle && (
                  <p>No se encontraron detalles de las versiones.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};