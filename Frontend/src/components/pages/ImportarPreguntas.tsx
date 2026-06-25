import React, { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import './ImportarPreguntas.css';
import { crearPregunta } from '../../services/preguntaService';
import { listarCursos } from '../../services/cursoService';

// --- Interfaces ---
interface ParsedOption {
  letra: string;
  tipo: string;
  contenidoTexto: string;
  esCorrecta: boolean;
}

interface AnalyzedQuestion {
  id: string;
  text: string;
  isValid: boolean;
  options: string[];
  parsedOptions?: ParsedOption[];
  errorMessage?: string;
}

interface FileData {
  name: string;
  size: string;
  validCount: number;
  errorCount: number;
}

interface Curso {
  id: number;
  nombre: string;
}

export const ImportarPreguntas: React.FC = () => {
  // --- Estados ---
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [questions, setQuestions] = useState<AnalyzedQuestion[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<number | ''>('');
  
  // Referencia para el input file oculto
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Cargar cursos para el selector
    const fetchCursos = async () => {
      try {
        const data = await listarCursos();
        setCursos(data);
        if (data.length > 0) {
          setSelectedCursoId(data[0].id);
        }
      } catch (error) {
        console.error("Error al cargar cursos:", error);
      }
    };
    fetchCursos();
  }, []);

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

  // --- Lógica de Parseo ---
  const parseQuestionsFromText = (text: string): AnalyzedQuestion[] => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const parsedQuestions: AnalyzedQuestion[] = [];
    
    let currentQuestion: any = null;

    lines.forEach(line => {
      // Detect question start: "1. ¿Cuál...?" or just "1. ..."
      if (/^\d+\.\s/.test(line)) {
        if (currentQuestion) {
          parsedQuestions.push(validateAndFormatQuestion(currentQuestion));
        }
        currentQuestion = {
          id: `q-${Date.now()}-${Math.random()}`,
          text: line,
          options: [],
          correctAnswer: null,
        };
      } else if (/^[a-eA-E][).]\s/.test(line)) {
        if (currentQuestion) {
          currentQuestion.options.push(line);
        }
      } else if (/^respuesta:/i.test(line)) {
        if (currentQuestion) {
          const match = line.match(/^respuesta:\s*([a-eA-E])/i);
          if (match) {
            currentQuestion.correctAnswer = match[1].toUpperCase();
          }
        }
      } else {
        // It might be continuation of the question text
        if (currentQuestion && currentQuestion.options.length === 0) {
           currentQuestion.text += '\n' + line;
        }
      }
    });

    if (currentQuestion) {
      parsedQuestions.push(validateAndFormatQuestion(currentQuestion));
    }

    return parsedQuestions;
  };

  const validateAndFormatQuestion = (q: any): AnalyzedQuestion => {
    let isValid = true;
    let errorMessage = '';

    const parsedOptions: ParsedOption[] = [];
    const expectedLetters = ['A', 'B', 'C', 'D', 'E'];
    const displayOptions: string[] = [];

    if (!q.text) {
      isValid = false;
      errorMessage = 'Error: No hay enunciado.';
    } else if (q.options.length !== 5) {
      isValid = false;
      errorMessage = `Error: Tiene ${q.options.length} alternativas en lugar de 5.`;
    } else if (!q.correctAnswer) {
      isValid = false;
      errorMessage = 'Error: No se indicó respuesta correcta.';
    } else {
      // Valid options
      q.options.forEach((opt: string, index: number) => {
        const match = opt.match(/^([a-eA-E])[).]\s*(.*)/);
        let letra = expectedLetters[index];
        let contenido = opt;
        if (match) {
          letra = match[1].toUpperCase();
          contenido = match[2];
        }
        
        const isCorrect = letra === q.correctAnswer;
        parsedOptions.push({
          letra,
          tipo: 'TEXTO',
          contenidoTexto: contenido,
          esCorrecta: isCorrect
        });
        displayOptions.push(`${opt} ${isCorrect ? '(Correcta)' : ''}`);
      });
    }

    if (!isValid && displayOptions.length === 0) {
        displayOptions.push(...q.options);
    }

    return {
      id: q.id,
      text: q.text,
      isValid,
      options: displayOptions,
      parsedOptions,
      errorMessage: isValid ? undefined : errorMessage
    };
  };

  // --- Lógica de Procesamiento ---
  const processFile = (file: File) => {
    // Para esta implementación local simple, solo soportamos .txt
    const validTypes = ['.txt'];
    const fileExtension = file.name.slice((Math.max(0, file.name.lastIndexOf(".")) || Infinity)).toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      alert(`Para la importación local actual solo se soporta archivos ${validTypes.join(', ')}`);
      return;
    }

    if (!selectedCursoId) {
      alert("Por favor, selecciona un curso antes de cargar el archivo.");
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

    setIsAnalyzing(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const analyzedData = parseQuestionsFromText(text);
        
        setQuestions(analyzedData);
        setSelectedFile(prev => prev ? {
          ...prev,
          validCount: analyzedData.filter(q => q.isValid).length,
          errorCount: analyzedData.filter(q => !q.isValid).length
        } : null);
      }
      setIsAnalyzing(false);
    };
    reader.onerror = () => {
      alert("Error al leer el archivo");
      setIsAnalyzing(false);
    };
    reader.readAsText(file);
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setQuestions([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Limpiar el input
    }
  };

  const handleGuardarPreguntas = async () => {
    const validQuestions = questions.filter(q => q.isValid && q.parsedOptions);
    if (validQuestions.length === 0) return;
    if (!selectedCursoId) {
      alert("Selecciona un curso primero.");
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const q of validQuestions) {
      try {
        await crearPregunta({
          enunciado: q.text,
          dificultad: 'MEDIO', // Default por ahora
          activo: true,
          cursoId: Number(selectedCursoId),
          alternativas: q.parsedOptions!
        });
        successCount++;
      } catch (error) {
        console.error('Error al crear la pregunta:', q.text, error);
        errorCount++;
      }
    }

    setIsImporting(false);
    alert(`Importación finalizada. \nÉxito: ${successCount} \nErrores: ${errorCount}`);
    
    if (successCount > 0) {
      handleCancel();
    }
  };

  // --- Renderizado ---
  return (
    <div className="import-container">
      <header className="page-header">
        <h1>Importar Banco de Preguntas</h1>
        <p>Sube tu archivo TXT para analizar y extraer preguntas automáticamente.</p>
      </header>

      {/* El grid cambia dinámicamente si hay archivo o no */}
      <div className={`import-grid ${selectedFile ? 'layout-split' : 'layout-center'}`}>
        
        {/* Columna Izquierda: Carga y Contexto */}
        <aside className="upload-section">
          <div className="panel" style={{ marginBottom: 0, height: '100%' }}>
            
            <div className="curso-selector" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Curso Destino:</label>
              <select 
                value={selectedCursoId} 
                onChange={(e) => setSelectedCursoId(e.target.value ? Number(e.target.value) : '')}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="" disabled>Selecciona un curso</option>
                {cursos.map(curso => (
                  <option key={curso.id} value={curso.id}>{curso.nombre}</option>
                ))}
              </select>
            </div>

            {/* Input oculto para abrir el explorador de archivos */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".txt" 
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
              <div className="dropzone-subtext">Formatos soportados: .txt (Máx 10MB)</div>
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
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.4 }}>
                Asegúrate de incluir las 5 alternativas y marcar la respuesta con "Respuesta: [letra]" al final de cada bloque para una detección precisa.
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
                  <button className="btn btn-secondary" onClick={handleCancel} disabled={isImporting}>Cancelar</button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleGuardarPreguntas} 
                    disabled={isImporting || selectedFile.validCount === 0}
                  >
                    {isImporting ? 'Importando...' : `Guardar ${selectedFile.validCount} Preguntas Válidas`}
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