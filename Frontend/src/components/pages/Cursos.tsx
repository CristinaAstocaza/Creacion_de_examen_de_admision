import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Gestion.css';
import { actualizarCurso, contarPreguntasPorCurso, crearCurso, eliminarCurso, listarCursos } from '../../services/cursoService';
import { toast } from '../ui/toast';
import { confirmar } from '../ui/confirm';

interface Curso {
  id: number;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  activo: boolean;
  fechaCreacion: string;
}

interface Conteo { total: number; activas: number }

type FiltroEstado = 'todos' | 'activos' | 'inactivos';
type Orden = 'nombre' | 'preguntas';

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function Cursos() {
  const navigate = useNavigate();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [conteos, setConteos] = useState<Record<number, Conteo>>({});
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const [orden, setOrden] = useState<Orden>('nombre');

  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<Curso | null>(null);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [detalle, setDetalle] = useState<Curso | null>(null);

  const cargar = async () => {
    try {
      setLoading(true);
      const [lista, cuentas] = await Promise.all([
        listarCursos(),
        contarPreguntasPorCurso().catch(() => []),
      ]);
      setCursos(lista);
      setConteos(Object.fromEntries((cuentas as { cursoId: number; total: number; activas: number }[])
        .map((c) => [c.cursoId, { total: Number(c.total), activas: Number(c.activas) }])));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar los cursos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void cargar(); }, []);

  const preguntasDe = (id: number) => conteos[id]?.total ?? 0;

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return cursos
      .filter((c) => filtro === 'todos' || (filtro === 'activos' ? c.activo : !c.activo))
      .filter((c) => !q || sinTildes(`${c.nombre} ${c.codigo ?? ''} ${c.descripcion ?? ''}`).includes(q))
      .sort((a, b) => (orden === 'preguntas'
        ? preguntasDe(b.id) - preguntasDe(a.id)
        : a.nombre.localeCompare(b.nombre, 'es')));
  }, [cursos, busqueda, filtro, orden, conteos]); // eslint-disable-line react-hooks/exhaustive-deps

  const activos = cursos.filter((c) => c.activo).length;
  const totalPreguntas = Object.values(conteos).reduce((s, c) => s + c.total, 0);
  const sinPreguntas = cursos.filter((c) => preguntasDe(c.id) === 0).length;

  const abrirFormulario = (curso: Curso | null) => {
    setEditando(curso);
    setNombre(curso?.nombre ?? '');
    setCodigo(curso?.codigo ?? '');
    setDescripcion(curso?.descripcion ?? '');
    setActivo(curso?.activo ?? true);
    setFormAbierto(true);
  };

  const guardar = async () => {
    if (!nombre.trim()) { toast.error('Escribe el nombre del curso.'); return; }
    setGuardando(true);
    try {
      const payload = { nombre: nombre.trim(), codigo: codigo.trim().toUpperCase() || null, descripcion: descripcion.trim() || null, activo };
      if (editando) await actualizarCurso(editando.id, payload);
      else await crearCurso(payload);
      setFormAbierto(false);
      await cargar();
      toast.success(editando ? 'Curso actualizado.' : 'Curso creado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el curso');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (curso: Curso) => {
    const n = preguntasDe(curso.id);
    const ok = await confirmar({
      titulo: `¿Eliminar el curso "${curso.nombre}"?`,
      advertencia: n
        ? `También se eliminarán permanentemente sus ${n} pregunta(s) del banco.`
        : 'El curso no tiene preguntas en el banco.',
      peligro: true,
    });
    if (!ok) return;
    try {
      await eliminarCurso(curso.id);
      await cargar();
      toast.success(`Curso "${curso.nombre}" eliminado.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el curso');
    }
  };

  const verPreguntas = (curso: Curso) => navigate(`/banco?curso=${curso.id}`);

  return (
    <div className="gs">
      <header className="gs-cabecera">
        <div>
          <h1>Cursos</h1>
          <p>Los cursos agrupan las preguntas del banco. Son globales: cualquier área puede usarlos en su distribución.</p>
        </div>
        <button type="button" className="gs-btn gs-btn-primario" onClick={() => abrirFormulario(null)}>
          <span className="material-icons-outlined">add</span> Nuevo curso
        </button>
      </header>

      <section className="gs-resumen" aria-label="Resumen">
        <div className="gs-kpi"><span className="gs-kpi-icono"><span className="material-icons-outlined">school</span></span><div><strong>{cursos.length}</strong><span>Cursos</span></div></div>
        <div className="gs-kpi gs-kpi--verde"><span className="gs-kpi-icono"><span className="material-icons-outlined">check_circle</span></span><div><strong>{activos}</strong><span>Activos</span></div></div>
        <div className="gs-kpi gs-kpi--ambar"><span className="gs-kpi-icono"><span className="material-icons-outlined">quiz</span></span><div><strong>{totalPreguntas.toLocaleString('es-PE')}</strong><span>Preguntas en el banco</span></div></div>
        <div className="gs-kpi gs-kpi--gris"><span className="gs-kpi-icono"><span className="material-icons-outlined">help_outline</span></span><div><strong>{sinPreguntas}</strong><span>Cursos sin preguntas</span></div></div>
      </section>

      <div className="gs-barra">
        <label className="gs-buscar">
          <span className="material-icons-outlined">search</span>
          <input placeholder="Buscar por nombre, código o descripción…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar curso" />
          {busqueda && <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"><span className="material-icons-outlined">close</span></button>}
        </label>
        <div className="gs-segmentado" role="group" aria-label="Filtrar por estado">
          {(['todos', 'activos', 'inactivos'] as const).map((f) => (
            <button key={f} type="button" className={filtro === f ? 'is-activo' : ''} onClick={() => setFiltro(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <div className="gs-segmentado" role="group" aria-label="Ordenar">
          <button type="button" className={orden === 'nombre' ? 'is-activo' : ''} onClick={() => setOrden('nombre')}>A–Z</button>
          <button type="button" className={orden === 'preguntas' ? 'is-activo' : ''} onClick={() => setOrden('preguntas')}>Más preguntas</button>
        </div>
        <span className="gs-conteo">{visibles.length} de {cursos.length}</span>
      </div>

      <div className="gs-tabla-marco">
        {loading ? (
          <div className="gs-cargando">Cargando cursos…</div>
        ) : visibles.length === 0 ? (
          <div className="gs-vacio">
            <span className="material-icons-outlined">school</span>
            <strong>{cursos.length ? 'Ningún curso coincide con la búsqueda' : 'Aún no hay cursos'}</strong>
            {!cursos.length && <button type="button" className="gs-btn gs-btn-primario" onClick={() => abrirFormulario(null)}>Crear el primer curso</button>}
          </div>
        ) : (
          <table className="gs-tabla">
            <thead>
              <tr>
                <th>Curso</th>
                <th className="gs-ocultar-movil">Descripción</th>
                <th className="gs-col-num">Preguntas</th>
                <th className="gs-col-num">Estado</th>
                <th className="gs-col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => {
                const n = preguntasDe(c.id);
                return (
                  <tr key={c.id} className="is-clicable" onClick={() => setDetalle(c)}>
                    <td>
                      <span className="gs-nombre">{c.nombre}</span>
                      {c.codigo && <span className="gs-sub"><span className="gs-chip gs-chip--codigo">{c.codigo}</span></span>}
                    </td>
                    <td className="gs-ocultar-movil"><span className="gs-recortado" style={{ color: c.descripcion ? undefined : '#9aa0a6' }}>{c.descripcion || 'Sin descripción'}</span></td>
                    <td className="gs-col-num">
                      <span className={`gs-chip ${n ? 'gs-chip--azul' : 'gs-chip--inactivo'}`}>{n.toLocaleString('es-PE')}</span>
                    </td>
                    <td className="gs-col-num">
                      <span className={`gs-chip ${c.activo ? 'gs-chip--activo' : 'gs-chip--inactivo'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td className="gs-col-acciones" onClick={(e) => e.stopPropagation()}>
                      <span className="gs-acciones">
                        <button type="button" className="gs-icono" title="Ver sus preguntas en el banco" onClick={() => verPreguntas(c)}>
                          <span className="material-icons-outlined">quiz</span>
                        </button>
                        <button type="button" className="gs-icono" title="Editar" onClick={() => abrirFormulario(c)}>
                          <span className="material-icons-outlined">edit</span>
                        </button>
                        <button type="button" className="gs-icono peligro" title="Eliminar" onClick={() => void eliminar(c)}>
                          <span className="material-icons-outlined">delete_outline</span>
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Crear / editar curso */}
      {formAbierto && (
        <div className="gs-modal-fondo" onMouseDown={() => !guardando && setFormAbierto(false)}>
          <div className="gs-modal" role="dialog" aria-modal="true" aria-labelledby="curso-titulo" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gs-modal-cab">
              <div>
                <h3 id="curso-titulo">{editando ? 'Editar curso' : 'Nuevo curso'}</h3>
                <p>El código se usa para la distribución sugerida de preguntas (ej. CUR-BIO).</p>
              </div>
              <button type="button" className="gs-icono" onClick={() => setFormAbierto(false)} aria-label="Cerrar"><span className="material-icons-outlined">close</span></button>
            </div>
            <div className="gs-modal-cuerpo">
              <div className="gs-fila">
                <div className="gs-campo">
                  <label htmlFor="curso-nombre">Nombre *</label>
                  <input id="curso-nombre" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Biología" />
                </div>
                <div className="gs-campo">
                  <label htmlFor="curso-codigo">Código</label>
                  <input id="curso-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. CUR-BIO" />
                </div>
              </div>
              <div className="gs-campo">
                <label htmlFor="curso-desc">Descripción</label>
                <textarea id="curso-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Temas que abarca…" />
              </div>
              <label className="gs-switch">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                <span className="gs-switch-pista" aria-hidden="true" />
                {activo ? 'Activo (sus preguntas se usan en los exámenes)' : 'Inactivo'}
              </label>
            </div>
            <div className="gs-modal-pie">
              <button type="button" className="gs-btn" onClick={() => setFormAbierto(false)} disabled={guardando}>Cancelar</button>
              <button type="button" className="gs-btn gs-btn-primario" onClick={() => void guardar()} disabled={guardando}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear curso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle */}
      {detalle && (
        <div className="gs-modal-fondo" onMouseDown={() => setDetalle(null)}>
          <div className="gs-modal" role="dialog" aria-modal="true" aria-labelledby="detalle-titulo" onMouseDown={(e) => e.stopPropagation()}>
            <div className="gs-modal-cab">
              <div><h3 id="detalle-titulo">{detalle.nombre}</h3><p>Detalle del curso</p></div>
              <button type="button" className="gs-icono" onClick={() => setDetalle(null)} aria-label="Cerrar"><span className="material-icons-outlined">close</span></button>
            </div>
            <div className="gs-modal-cuerpo">
              <dl className="gs-datos">
                <dt>Código</dt><dd>{detalle.codigo || '—'}</dd>
                <dt>Estado</dt><dd><span className={`gs-chip ${detalle.activo ? 'gs-chip--activo' : 'gs-chip--inactivo'}`}>{detalle.activo ? 'Activo' : 'Inactivo'}</span></dd>
                <dt>Preguntas</dt><dd>{preguntasDe(detalle.id)} en total · {conteos[detalle.id]?.activas ?? 0} activas</dd>
                <dt>Descripción</dt><dd>{detalle.descripcion || 'Sin descripción'}</dd>
                <dt>Creado</dt><dd>{detalle.fechaCreacion ? new Date(detalle.fechaCreacion).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</dd>
              </dl>
            </div>
            <div className="gs-modal-pie">
              <button type="button" className="gs-btn" onClick={() => { setDetalle(null); abrirFormulario(detalle); }}><span className="material-icons-outlined">edit</span> Editar</button>
              <button type="button" className="gs-btn gs-btn-primario" onClick={() => verPreguntas(detalle)}><span className="material-icons-outlined">quiz</span> Ver preguntas</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
