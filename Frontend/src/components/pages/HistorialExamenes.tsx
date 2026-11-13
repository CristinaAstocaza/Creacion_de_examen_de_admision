import { useState, useEffect } from 'react';
import './HistorialExamenes.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  listarExamenes,
  obtenerExamen,
  obtenerPdfVersionUrl,
  descargarPdfVersion,
  descargarPdfsVersiones,
  cambiarTemaVersion
} from '../../services/examenService';
import { listarCategorias } from '../../services/categoriaService';
import { toast } from '../ui/toast';

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
  categoriaExamenId?: number;
  categoriaExamenNombre: string;
  cantidadVersiones: number;
  aleatorizarPreguntas: boolean;
  versiones?: Version[];
  cursosUsados?: ExamenCursoUsado[];
  tipoPrueba?: string | null;
  formatoHoja?: 'A4' | 'OFICIO';
}

export const HistorialExamenes = () => {
  const [examenes, setExamenes] = useState<Examen[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filtroCodigo, setFiltroCodigo] = useState<string>('');
  const [filtroArea, setFiltroArea] = useState<string>('');
  const [categorias, setCategorias] = useState<any[]>([]);

  const [examenSeleccionado, setExamenSeleccionado] = useState<Examen | null>(null);
  // Edición de la letra (tema) de una versión ya generada
  const [temaEditando, setTemaEditando] = useState<{ versionId: number; actual: string; valor: string } | null>(null);
  const [guardandoTema, setGuardandoTema] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState<boolean>(false);

  const [vistaActiva, setVistaActiva] = useState<'tabla' | 'previsualizacion'>('tabla');
  const [versionActivaNombre, setVersionActivaNombre] = useState<string>('');
  const [versionActiva, setVersionActiva] = useState<{ examenId: number; codigoVersion: string; nombre: string } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingVersion, setLoadingVersion] = useState<boolean>(false);
  const [errorPreview, setErrorPreview] = useState<string | null>(null);

  // Libera el PDF anterior de memoria cuando cambia o se sale de la vista previa.
  useEffect(() => {
    return () => {
      if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

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
      toast.error('Error al cargar el historial de exámenes.');
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
      toast.error('Error al cargar los detalles del examen');
    } finally {
      setLoadingDetalle(false);
    }
  };

  /** Área y modalidad del examen: definen qué carátula de Configuración se aplica al PDF. */
  const metaExamen = (examenId: number) => examenes.find((e) => e.id === examenId);

  const handleVerPreviewA4 = async (examenId: number, examenNombre: string, versionLetra: string) => {
    setVersionActivaNombre(`${examenNombre} - Versión ${versionLetra}`);
    setVersionActiva({ examenId, codigoVersion: versionLetra, nombre: examenNombre });
    setVistaActiva('previsualizacion');
    setExamenSeleccionado(null);
    setPdfUrl(null);
    setErrorPreview(null);

    try {
      setLoadingVersion(true);
      setPdfUrl(await obtenerPdfVersionUrl(examenId, versionLetra, metaExamen(examenId)));
    } catch (err) {
      console.error('Error al generar la vista previa del examen:', err);
      setErrorPreview('No se pudo generar la vista previa de esta versión.');
    } finally {
      setLoadingVersion(false);
    }
  };

  const cerrarPreview = () => {
    setVistaActiva('tabla');
    setPdfUrl(null);
    setVersionActiva(null);
  };

  const handleDescargarPdf = async (examenId: number, version: string, nombre: string) => {
    try {
      await descargarPdfVersion(examenId, version, nombre, metaExamen(examenId));
      toast.success('PDF descargado correctamente.');
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      toast.error('No se pudo descargar el PDF. Revisa que el backend esté corriendo y vuelve a intentarlo.');
    }
  };

  const guardarTema = async () => {
    if (!examenSeleccionado || !temaEditando) return;
    const nuevo = temaEditando.valor.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,5}$/.test(nuevo)) {
      toast.error('El tema debe tener de 1 a 5 letras o números, sin espacios.');
      return;
    }
    if (nuevo === temaEditando.actual) {
      setTemaEditando(null);
      return;
    }
    try {
      setGuardandoTema(true);
      const actualizado = await cambiarTemaVersion(examenSeleccionado.id, temaEditando.actual, nuevo);
      setExamenSeleccionado(actualizado);
      setTemaEditando(null);
      toast.success(`Tema cambiado a "${nuevo}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el tema.');
    } finally {
      setGuardandoTema(false);
    }
  };

  const handleDescargarZip = async (examenId: number) => {
    const exam = examenes.find((e) => e.id === examenId);
    const customName = exam ? exam.nombre : '';
    try {
      await descargarPdfsVersiones(examenId, customName, exam);
      toast.success('Paquete ZIP descargado correctamente.');
    } catch (err) {
      console.error('Error al descargar ZIP:', err);
      toast.error('Hubo un error al intentar descargar el paquete ZIP de versiones.');
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

  // Vista previa: se muestra el PDF real generado por el backend (idéntico a la descarga).
  if (vistaActiva === 'previsualizacion') {
    return (
      <div className="preview-container">
        <div className="preview-toolbar">
          <div>
            <h2>Vista Previa del Examen</h2>
            <p style={{ margin: '4px 0 0 0', color: '#5f6368', fontSize: '0.9rem' }}>{versionActivaNombre}</p>
          </div>
          <div className="toolbar-actions">
            <button className="btn btn-outline" onClick={cerrarPreview}>
              Volver al Historial
            </button>
            {versionActiva && (
              <button
                className="btn btn-primary"
                disabled={loadingVersion}
                onClick={() => handleDescargarPdf(versionActiva.examenId, versionActiva.codigoVersion, versionActiva.nombre)}
              >
                Descargar PDF
              </button>
            )}
          </div>
        </div>

        <div className="pdf-preview-frame-wrapper">
          {loadingVersion ? (
            <div className="pdf-preview-status">
              <div className="pdf-preview-spinner" />
              <p>Generando PDF de la versión...</p>
            </div>
          ) : errorPreview ? (
            <div className="pdf-preview-status error">
              <p>{errorPreview}</p>
              {versionActiva && (
                <button
                  className="btn btn-outline"
                  onClick={() => handleVerPreviewA4(versionActiva.examenId, versionActiva.nombre, versionActiva.codigoVersion)}
                >
                  Reintentar
                </button>
              )}
            </div>
          ) : pdfUrl ? (
            <iframe
              className="pdf-preview-frame"
              src={`${pdfUrl}#view=FitH&toolbar=1`}
              title={`Vista previa ${versionActivaNombre}`}
            />
          ) : null}
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
                    <span className="summary-label">Tipo de prueba</span>
                    <span className="summary-value">{examenSeleccionado.tipoPrueba || 'Admisión ordinaria'}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Formato de hoja</span>
                    <span className="summary-value">{examenSeleccionado.formatoHoja === 'OFICIO' ? 'Oficio (216 × 330 mm)' : 'A4 (210 × 297 mm)'}</span>
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
                        {temaEditando?.versionId === v.id ? (
                          <div className="tema-edit">
                            <span className="version-name">Tema</span>
                            <input
                              className="tema-edit-input"
                              value={temaEditando.valor}
                              maxLength={5}
                              autoFocus
                              disabled={guardandoTema}
                              onChange={(e) => setTemaEditando({ ...temaEditando, valor: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') guardarTema();
                                if (e.key === 'Escape') setTemaEditando(null);
                              }}
                              aria-label="Nueva letra de tema"
                            />
                            <button className="btn-action btn-action-primary" onClick={guardarTema} disabled={guardandoTema}>
                              {guardandoTema ? '...' : 'Guardar'}
                            </button>
                            <button className="btn-action btn-action-outline" onClick={() => setTemaEditando(null)} disabled={guardandoTema}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="version-name">
                              Tema {v.codigoVersion}
                              <button
                                className="tema-edit-btn"
                                title="Cambiar la letra de esta versión"
                                onClick={() => setTemaEditando({ versionId: v.id, actual: v.codigoVersion, valor: v.codigoVersion })}
                              >
                                Cambiar letra
                              </button>
                            </p>
                            <p className="version-meta">Archivo: {examenSeleccionado.nombre} - Version {v.codigoVersion}.pdf</p>
                          </>
                        )}
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
                        onClick={() => handleDescargarPdf(examenSeleccionado.id, v.codigoVersion, examenSeleccionado.nombre)}
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