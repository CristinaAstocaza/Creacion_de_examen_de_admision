import React, { useState, type ChangeEvent, type FormEvent, useEffect } from 'react';
import './Configuracion.css';
import { listarCategorias } from '../../services/categoriaService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';


interface CategoriaExamen {
  id: number;
  nombre: string;
}

interface ConfigData {
  institutionName: string;
  headerText: string;
  footerText: string;
  instructions: string;
  logoUrl: string | null;
  modalidad: string;
  colorPortada: string;
}

export const Configuracion: React.FC = () => {
  const [categorias, setCategorias] = useState<CategoriaExamen[]>([]);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number | ''>('');

  const [formData, setFormData] = useState<ConfigData>({
    institutionName: 'UNIVERSIDAD NACIONAL',
    headerText: 'EXAMEN DE ADMISIÓN 2025',
    footerText: '',
    instructions: 'Lea cuidadosamente cada pregunta y marque solo una alternativa.',
    logoUrl: null,
    modalidad: 'MODALIDAD ORDINARIO',
    colorPortada: '#6366f1',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const loadInitials = async () => {
      try {
        const catData = await listarCategorias();
        setCategorias(catData);
      } catch (err) {
        console.error(err);
      }
    };
    loadInitials();

    // Cargar formato
    const savedConfig = localStorage.getItem('configuracionExamen');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Error parsing saved config', e);
      }
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearLogo = () => {
    setFormData(prev => ({ ...prev, logoUrl: null }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCategoriaId) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Guardar Formato
      localStorage.setItem('configuracionExamen', JSON.stringify(formData));
      setSaveMessage({ type: 'success', text: 'Configuración aplicada y guardada exitosamente.' });
    } catch (err) {
      console.error(err);
      setSaveMessage({ type: 'error', text: 'Hubo un error al guardar la configuración.' });
    } finally {
      setIsSaving(false);
    }
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

  const previewTextColor = getContrastColor(formData.colorPortada);
  const activeCat = categorias.find(c => c.id === selectedCategoriaId);

  return (
    <div className="config-container">
      <header className="config-header">
        <h1>Configuración del Examen</h1>
        <p>Personaliza el diseño, logotipo, colores e instrucciones de la carátula oficial para los exámenes generados.</p>
      </header>

      {/* Selección Obligatoria */}
      <section className="exam-selector-section panel" style={{ marginBottom: '24px' }}>
        <label htmlFor="catSelect" style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          Seleccionar Categoría
        </label>
        <Select 
          value={selectedCategoriaId === '' ? '' : String(selectedCategoriaId)}
          onValueChange={(value) => setSelectedCategoriaId(value ? Number(value) : '')}
        >
          <SelectTrigger id="catSelect" className="w-full">
            <SelectValue placeholder="-- Elige una categoría --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">-- Elige una categoría --</SelectItem>
            {categorias.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)}>
                {cat.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {saveMessage && (
        <div className={`alert-message ${saveMessage.type}`}>
          {saveMessage.text}
        </div>
      )}

      <div className={`config-grid ${!selectedCategoriaId ? 'disabled-section' : ''}`}>
        <section className="config-form-section">
          {/* Formato */}
          <div className="panel">
            <h2 className="panel-title">Personalizar Formato</h2>
            <form onSubmit={handleSubmit} className="config-form">
              <fieldset disabled={!selectedCategoriaId} style={{ border: 'none', padding: 0, margin: 0 }}>
                <div className="form-group">
                  <label htmlFor="institutionName">Nombre de la Institución</label>
                  <input type="text" id="institutionName" name="institutionName" value={formData.institutionName} onChange={handleChange} />
                </div>

                <div className="form-group">
                  <label>Logo de la Institución</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    {formData.logoUrl ? (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img src={formData.logoUrl} alt="Logo preview" style={{ height: '48px', width: '48px', objectFit: 'contain', border: '1px solid #dadce0', borderRadius: '4px', padding: '2px', backgroundColor: '#f8f9fa' }} />
                        <button type="button" onClick={handleClearLogo} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ea4335', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Eliminar Logo">×</button>
                      </div>
                    ) : (
                      <div style={{ height: '48px', width: '48px', border: '1px dashed #dadce0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#70757a', backgroundColor: '#f8f9fa' }}>Sin logo</div>
                    )}
                    <label className="btn-secondary" style={{ padding: '8px 12px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', backgroundColor: 'white', display: 'inline-block', fontWeight: 500 }}>
                      Subir Imagen
                      <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="headerText">Título del Examen</label>
                  <input type="text" id="headerText" name="headerText" value={formData.headerText} onChange={handleChange} placeholder="Ej. EXAMEN DE ADMISIÓN" />
                </div>

                <div className="form-group">
                  <label htmlFor="modalidad">Modalidad</label>
                  <input type="text" id="modalidad" name="modalidad" value={formData.modalidad} onChange={handleChange} placeholder="Ej. MODALIDAD ORDINARIO" />
                </div>

                <div className="form-group">
                  <label htmlFor="colorPortada">Color de Portada</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {[
                      { color: '#6366f1', label: 'Índigo' },
                      { color: '#ec4899', label: 'Rosa' },
                      { color: '#0ea5e9', label: 'Azul' },
                      { color: '#10b981', label: 'Verde' },
                      { color: '#f59e0b', label: 'Ámbar' },
                      { color: '#ef4444', label: 'Rojo' },
                      { color: '#1e293b', label: 'Oscuro' },
                    ].map(({ color, label }) => (
                      <button
                        key={color}
                        type="button"
                        title={label}
                        onClick={() => setFormData(prev => ({ ...prev, colorPortada: color }))}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: color,
                          border: formData.colorPortada === color ? '2px solid #1e293b' : '2px solid transparent',
                          cursor: 'pointer',
                          outline: formData.colorPortada === color ? '2px solid white' : 'none',
                        }}
                      />
                    ))}
                    <input type="color" id="colorPortada" name="colorPortada" value={formData.colorPortada} onChange={handleChange} style={{ width: '32px', height: '28px', padding: '0', cursor: 'pointer', border: '1px solid #dadce0', borderRadius: '4px' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="instructions">Instrucciones Específicas</label>
                  <textarea id="instructions" name="instructions" value={formData.instructions} onChange={handleChange} rows={3} />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={isSaving || !selectedCategoriaId}>
                    {isSaving ? 'Guardando...' : 'Aplicar y Guardar'}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </section>

        {/* Vista Previa */}
        <section className="config-preview-section">
          <div className="panel preview-panel">
            <h2 className="panel-title">Vista Previa: {activeCat ? activeCat.nombre : 'Ninguna'}</h2>
            <div className="a4-preview" style={{ backgroundColor: formData.colorPortada, color: previewTextColor, transition: 'background-color 0.3s' }}>
              {!selectedCategoriaId ? (
                <div style={{ textAlign: 'center', opacity: 0.7, marginTop: '40px' }}>
                  Selecciona una categoría para previsualizar la carátula.
                </div>
              ) : (
                <div className="cover-preview-content">
                  <div className="cover-institution">
                    {formData.institutionName || 'UNIVERSIDAD'}
                  </div>
                  
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo" className="cover-logo" />
                  ) : (
                    <div className="cover-logo-placeholder" style={{ borderColor: previewTextColor }}>LOGO</div>
                  )}
                  
                  <div className="cover-title">
                    {formData.headerText || 'EXAMEN DE ADMISIÓN'}
                  </div>

                  <div className="cover-modality">
                    {formData.modalidad || 'MODALIDAD'}
                  </div>

                  <div className="cover-theme-section" style={{ borderColor: previewTextColor }}>
                    <div className="cover-theme-label">TEMA</div>
                    <div className="cover-theme-letter">A</div>
                    <div className="cover-theme-hint">(Se genera automáticamente en el PDF)</div>
                  </div>

                  <div className="cover-instructions" style={{ borderColor: previewTextColor }}>
                    <strong>Instrucciones:</strong> {formData.instructions || 'Sin instrucciones adicionales.'}
                  </div>
                  
                  {formData.footerText && (
                    <div className="cover-footer-text">
                      {formData.footerText}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Configuracion;