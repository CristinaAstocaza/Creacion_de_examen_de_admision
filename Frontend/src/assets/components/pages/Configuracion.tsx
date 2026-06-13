import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import './Configuracion.css';

// Interfaces
interface ExamOption {
  id: string;
  code: string;
  area: string;
  date: string;
}

interface ConfigData {
  institutionName: string;
  headerText: string;
  footerText: string;
  instructions: string;
  logoUrl: string | null;
}

export const Configuracion: React.FC = () => {
  // Estado para la selección previa del examen
  const [availableExams, setAvailableExams] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Estado del formulario
  const [formData, setFormData] = useState<ConfigData>({
    institutionName: 'Colegio Nacional Ejemplo',
    headerText: 'Examen de Evaluación',
    footerText: 'Prohibida su reproducción',
    instructions: '',
    logoUrl: null,
  });

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Simular carga de exámenes disponibles desde el Historial
  useEffect(() => {
    // Aquí iría el fetch a tu API: getGeneratedExams()
    setAvailableExams([
      { id: 'ex-001', code: 'EX-MAT-2026', area: 'Matemáticas', date: '12/06/2026' },
      { id: 'ex-002', code: 'EX-COM-2026', area: 'Comunicación', date: '10/06/2026' },
      { id: 'ex-003', code: 'EX-CIE-2026', area: 'Ciencias Naturales', date: '08/06/2026' },
    ]);
  }, []);

  const handleExamSelect = (e: ChangeEvent<HTMLSelectElement>) => {
    const examId = e.target.value;
    setSelectedExamId(examId);
    
    // Al seleccionar un examen, podríamos cargar su configuración guardada previamente
    if (examId) {
      const selectedExam = availableExams.find(ex => ex.id === examId);
      setFormData(prev => ({
        ...prev,
        headerText: `Examen de ${selectedExam?.area || ''}`,
      }));
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, logoUrl: objectUrl }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) return;

    setIsSaving(true);
    // Simulación de guardado ligado al ID del examen
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSaveMessage({ type: 'success', text: 'Configuración aplicada al examen exitosamente.' });
    setIsSaving(false);
  };

  // Derivar el examen seleccionado para mostrar en la UI
  const activeExam = availableExams.find(ex => ex.id === selectedExamId);

  return (
    <div className="config-container">
      <header className="config-header">
        <h1>Configuración de Impresión</h1>
        <p>Selecciona un examen generado para personalizar su formato antes de exportarlo.</p>
      </header>

      {/* PASO 1: Selección Obligatoria */}
      <section className="exam-selector-section panel" style={{ marginBottom: '24px' }}>
        <label htmlFor="examSelect" style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          1. Seleccionar Examen a Configurar
        </label>
        <select 
          id="examSelect" 
          value={selectedExamId} 
          onChange={handleExamSelect}
          className="form-select"
        >
          <option value="">-- Elige un examen del historial --</option>
          {availableExams.map(exam => (
            <option key={exam.id} value={exam.id}>
              {exam.code} - {exam.area} ({exam.date})
            </option>
          ))}
        </select>
      </section>

      {saveMessage && (
        <div className={`alert-message ${saveMessage.type}`}>
          {saveMessage.text}
        </div>
      )}

      {/* PASO 2: Formulario (Bloqueado si no hay selección) */}
      <div className={`config-grid ${!selectedExamId ? 'disabled-section' : ''}`}>
        
        <section className="config-form-section">
          <div className="panel">
            <h2 className="panel-title">2. Personalizar Formato</h2>
            
            <form onSubmit={handleSubmit} className="config-form">
              <fieldset disabled={!selectedExamId} style={{ border: 'none', padding: 0, margin: 0 }}>
                <div className="form-group">
                  <label htmlFor="logoUpload">Logo de la Institución</label>
                  <input type="file" id="logoUpload" accept="image/png, image/jpeg" onChange={handleLogoUpload} className="file-input" />
                </div>

                <div className="form-group">
                  <label htmlFor="institutionName">Nombre de la Institución</label>
                  <input type="text" id="institutionName" name="institutionName" value={formData.institutionName} onChange={handleChange} />
                </div>

                <div className="form-group">
                  <label htmlFor="headerText">Título del Examen</label>
                  <input type="text" id="headerText" name="headerText" value={formData.headerText} onChange={handleChange} />
                </div>

                <div className="form-group">
                  <label htmlFor="instructions">Instrucciones Específicas</label>
                  <textarea id="instructions" name="instructions" value={formData.instructions} onChange={handleChange} rows={3} />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={isSaving || !selectedExamId}>
                    {isSaving ? 'Aplicando...' : 'Aplicar y Guardar'}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </section>

        {/* Vista Previa */}
        <section className="config-preview-section">
          <div className="panel preview-panel">
            <h2 className="panel-title">Vista Previa: {activeExam ? activeExam.code : 'Ninguno'}</h2>
            <div className="a4-preview">
              <div className="a4-content">
                <div className="exam-sim-header">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo" className="exam-sim-logo" />
                  ) : (
                    <div className="exam-sim-logo-placeholder">LOGO</div>
                  )}
                  <div className="exam-sim-titles">
                    <h3>{formData.institutionName || 'Institución'}</h3>
                    <h4>{formData.headerText || 'Título'}</h4>
                  </div>
                </div>

                <div className="exam-sim-student-info">
                  <div className="info-line"><span>Apellidos y Nombres:</span> ____________________________________</div>
                  <div className="info-row">
                    <div className="info-line"><span>Grado:</span> ________</div>
                    <div className="info-line"><span>Fecha:</span> ________</div>
                  </div>
                </div>

                {formData.instructions && (
                  <div className="exam-sim-instructions">
                    <strong>Instrucciones:</strong> {formData.instructions}
                  </div>
                )}

                <div className="exam-sim-body">
                  {!selectedExamId ? (
                    <div style={{ textAlign: 'center', color: '#9aa0a6', marginTop: '40px' }}>
                      Selecciona un examen para previsualizar el contenido.
                    </div>
                  ) : (
                    <div className="sim-question">
                      <p>1. Pregunta de muestra para el área de {activeExam?.area}...</p>
                      <ul>
                        <li>a) Alternativa 1</li>
                        <li>b) Alternativa 2</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              <div className="exam-sim-footer">
                {formData.footerText}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Configuracion;