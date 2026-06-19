import { useState, useEffect, type MouseEvent } from 'react';
import './HistorialExamenes.css';
import {
  listarExamenes,
  obtenerExamen,
  obtenerVersionExamen,
  descargarPdfVersion,
  descargarPdfSolucionario,
  descargarPdfsVersiones
} from '../../../services/examenService';


// Definición de tipos para asegurar robustez en TypeScript
interface Version {
  id: number;
  letraVersion: string;
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

  const [examenSeleccionado, setExamenSeleccionado] = useState<Examen | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState<boolean>(false);

  const [vistaActiva, setVistaActiva] = useState<'tabla' | 'previsualizacion'>('tabla');
  const [versionActivaNombre, setVersionActivaNombre] = useState<string>('');
  const [versionData, setVersionData] = useState<any>(null);
  const [loadingVersion, setLoadingVersion] = useState<boolean>(false);

  useEffect(() => {
    cargarExamenes();
  }, []);

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
      // Abrimos el modal con data básica primero para que se vea rápido
      setExamenSeleccionado(exam);
      // Luego traemos la data completa (versiones, cursos)
      const dataCompleta = await obtenerExamen(exam.id);
      setExamenSeleccionado(dataCompleta);
    } catch (err) {
      console.error('Error al obtener detalle del examen:', err);
      alert('Error al cargar los detalles del examen');
    } finally {
      setLoadingDetalle(false);
    }
  };

  // Bloqueo de seguridad para la vista A4
  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Ir a la vista previa A4 desde el modal
  const handleVerPreviewA4 = async (examenId: number, examenNombre: string, versionLetra: string) => {
    setVersionActivaNombre(`${examenNombre} - Versión ${versionLetra}`);
    setVistaActiva('previsualizacion'); // Cambiamos vista inmediatamente
    setExamenSeleccionado(null); // Cerramos modal

    try {
      setLoadingVersion(true);
      const data = await obtenerVersionExamen(examenId, versionLetra);
      setVersionData(data);
    } catch (err) {
      console.error('Error al cargar la versión del examen:', err);
      alert('Error al cargar la vista previa de esta versión.');
      setVistaActiva('tabla');
    } finally {
      setLoadingVersion(false);
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

  // Renderizado de la Vista Previa A4 (Reglas de seguridad incluidas)
  if (vistaActiva === 'previsualizacion') {
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
                onClick={() => descargarPdfVersion(versionData.examenId, versionData.letraVersion)}
              >
                Descargar PDF
              </button>
            )}
          </div>
        </div>

        <div className="a4-wrapper" onContextMenu={handleContextMenu}>
          <div className="a4-sheet">
            <header className="exam-header">
              <h1 className="institution-name">Sistema de Gestión de Exámenes</h1>
              <h2 className="exam-title">{versionActivaNombre}</h2>
              <div className="student-info">
                <div>Apellidos y Nombres: _____________________________________________</div>
                <div>Código: _________________</div>
              </div>
            </header>

            <div className="exam-instructions">
              <strong>INSTRUCCIONES GENERALES:</strong><br />
              1. Lea detenidamente cada una de las preguntas antes de responder.<br />
              2. No se permiten borrones ni enmendaduras. Prohibido el uso de dispositivos electrónicos.
            </div>

            {loadingVersion ? (
              <p style={{ textAlign: 'center', marginTop: '20px' }}>Cargando preguntas de la versión...</p>
            ) : versionData && versionData.preguntas ? (
              <div className="questions-list">
                {versionData.preguntas.map((p: any, idx: number) => (
                  <div className="question-item" key={p.id || idx}>
                    <p className="question-text">
                      <strong>{idx + 1}.</strong> {p.enunciado}
                    </p>
                    <ul className="options-list">
                      {p.alternativas?.map((alt: any) => (
                        <li key={alt.id}>
                          {alt.letra}) {alt.contenidoTexto}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', marginTop: '20px' }}>No hay datos disponibles para esta versión.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Renderizado Principal: Tabla e Historial
  return (
    <div className="historial-container">
      <h2>Historial de Exámenes</h2>

      <div className="header-filters-section">
        <div className="filters-group">
          <div className="input-control">
            <label>Buscar por código</label>
            <input type="text" placeholder="Ej. EXM-2026..." />
          </div>
          <div className="input-control">
            <label>Filtrar por Área</label>
            <select>
              <option>Todas las áreas</option>
              {/* Aquí se podrían mapear dinámicamente si fuera necesario */}
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <p style={{ padding: '20px', textAlign: 'center' }}>Cargando exámenes...</p>
        ) : error ? (
          <p style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</p>
        ) : examenes.length === 0 ? (
          <p style={{ padding: '20px', textAlign: 'center' }}>No hay exámenes generados aún.</p>
        ) : (
          <table>
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
              {examenes.map((exam) => (
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
                      onClick={() => descargarPdfsVersiones(exam.id)}
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

      {/* MODAL DETALLE DE VERSIONES (Renderizado Condicional) */}
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
                        <p className="version-name">Versión {v.letraVersion}</p>
                        <p className="version-meta">Generado por sistema</p>
                      </div>
                    </div>
                    <div className="version-actions">
                      <button
                        className="btn-action btn-action-primary"
                        onClick={() => handleVerPreviewA4(examenSeleccionado.id, examenSeleccionado.nombre, v.letraVersion)}
                      >
                        Vista Previa A4
                      </button>
                      <button
                        className="btn-action btn-action-outline"
                        onClick={() => descargarPdfSolucionario(examenSeleccionado.id, v.letraVersion)}
                      >
                        Solucionario
                      </button>
                      <button
                        className="btn-action btn-action-outline"
                        onClick={() => descargarPdfVersion(examenSeleccionado.id, v.letraVersion)}
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