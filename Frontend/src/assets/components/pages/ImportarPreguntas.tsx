import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import './ImportarPreguntas.css';

export const ImportarPreguntas = () => {
  // Referencia al input oculto
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de la interfaz
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');

  // Abre el explorador de archivos al hacer clic en la zona punteada
  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Previene el comportamiento por defecto del navegador
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Captura el archivo soltado
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Captura el archivo seleccionado por el explorador
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  // Lógica de simulación de procesamiento
  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setStatus('processing');

    // Simulamos el tiempo de validación del backend (1.5 segundos)
    setTimeout(() => {
      setStatus('success');
    }, 1500);
  };

  // Función para resetear y volver a subir otro archivo
  const handleReset = () => {
    setFile(null);
    setStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="import-container">
      <div className="upload-card">
        <h2>Importar Banco de Preguntas</h2>
        
        {/* Dropzone */}
        <div 
          className={`dropzone ${isDragging ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p><span className="highlight">Haz clic para buscar</span> o arrastra un archivo aquí</p>
          <p className="subtitle">Formatos soportados: .docx, .pdf, .txt (Máx 10MB)</p>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".docx,.pdf,.txt" 
            className="hidden-input"
          />
        </div>

        {/* Vista previa del archivo */}
        {file && (
          <div className="file-preview">
            <div className="file-info">
              <div>
                <div className="file-name">{file.name}</div>
                <div className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
              </div>
              
              {status === 'processing' ? (
                <div className="status-badge status-processing">Analizando...</div>
              ) : (
                <div className="status-badge status-success">Análisis completado</div>
              )}
            </div>
            
            {status === 'success' && (
              <div className="validation-results">
                <p>✅ 15 Preguntas detectadas correctamente</p>
                <p>❌ 2 Preguntas con formato inválido (sin respuesta)</p>
              </div>
            )}

            <div className="action-buttons">
              <button 
                className="btn-outline" 
                onClick={handleReset}
                disabled={status === 'processing'}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                disabled={status === 'processing'}
              >
                {status === 'processing' ? 'Procesando...' : 'Importar 15 Preguntas Válidas'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};