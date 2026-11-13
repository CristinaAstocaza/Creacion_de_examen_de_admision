import { useEffect, useMemo, useState } from 'react';
import './Gestion.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  actualizarCategoria,
  crearCategoria,
  eliminarCategoria,
  listarCategorias,
  listarConfigCursos,
  crearConfigCurso,
  actualizarConfigCurso,
  eliminarConfigCurso,
} from '../../services/categoriaService';
import { listarCursos } from '../../services/cursoService';
import { toast } from '../ui/toast';
import { confirmar } from '../ui/confirm';

interface Area {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  totalPreguntas: number | null;
}

interface Curso { id: number; nombre: string; activo: boolean }

interface ConfigCurso {
  id: number;
  cursoId: number;
  cursoNombre: string;
  cantidadSugerida: number;
  activo: boolean;
}

type FiltroEstado = 'todas' | 'activas' | 'inactivas';

/** Total de referencia de una prueba de admisión ordinaria. */
const TOTAL_REFERENCIA = 100;

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Areas() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('todas');

  // Modal de área
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<Area | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Modal de distribución de cursos
  const [areaDistribucion, setAreaDistribucion] = useState<Area | null>(null);
  const [configs, setConfigs] = useState<ConfigCurso[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cargandoConfig, setCargandoConfig] = useState(false);
  const [cursoElegido, setCursoElegido] = useState('');
  const [cantidad, setCantidad] = useState<number>(1);
  const [configEditando, setConfigEditando] = useState<number | null>(null);

  const cargarAreas = async () => {
    try {
      setLoading(true);
      setAreas(await listarCategorias());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar las áreas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void cargarAreas(); }, []);

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return areas
      .filter((a) => filtro === 'todas' || (filtro === 'activas' ? a.activo : !a.activo))
      .filter((a) => !q || sinTildes(`${a.nombre} ${a.descripcion ?? ''}`).includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [areas, busqueda, filtro]);

  const activas = areas.filter((a) => a.activo).length;
  const totalPreguntas = areas.reduce((s, a) => s + (a.totalPreguntas ?? 0), 0);

  // ── Área: crear / editar / eliminar ──
  const abrirFormulario = (area: Area | null) => {
    setEditando(area);
    setNombre(area?.nombre ?? '');
    setDescripcion(area?.descripcion ?? '');
    setActivo(area?.activo ?? true);
    setFormAbierto(true);
  };

  const guardarArea = async () => {
    if (!nombre.trim()) { toast.error('Escribe el nombre del área.'); return; }
    setGuardando(true);
    try {
      const payload = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, activo };
      if (editando) await actualizarCategoria(editando.id, payload);
      else await crearCategoria(payload);
      await cargarAreas();
      setFormAbierto(false);
      toast.success(editando ? 'Área actualizada.' : 'Área creada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el área');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarArea = async (area: Area) => {
    const ok = await confirmar({
      titulo: `¿Eliminar el área "${area.nombre}"?`,
      advertencia: 'Se eliminarán permanentemente el área y toda su distribución de cursos.',
      peligro: true,
    });
    if (!ok) return;
    try {
      await eliminarCategoria(area.id);
      await cargarAreas();
      toast.success(`Área "${area.nombre}" eliminada.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el área');
    }
  };

  // ── Distribución de cursos ──
  const limpiarFormConfig = () => {
    setConfigEditando(null);
    setCursoElegido('');
    setCantidad(1);
  };

  const abrirDistribucion = async (area: Area) => {
    setAreaDistribucion(area);
    limpiarFormConfig();
    setCargandoConfig(true);
    try {
      const [c, cs] = await Promise.all([listarConfigCursos(area.id), listarCursos()]);
      setConfigs(c);
      setCursos(cs);
    } catch {
      toast.error('No se pudo cargar la distribución de cursos.');
    } finally {
      setCargandoConfig(false);
    }
  };

  const guardarConfig = async () => {
    if (!areaDistribucion) return;
    if (!cursoElegido || cantidad <= 0) { toast.error('Elige un curso y una cantidad mayor a 0.'); return; }
    if (cantidad > disponible) {
      toast.error(disponible > 0
        ? `Solo quedan ${disponible} preguntas para llegar a ${TOTAL_REFERENCIA}. Baja la cantidad o reduce otro curso.`
        : `La distribución ya suma ${TOTAL_REFERENCIA}. Reduce otro curso antes de agregar más.`);
      return;
    }
    try {
      const payload = { cursoId: Number(cursoElegido), cantidadSugerida: cantidad, activo: true };
      if (configEditando) await actualizarConfigCurso(areaDistribucion.id, configEditando, payload);
      else await crearConfigCurso(areaDistribucion.id, payload);
      setConfigs(await listarConfigCursos(areaDistribucion.id));
      toast.success(configEditando ? 'Cantidad actualizada.' : 'Curso agregado al área.');
      limpiarFormConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  };

  const quitarConfig = async (config: ConfigCurso) => {
    if (!areaDistribucion) return;
    const ok = await confirmar({
      titulo: `¿Quitar ${config.cursoNombre} del área?`,
      mensaje: 'El curso seguirá existiendo; solo deja de sugerirse para esta área.',
      textoConfirmar: 'Quitar',
      peligro: true,
    });
    if (!ok) return;
    try {
      await eliminarConfigCurso(areaDistribucion.id, config.id);
      setConfigs(await listarConfigCursos(areaDistribucion.id));
      if (configEditando === config.id) limpiarFormConfig();
      toast.success('Curso quitado del área.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo quitar el curso');
    }
  };

  const totalSugerido = configs.reduce((s, c) => s + (c.cantidadSugerida || 0), 0);
  /** Preguntas que aún se pueden asignar sin pasar de 100 (si se edita un curso, su cantidad actual se libera). */
  const disponible = TOTAL_REFERENCIA - totalSugerido
    + (configEditando ? (configs.find((c) => c.id === configEditando)?.cantidadSugerida ?? 0) : 0);
  // En el selector no se repiten cursos ya configurados (salvo el que se está editando).
  const cursosLibres = cursos.filter((c) => !configs.some((cf) => cf.cursoId === c.id && cf.id !== configEditando));

  return (
    <div className="gs">
      <header className="gs-cabecera">
        <div>
          <h1>Áreas de admisión</h1>
          <p>Cada área (Ciencias de la Salud, Ingenierías…) define cuántas preguntas de cada curso se sugieren al generar sus exámenes.</p>
        </div>
        <button type="button" className="gs-btn gs-btn-primario" onClick={() => abrirFormulario(null)}>
          <span className="material-icons-outlined">add</span> Nueva área
        </button>
      </header>

      <section className="gs-resumen" aria-label="Resumen">
        <div className="gs-kpi"><span className="gs-kpi-icono"><span className="material-icons-outlined">grid_view</span></span><div><strong>{areas.length}</strong><span>Áreas registradas</span></div></div>
        <div className="gs-kpi gs-kpi--verde"><span className="gs-kpi-icono"><span className="material-icons-outlined">check_circle</span></span><div><strong>{activas}</strong><span>Activas</span></div></div>
        <div className="gs-kpi gs-kpi--gris"><span className="gs-kpi-icono"><span className="material-icons-outlined">pause_circle</span></span><div><strong>{areas.length - activas}</strong><span>Inactivas</span></div></div>
        <div className="gs-kpi gs-kpi--ambar"><span className="gs-kpi-icono"><span className="material-icons-outlined">quiz</span></span><div><strong>{totalPreguntas.toLocaleString('es-PE')}</strong><span>Preguntas disponibles</span></div></div>
      </section>

      <div className="gs-barra">
        <label className="gs-buscar">
          <span className="material-icons-outlined">search</span>
          <input placeholder="Buscar área…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar área" />
          {busqueda && <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"><span className="material-icons-outlined">close</span></button>}
        </label>
        <div className="gs-segmentado" role="group" aria-label="Filtrar por estado">
          {(['todas', 'activas', 'inactivas'] as const).map((f) => (
            <button key={f} type="button" className={filtro === f ? 'is-activo' : ''} onClick={() => setFiltro(f)}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="gs-conteo">{visibles.length} de {areas.length}</span>
      </div>

      {loading ? (
        <div className="gs-cargando">Cargando áreas…</div>
      ) : visibles.length === 0 ? (
        <div className="gs-tabla-marco gs-vacio">
          <span className="material-icons-outlined">grid_off</span>
          <strong>{areas.length ? 'Ninguna área coincide con la búsqueda' : 'Aún no hay áreas'}</strong>
          {!areas.length && <button type="button" className="gs-btn gs-btn-primario" onClick={() => abrirFormulario(null)}>Crear la primera área</button>}
        </div>
      ) : (
        <div className="gs-tarjetas">
          {visibles.map((area) => (
            <article key={area.id} className={`gs-tarjeta ${area.activo ? '' : 'is-inactiva'}`}>
              <div className="gs-tarjeta-cab">
                <h3>{area.nombre}</h3>
                <span className={`gs-chip ${area.activo ? 'gs-chip--activo' : 'gs-chip--inactivo'}`}>{area.activo ? 'Activa' : 'Inactiva'}</span>
              </div>
              <p>{area.descripcion || 'Sin descripción.'}</p>
              <div className="gs-tarjeta-datos">
                <span><span className="material-icons-outlined">quiz</span>{(area.totalPreguntas ?? 0).toLocaleString('es-PE')} preguntas</span>
              </div>
              <div className="gs-tarjeta-pie">
                <button type="button" className="gs-btn gs-btn-sm" onClick={() => void abrirDistribucion(area)}>
                  <span className="material-icons-outlined">tune</span> Distribución de cursos
                </button>
                <button type="button" className="gs-icono" title="Editar" aria-label={`Editar ${area.nombre}`} onClick={() => abrirFormulario(area)}>
                  <span className="material-icons-outlined">edit</span>
                </button>
                <button type="button" className="gs-icono peligro" title="Eliminar" aria-label={`Eliminar ${area.nombre}`} onClick={() => void eliminarArea(area)}>
                  <span className="material-icons-outlined">delete_outline</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Crear / editar área */}
      {formAbierto && (
        <div className="gs-modal-fondo" onMouseDown={() => !guardando && setFormAbierto(false)}>
          <div className="gs-modal" role="dialog" aria-modal="true" aria-labelledby="area-titulo" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gs-modal-cab">
              <div>
                <h3 id="area-titulo">{editando ? 'Editar área' : 'Nueva área'}</h3>
                <p>{editando ? 'Los cambios se aplican a los próximos exámenes.' : 'Después podrás definir su distribución de cursos.'}</p>
              </div>
              <button type="button" className="gs-icono" onClick={() => setFormAbierto(false)} aria-label="Cerrar"><span className="material-icons-outlined">close</span></button>
            </div>
            <div className="gs-modal-cuerpo">
              <div className="gs-campo">
                <label htmlFor="area-nombre">Nombre *</label>
                <input id="area-nombre" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Ciencias de la Salud" />
              </div>
              <div className="gs-campo">
                <label htmlFor="area-desc">Descripción</label>
                <textarea id="area-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Carreras que incluye, observaciones…" />
              </div>
              <label className="gs-switch">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                <span className="gs-switch-pista" aria-hidden="true" />
                {activo ? 'Activa (aparece al generar exámenes)' : 'Inactiva'}
              </label>
            </div>
            <div className="gs-modal-pie">
              <button type="button" className="gs-btn" onClick={() => setFormAbierto(false)} disabled={guardando}>Cancelar</button>
              <button type="button" className="gs-btn gs-btn-primario" onClick={() => void guardarArea()} disabled={guardando}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear área'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Distribución de cursos del área */}
      {areaDistribucion && (
        <div className="gs-modal-fondo" onMouseDown={() => setAreaDistribucion(null)}>
          <div className="gs-modal gs-modal--ancho" role="dialog" aria-modal="true" aria-labelledby="dist-titulo" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gs-modal-cab">
              <div>
                <h3 id="dist-titulo">Distribución de cursos · {areaDistribucion.nombre}</h3>
                <p>Preguntas sugeridas de cada curso para una prueba de {TOTAL_REFERENCIA}. Al generar el examen se pueden ajustar.</p>
              </div>
              <button type="button" className="gs-icono" onClick={() => setAreaDistribucion(null)} aria-label="Cerrar"><span className="material-icons-outlined">close</span></button>
            </div>

            <div className="gs-modal-cuerpo">
              <div className="ar-form-config">
                <div className="gs-campo ar-campo-curso">
                  <label>Curso</label>
                  <Select value={cursoElegido} onValueChange={setCursoElegido}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Elige un curso…" /></SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {cursosLibres.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="gs-campo ar-campo-cantidad">
                  <label htmlFor="cfg-cantidad">Preguntas</label>
                  <input
                    id="cfg-cantidad"
                    type="number"
                    min={1}
                    max={Math.max(1, disponible)}
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.min(Number(e.target.value), Math.max(0, disponible)))}
                  />
                  <small>Disponibles: {Math.max(0, disponible)}</small>
                </div>
                <button type="button" className="gs-btn gs-btn-primario" onClick={() => void guardarConfig()}>
                  <span className="material-icons-outlined">{configEditando ? 'check' : 'add'}</span>
                  {configEditando ? 'Actualizar' : 'Agregar'}
                </button>
                {configEditando && <button type="button" className="gs-btn" onClick={limpiarFormConfig}>Cancelar</button>}
              </div>

              <div className={`ar-total ${totalSugerido === TOTAL_REFERENCIA ? 'is-ok' : 'is-aviso'}`}>
                <div className="ar-total-fila">
                  <span>Total sugerido</span>
                  <strong>{totalSugerido} / {TOTAL_REFERENCIA}</strong>
                </div>
                <div className="ar-barra"><div style={{ width: `${Math.min(100, (totalSugerido / TOTAL_REFERENCIA) * 100)}%` }} /></div>
                {totalSugerido !== TOTAL_REFERENCIA && (
                  <small>
                    {totalSugerido < TOTAL_REFERENCIA
                      ? `Faltan ${TOTAL_REFERENCIA - totalSugerido} para completar una prueba de ${TOTAL_REFERENCIA} preguntas.`
                      : `Sobran ${totalSugerido - TOTAL_REFERENCIA}: reduce algún curso (no se puede pasar de ${TOTAL_REFERENCIA}).`}
                  </small>
                )}
              </div>

              <div className="gs-tabla-marco">
                {cargandoConfig ? (
                  <div className="gs-cargando">Cargando…</div>
                ) : configs.length === 0 ? (
                  <div className="gs-vacio"><span className="material-icons-outlined">playlist_add</span><strong>Aún no hay cursos en esta área</strong>Agrega el primero con el formulario de arriba.</div>
                ) : (
                  <table className="gs-tabla">
                    <thead><tr><th>Curso</th><th className="gs-col-num">Preguntas</th><th className="gs-col-acciones">Acciones</th></tr></thead>
                    <tbody>
                      {[...configs].sort((a, b) => b.cantidadSugerida - a.cantidadSugerida).map((c) => (
                        <tr key={c.id} className={configEditando === c.id ? 'ar-fila-editando' : ''}>
                          <td className="gs-nombre">{c.cursoNombre}</td>
                          <td className="gs-col-num"><span className="gs-chip gs-chip--azul">{c.cantidadSugerida}</span></td>
                          <td className="gs-col-acciones">
                            <span className="gs-acciones">
                              <button type="button" className="gs-icono" title="Cambiar cantidad" onClick={() => { setConfigEditando(c.id); setCursoElegido(String(c.cursoId)); setCantidad(c.cantidadSugerida); }}>
                                <span className="material-icons-outlined">edit</span>
                              </button>
                              <button type="button" className="gs-icono peligro" title="Quitar del área" onClick={() => void quitarConfig(c)}>
                                <span className="material-icons-outlined">remove_circle_outline</span>
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="gs-modal-pie">
              <button type="button" className="gs-btn" onClick={() => setAreaDistribucion(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
