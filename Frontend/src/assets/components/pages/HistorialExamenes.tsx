import { useState, type MouseEvent } from 'react';
import './HistorialExamenes.css';

// Definición de tipos para asegurar robustez en TypeScript
interface Version {
  id: string;
  nombre: string;
  preguntas: number;
  detalles: string;
}

interface Examen {
  id: string;
  codigo: string;
  fecha: string;
  nombre: string;
  areas: string[];
  totalPreguntas: number;
  versionesCount: number;
  configuracion: string;
  versiones: Version[];
}

// Data simulada estructurada
const dataExamenes: Examen[] = [
  {
    id: '1',
    codigo: 'EXM-1045',
    fecha: '13 Jun 2026',
    nombre: 'Examen de Admisión 2026-I',
    areas: ['Matemáticas', 'Comunicación'],
    totalPreguntas: 100,
    versionesCount: 2,
    configuracion: 'Aleatorio (Preguntas y Alternativas)',
    versiones: [
      { id: 'v1', nombre: 'Versión A', preguntas: 100, detalles: '100 preguntas' },
      { id: 'v2', nombre: 'Versión B', preguntas: 100, detalles: '100 preguntas (Aleatorio)' }
    ]
  },
  {
    id: '2',
    codigo: 'EXM-1044',
    fecha: '10 Jun 2026',
    nombre: 'Simulacro Ciencias',
    areas: ['Ciencias'],
    totalPreguntas: 50,
    versionesCount: 1,
    configuracion: 'Orden Fijo',
    versiones: [
      { id: 'v3', nombre: 'Versión Única', preguntas: 50, detalles: '50 preguntas de ciencias' }
    ]
  }
];

export const HistorialExamenes = () => {
  const [examenes] = useState<Examen[]>(dataExamenes);
  const [examenSeleccionado, setExamenSeleccionado] = useState<Examen | null>(null);
  const [vistaActiva, setVistaActiva] = useState<'tabla' | 'previsualizacion'>('tabla');
  const [versionActiva, setVersionActiva] = useState<string>('');

  // Bloqueo de seguridad para la vista A4
  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Ir a la vista previa A4 desde el modal
  const handleVerPreviewA4 = (examenNombre: string, versionName: string) => {
    setVersionActiva(`${examenNombre} - ${versionName}`);
    setExamenSeleccionado(null); // Cerramos modal
    setVistaActiva('previsualizacion'); // Cambiamos vista
  };

  // Renderizado de la Vista Previa A4 (Reglas de seguridad incluidas)
  if (vistaActiva === 'previsualizacion') {
    return (
      <div className="preview-container">
        <div className="preview-toolbar">
          <div>
            <h2>Vista Previa del Examen</h2>
            <p style={{ margin: '4px 0 0 0', color: '#5f6368', fontSize: '0.9rem' }}>{versionActiva}</p>
          </div>
          <div className="toolbar-actions">
            <button className="btn btn-outline" onClick={() => setVistaActiva('tabla')}>
              Volver al Historial
            </button>
            <button className="btn btn-primary" onClick={() => alert('Descargando PDF de examen y solucionario por separado...')}>
              Descargar PDF
            </button>
          </div>
        </div>

        <div className="a4-wrapper" onContextMenu={handleContextMenu}>
          <div className="a4-sheet">
            <header className="exam-header">
              <h1 className="institution-name">Sistema de Gestión de Exámenes</h1>
              <h2 className="exam-title">{versionActiva}</h2>
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

            <div className="questions-list">
              <div className="question-item">
                <p className="question-text">
                  <strong>1.</strong> En el contexto de UI, ¿cuál es el propósito principal de un wireframe de baja fidelidad?
                </p>
                <ul className="options-list">
                  <li>A) Definir la paleta de colores y la tipografía final.</li>
                  <li>B) Establecer la estructura visual y la jerarquía sin distracciones estéticas.</li>
                  <li>C) Escribir el código HTML y CSS base.</li>
                  <li>D) Exportar los recursos gráficos en alta resolución.</li>
                  <li>E) Configurar las animaciones del sitio.</li>
                </ul>
              </div>

              <div className="question-item">
                <p className="question-text">
                  <strong>2.</strong> En React, ¿qué hook se emplea específicamente para ejecutar efectos secundarios tras el renderizado?
                </p>
                <ul className="options-list">
                  <li>A) useState</li>
                  <li>B) useRef</li>
                  <li>C) useEffect</li>
                  <li>D) useMemo</li>
                  <li>E) useContext</li>
                </ul>
              </div>
            </div>
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
              <option>Matemáticas</option>
              <option>Comunicación</option>
              <option>Ciencias</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Nombre del Examen</th>
              <th>Áres Incluidas</th>
              <th>Preguntas</th>
              <th>Vers.</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {examenes.map((exam) => (
              <tr key={exam.id}>
                <td className="exam-code">{exam.codigo}</td>
                <td>{exam.fecha}</td>
                <td>{exam.nombre}</td>
                <td>
                  <div className="chip-container">
                    {exam.areas.map((area, idx) => (
                      <span key={idx} className="chip">{area}</span>
                    ))}
                  </div>
                </td>
                <td>{exam.totalPreguntas}</td>
                <td>{exam.versionesCount}</td>
                <td className="action-cell">
                  <button 
                    className="btn-icon" 
                    title="Ver detalle de versiones"
                    onClick={() => setExamenSeleccionado(exam)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button className="btn-icon" title="Descargar directo" onClick={() => alert('Generando descarga rápida del paquete de versiones...')}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DETALLE DE VERSIONES (Renderizado Condicional) */}
      {examenSeleccionado && (
        <div className="modal-overlay" onClick={() => setExamenSeleccionado(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <h3>Detalle del Examen</h3>
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
                    <span className="summary-value">{examenSeleccionado.fecha}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Áreas Evaluadas</span>
                    <span className="summary-value">{examenSeleccionado.areas.join(', ')}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Preguntas</span>
                    <span className="summary-value">{examenSeleccionado.totalPreguntas} preguntas</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Aleatorización</span>
                    <span className="summary-value">{examenSeleccionado.configuracion}</span>
                  </div>
                </div>
              </div>

              <div className="versions-section">
                <h4>Versiones Generadas ({examenSeleccionado.versiones.length})</h4>
                {examenSeleccionado.versiones.map((v) => (
                  <div className="version-item" key={v.id}>
                    <div className="version-info">
                      <div className="version-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="version-details">
                        <p className="version-name">{v.nombre}</p>
                        <p className="version-meta">{v.detalles}</p>
                      </div>
                    </div>
                    <div className="version-actions">
                      <button 
                        className="btn-action btn-action-primary"
                        onClick={() => handleVerPreviewA4(examenSeleccionado.nombre, v.nombre)}
                      >
                        Vista Previa A4
                      </button>
                      <button className="btn-action btn-action-outline" onClick={() => alert('Abriendo Solucionario Protegido...')}>
                        Solucionario
                      </button>
                      <button className="btn-action btn-action-outline" onClick={() => alert('Exportando a PDF...')}>
                        PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};