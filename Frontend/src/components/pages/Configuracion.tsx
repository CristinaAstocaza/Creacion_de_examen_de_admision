import React, { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import './Configuracion.css';
import CustomSelect from '../ui/CustomSelect';
import { PortadaPreview, PortadaMiniatura } from '../ui/PortadaPreview';
import { listarCategorias } from '../../services/categoriaService';
import { toast } from '../ui/toast';
import { confirmar } from '../ui/confirm';
import { TIPOS_PRUEBA } from '../../utils/estructuraExamen';
import {
  type Caratula,
  listarCaratulas,
  obtenerCaratula,
  guardarCaratula,
  eliminarCaratula,
  leerCaratulaLegacy,
  nombreModalidad,
  textoModalidadSugerido,
  COLOR_PORTADA_DEFECTO,
} from '../../utils/caratulas';

interface CategoriaExamen {
  id: number;
  nombre: string;
}

type FormCaratula = Pick<Caratula,
  'institutionName' | 'headerText' | 'modalidad' | 'footerText' | 'instructions' | 'logoUrl' | 'temaLetra' | 'colorPortada'>;

type Vista = 'editor' | 'galeria';

const COLORES = [
  { color: '#ffffff', label: 'Blanco' },
  { color: '#6366f1', label: 'Índigo' },
  { color: '#ec4899', label: 'Rosa' },
  { color: '#0ea5e9', label: 'Azul' },
  { color: '#10b981', label: 'Verde' },
  { color: '#f59e0b', label: 'Ámbar' },
  { color: '#ef4444', label: 'Rojo' },
  { color: '#1e293b', label: 'Oscuro' },
];

/** Carátula nueva: textos base (los de la configuración anterior si existían) y fondo blanco. */
const formNuevo = (modalidadId = ''): FormCaratula => {
  const legacy = leerCaratulaLegacy();
  return {
    institutionName: legacy.institutionName || 'UNIVERSIDAD NACIONAL',
    headerText: legacy.headerText || 'EXAMEN DE ADMISIÓN 2025',
    modalidad: modalidadId ? textoModalidadSugerido(modalidadId) : '',
    footerText: legacy.footerText || '',
    instructions: legacy.instructions || 'Lea cuidadosamente cada pregunta y marque solo una alternativa.',
    logoUrl: legacy.logoUrl ?? null,
    temaLetra: legacy.temaLetra || 'A',
    colorPortada: COLOR_PORTADA_DEFECTO,
  };
};

const aForm = (c: Caratula): FormCaratula => ({
  institutionName: c.institutionName,
  headerText: c.headerText,
  modalidad: c.modalidad,
  footerText: c.footerText,
  instructions: c.instructions,
  logoUrl: c.logoUrl,
  temaLetra: c.temaLetra,
  colorPortada: c.colorPortada,
});

const ordenModalidad = (id: string) => {
  const i = TIPOS_PRUEBA.findIndex((t) => t.id === id);
  return i === -1 ? 99 : i;
};

export const Configuracion: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [vista, setVista] = useState<Vista>('editor');
  const [categorias, setCategorias] = useState<CategoriaExamen[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | ''>(() => Number(searchParams.get('categoria')) || '');
  const [modalidadId, setModalidadId] = useState<string>(() => searchParams.get('modalidad') || '');
  const [guardadas, setGuardadas] = useState<Caratula[]>(() => listarCaratulas());
  const [formData, setFormData] = useState<FormCaratula>(() => {
    // Viene desde Generar Exámenes con ?categoria=&modalidad=
    const cat = Number(searchParams.get('categoria'));
    const mod = searchParams.get('modalidad') || '';
    const guardada = cat && mod ? obtenerCaratula(cat, mod) : null;
    return guardada ? aForm(guardada) : formNuevo(mod);
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    listarCategorias()
      .then((data: CategoriaExamen[]) => setCategorias(data))
      .catch(() => toast.error('No se pudieron cargar las áreas.'));
  }, []);

  const seleccionCompleta = Boolean(categoriaId && modalidadId);
  const existente = useMemo(
    () => guardadas.find((c) => c.categoriaId === categoriaId && c.modalidadId === modalidadId) ?? null,
    [guardadas, categoriaId, modalidadId],
  );
  const nombreArea = (id: number | '') => categorias.find((c) => c.id === id)?.nombre
    ?? guardadas.find((c) => c.categoriaId === id)?.categoriaNombre ?? '';
  const categoriaNombre = nombreArea(categoriaId);

  /** Carátulas agrupadas por área (alfabético) y, dentro, en el orden de las modalidades. */
  const grupos = useMemo(() => {
    const porArea = new Map<number, Caratula[]>();
    guardadas.forEach((c) => porArea.set(c.categoriaId, [...(porArea.get(c.categoriaId) ?? []), c]));
    return [...porArea.entries()]
      .map(([id, items]) => ({
        id,
        nombre: categorias.find((c) => c.id === id)?.nombre ?? items[0].categoriaNombre,
        items: items.sort((a, b) => ordenModalidad(a.modalidadId) - ordenModalidad(b.modalidadId)),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [guardadas, categorias]);

  /**
   * Cambia el área/modalidad. Si esa combinación ya tiene carátula se carga para editarla;
   * si no, empieza una nueva con fondo blanco.
   */
  const cambiarSeleccion = (cat: number | '', mod: string) => {
    setCategoriaId(cat);
    setModalidadId(mod);
    if (!cat || !mod) return;
    const guardada = obtenerCaratula(cat, mod);
    if (guardada) {
      setFormData(aForm(guardada));
      toast.info(`Editando carátula guardada · ${nombreArea(cat)} · ${nombreModalidad(mod)}`);
    } else {
      setFormData(formNuevo(mod));
      toast.info('Nueva carátula: personalízala y guarda.');
    }
  };

  const abrirDesdeGaleria = (c: Caratula) => {
    cambiarSeleccion(c.categoriaId, c.modalidadId);
    setVista('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('El logo es muy pesado (máx. 1 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!categoriaId || !modalidadId) return;
    if (!formData.institutionName.trim() || !formData.headerText.trim() || !formData.modalidad.trim()) {
      toast.error('Completa institución, título y texto de modalidad.');
      return;
    }
    setIsSaving(true);
    try {
      guardarCaratula({ ...formData, categoriaId, categoriaNombre, modalidadId });
      setGuardadas(listarCaratulas());
      toast.success(existente ? 'Carátula actualizada.' : 'Carátula guardada.');
    } catch {
      toast.error('No se pudo guardar: el navegador no tiene espacio (prueba con un logo más liviano).');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEliminar = async (c: Caratula) => {
    const ok = await confirmar({
      titulo: '¿Eliminar esta carátula?',
      mensaje: `${c.categoriaNombre} · ${nombreModalidad(c.modalidadId)}`,
      advertencia: 'Los exámenes de esta área y modalidad no podrán generarse hasta que crees otra carátula.',
      peligro: true,
    });
    if (!ok) return;
    eliminarCaratula(c.categoriaId, c.modalidadId);
    setGuardadas(listarCaratulas());
    if (c.categoriaId === categoriaId && c.modalidadId === modalidadId) setFormData(formNuevo(modalidadId));
    toast.success('Carátula eliminada.');
  };

  if (vista === 'galeria') {
    return (
      <div className="config-container">
        <header className="config-header cfg-header-row">
          <div>
            <h1>Carátulas guardadas</h1>
            <p>Agrupadas por área. Haz clic en una para abrirla en el editor.</p>
          </div>
          <button type="button" className="cfg-btn-ghost" onClick={() => setVista('editor')}>
            <span className="material-icons-outlined">arrow_back</span> Volver al editor
          </button>
        </header>

        {grupos.length === 0 ? (
          <section className="panel cfg-empty">
            <span className="material-icons-outlined">collections_bookmark</span>
            <p>Aún no hay carátulas guardadas.</p>
            <button type="button" className="btn-primary" onClick={() => setVista('editor')}>Crear la primera</button>
          </section>
        ) : grupos.map((g) => (
          <section key={g.id} className="panel cfg-group">
            <h2 className="cfg-group-title">
              {g.nombre} <span className="cfg-count">{g.items.length}</span>
            </h2>
            <div className="cfg-gallery">
              {g.items.map((c) => {
                const activa = c.categoriaId === categoriaId && c.modalidadId === modalidadId;
                return (
                  <div key={c.modalidadId} className={`cfg-thumb ${activa ? 'is-active' : ''}`}>
                    <button type="button" className="cfg-thumb-main" onClick={() => abrirDesdeGaleria(c)} title="Abrir en el editor">
                      <PortadaMiniatura data={c} ancho={140} />
                      <span className="cfg-thumb-mod">{nombreModalidad(c.modalidadId)}</span>
                      <span className="cfg-thumb-fecha">
                        Editada {new Date(c.actualizado).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </button>
                    <button type="button" className="cfg-thumb-del" onClick={() => handleEliminar(c)} aria-label="Eliminar carátula" title="Eliminar">
                      <span className="material-icons-outlined">delete</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="config-container">
      <header className="config-header cfg-header-row">
        <div>
          <h1>Configuración de carátulas</h1>
          <p>Cada combinación de <strong>área + modalidad</strong> tiene su propia carátula. Al generar un examen se usa automáticamente la que corresponde.</p>
        </div>
        <button type="button" className="cfg-btn-ghost" onClick={() => setVista('galeria')}>
          <span className="material-icons-outlined">collections_bookmark</span>
          Carátulas guardadas <span className="cfg-count">{guardadas.length}</span>
        </button>
      </header>

      {/* Área + modalidad */}
      <section className="panel cfg-selector">
        <div className="cfg-selector-grid">
          <div className="form-group">
            <label>Área / categoría</label>
            <CustomSelect
              options={categorias.map((c) => ({ value: String(c.id), label: c.nombre }))}
              value={categoriaId === '' ? '' : String(categoriaId)}
              onChange={(v) => cambiarSeleccion(v ? Number(v) : '', modalidadId)}
              placeholder="Elige un área"
            />
          </div>
          <div className="form-group">
            <label>Modalidad / tipo de prueba</label>
            <CustomSelect
              options={TIPOS_PRUEBA.map((t) => ({ value: t.id, label: t.nombre }))}
              value={modalidadId}
              onChange={(v) => cambiarSeleccion(categoriaId, v)}
              placeholder="Elige una modalidad"
            />
          </div>
        </div>
      </section>

      <div className={`config-grid ${!seleccionCompleta ? 'disabled-section' : ''}`}>
        <section className="config-form-section">
          <div className="panel">
            <h2 className="panel-title">Personalizar carátula</h2>
            <form onSubmit={handleSubmit} className="config-form">
              <fieldset disabled={!seleccionCompleta} className="cfg-fieldset">
                <div className="form-group">
                  <label htmlFor="institutionName">Nombre de la institución</label>
                  <input type="text" id="institutionName" name="institutionName" value={formData.institutionName} onChange={handleChange} />
                </div>

                <div className="form-group">
                  <label>Logo de la institución</label>
                  <div className="cfg-logo-row">
                    {formData.logoUrl ? (
                      <div className="cfg-logo-box">
                        <img src={formData.logoUrl} alt="Logo" />
                        <button type="button" onClick={() => setFormData((p) => ({ ...p, logoUrl: null }))} title="Quitar logo" aria-label="Quitar logo">×</button>
                      </div>
                    ) : (
                      <div className="cfg-logo-box cfg-logo-empty">Sin logo</div>
                    )}
                    <label className="cfg-btn-ghost">
                      Subir imagen
                      <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="headerText">Título del examen</label>
                  <input type="text" id="headerText" name="headerText" value={formData.headerText} onChange={handleChange} placeholder="Ej. EXAMEN DE ADMISIÓN" />
                </div>

                <div className="form-group">
                  <label htmlFor="modalidad">Texto de modalidad en la portada</label>
                  <div className="cfg-inline">
                    <input type="text" id="modalidad" name="modalidad" value={formData.modalidad} onChange={handleChange} />
                    <button
                      type="button"
                      className="cfg-btn-ghost cfg-btn-sm"
                      onClick={() => setFormData((p) => ({ ...p, modalidad: textoModalidadSugerido(modalidadId) }))}
                      title="Usar el texto sugerido para la modalidad elegida"
                    >
                      Restablecer
                    </button>
                  </div>
                  <small>Se genera a partir de la modalidad elegida arriba; puedes ajustar cómo se imprime.</small>
                </div>

                <div className="form-group">
                  <label htmlFor="temaLetra">Tema (letra de la primera versión)</label>
                  <input
                    type="text"
                    id="temaLetra"
                    value={formData.temaLetra}
                    maxLength={5}
                    onChange={(e) => setFormData((p) => ({ ...p, temaLetra: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) }))}
                    placeholder="Ej. P"
                    className="cfg-tema"
                  />
                  <small>Las siguientes versiones continúan el abecedario (P, Q, R…) y se pueden cambiar al generar.</small>
                </div>

                <div className="form-group">
                  <label htmlFor="colorPortada">Color de portada</label>
                  <div className="cfg-colors">
                    {COLORES.map(({ color, label }) => (
                      <button
                        key={color}
                        type="button"
                        title={label}
                        aria-label={label}
                        className={`cfg-swatch ${color === '#ffffff' ? 'cfg-swatch-white' : ''} ${formData.colorPortada.toLowerCase() === color ? 'is-active' : ''}`}
                        style={{ background: color }}
                        onClick={() => setFormData((p) => ({ ...p, colorPortada: color }))}
                      />
                    ))}
                    <input type="color" id="colorPortada" name="colorPortada" value={formData.colorPortada} onChange={handleChange} className="cfg-color-input" />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="instructions">Instrucciones</label>
                  <textarea id="instructions" name="instructions" value={formData.instructions} onChange={handleChange} rows={3} />
                </div>

                <div className="form-actions cfg-actions">
                  {existente && (
                    <button type="button" className="cfg-btn-danger" onClick={() => handleEliminar(existente)}>
                      Eliminar
                    </button>
                  )}
                  <button type="submit" className="btn-primary" disabled={isSaving || !seleccionCompleta}>
                    {isSaving ? 'Guardando…' : existente ? 'Guardar cambios' : 'Guardar carátula'}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </section>

        <section className="config-preview-section">
          <div className="panel preview-panel">
            <h2 className="panel-title">
              Vista previa{seleccionCompleta ? `: ${categoriaNombre} · ${nombreModalidad(modalidadId)}` : ''}
            </h2>
            {seleccionCompleta
              ? <PortadaPreview data={formData} />
              : <div className="portada cfg-preview-empty">Elige un área y una modalidad para editar su carátula.</div>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Configuracion;
