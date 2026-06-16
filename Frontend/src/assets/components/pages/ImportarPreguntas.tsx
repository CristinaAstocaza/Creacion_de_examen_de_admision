import React, { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import './ImportarPreguntas.css';

// --- Interfaces ---
interface AnalyzedQuestion {
  id: string;
  text: string;
  isValid: boolean;
  options: string[];
  errorMessage?: string;
}

interface FileData {
  name: string;
  size: string;
  validCount: number;
  errorCount: number;
}

export const ImportarPreguntas: React.FC = () => {
  // --- Estados ---
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [questions, setQuestions] = useState<AnalyzedQuestion[]>([]);
  
  // Referencia para el input file oculto
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Manejadores de Eventos (Drag & Drop) ---
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  // --- Manejadores de Eventos (Click manual) ---
  const handleContainerClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // --- Lógica de Procesamiento ---
  const processFile = (file: File) => {
    // Validar extensiones básicas
    const validTypes = ['.docx', '.pdf', '.txt'];
    const fileExtension = file.name.slice((Math.max(0, file.name.lastIndexOf(".")) || Infinity)).toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      alert(`Formato no soportado. Por favor sube un archivo ${validTypes.join(', ')}`);
      return;
    }

    // Convertir bytes a MB
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);

    setSelectedFile({
      name: file.name,
      size: `${sizeInMB} MB`,
      validCount: 0,
      errorCount: 0
    });

    // Simular el tiempo de análisis del backend
    setIsAnalyzing(true);
    
    setTimeout(() => {
      // Data simulada devuelta por tu backend
      const dummyData: AnalyzedQuestion[] = [
        {
          id: 'q1',
          text: '1. ¿Cuál es el resultado de la derivada de x²?',
          isValid: true,
          options: ['a) x', 'b) 2x (Correcta)', 'c) x/2', 'd) 2', 'e) 0']
        },
        {
          id: 'q2',
          text: '2. Resuelva la siguiente ecuación cuadrática: x² - 4 = 0',
          isValid: false,
          options: ['a) 2', 'b) -2', 'c) ±2', 'd) 0'],
          errorMessage: 'Error: Falta la alternativa E y no se indicó respuesta correcta.'
        },
        {
          id: 'q3',
          text: '3. Identifique el ángulo recto en un triángulo rectángulo.',
          isValid: true,
          options: ['a) 45°', 'b) 60°', 'c) 90° (Correcta)', 'd) 180°', 'e) 360°']
        }
      ];

      setQuestions(dummyData);
      setSelectedFile(prev => prev ? {
        ...prev,
        validCount: dummyData.filter(q => q.isValid).length,
        errorCount: dummyData.filter(q => !q.isValid).length
      } : null);
      
      setIsAnalyzing(false);
    }, 1500); // 1.5 segundos de simulación
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setQuestions([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Limpiar el input
    }
  };

  // --- Renderizado ---
  return (
    <div className="import-container">
      <header className="page-header">
        <h1>Importar Banco de Preguntas</h1>
        <p>Sube tus archivos DOCX, PDF o TXT para analizar y extraer preguntas automáticamente.</p>
      </header>

      {/* El grid cambia dinámicamente si hay archivo o no */}
      <div className={`import-grid ${selectedFile ? 'layout-split' : 'layout-center'}`}>
        
        {/* Columna Izquierda: Carga y Contexto */}
        <aside className="upload-section">
          <div className="panel" style={{ marginBottom: 0, height: '100%' }}>
            
            {/* Input oculto para abrir el explorador de archivos */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".docx, .pdf, .txt" 
              style={{ display: 'none' }} 
            />

            <div 
              className={`dropzone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'compact' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleContainerClick}
            >
              <div className="dropzone-icon">☁️</div>
              <div className="dropzone-text"><span>Haz clic para buscar</span> o arrastra un archivo aquí</div>
              <div className="dropzone-subtext">Formatos soportados: .docx, .pdf, .txt (Máx 10MB)</div>
            </div>

            <div className="format-guide">
              <h3>Estructura Recomendada</h3>
              <div className="guide-code">
                1. ¿Cuál es la capital de Perú?<br/>
                a) Lima<br/>
                b) Cusco<br/>
                c) Arequipa<br/>
                d) Trujillo<br/>
                e) Piura<br/>
                Respuesta: a
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.4 }}>
                Asegúrate de incluir las 5 alternativas y marcar la respuesta correcta al final de cada bloque para una detección precisa.
              </p>
            </div>
          </div>
        </aside>

        {/* Columna Derecha: Vista Previa (Solo renderiza si hay archivo seleccionado) */}
        {selectedFile && (
          <section className="preview-section panel fade-in">
            <h2 className="panel-title">
              Vista Previa y Análisis
              <span className="step-badge">Paso 2 de 2</span>
            </h2>

            {isAnalyzing ? (
              <div className="analyzing-state">
                <div className="spinner"></div>
                <p>Analizando documento, extrayendo preguntas y validando alternativas...</p>
              </div>
            ) : (
              <>
                <div className="analysis-status">
                  <div className="file-icon">📄</div>
                  <div className="file-details">
                    <div className="file-name">{selectedFile.name}</div>
                    <div className="file-meta">{selectedFile.size} • Análisis completado</div>
                  </div>
                  <div className="analysis-summary">
                    {selectedFile.validCount} Válidas • <span className="error-text">{selectedFile.errorCount} Errores</span>
                  </div>
                </div>

                <div className="preview-list">
                  {questions.map((q) => (
                    <div key={q.id} className={`preview-item ${!q.isValid ? 'error' : ''}`}>
                      <div className={`status-icon ${q.isValid ? 'success' : 'error'}`}>
                        {q.isValid ? '✅' : '⚠️'}
                      </div>
                      <div className="question-content">
                        <div className="q-text">{q.text}</div>
                        <div className="q-options">
                          {q.options.map((opt, idx) => (
                            <div key={idx}>{opt}</div>
                          ))}
                        </div>
                        {!q.isValid && <div className="q-error-msg">{q.errorMessage}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botonera con márgenes y tamaños estrictamente iguales */}
                <div className="action-footer">
                  <button className="btn btn-secondary" onClick={handleCancel}>Cancelar</button>
                  <button className="btn btn-primary">
                    Importar {selectedFile.validCount} preguntas válidas
                  </button>
                </div>
              </>
            )}
          </section>
        )}

      </div>
    </div>
  );
};

export default ImportarPreguntas;