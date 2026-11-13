import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './GenerarExamen.css';
import './GenerarExamenPasos.css';
import CustomSelect from '../ui/CustomSelect';
import { PortadaMiniatura } from '../ui/PortadaPreview';
import { toast, mensajeError } from '../ui/toast';
import { listarCategorias, listarConfigCursos } from '../../services/categoriaService';
import { listarCursos } from '../../services/cursoService';
import { generarExamen } from '../../services/examenService';
import {
  TIPOS_PRUEBA,
  FORMATOS_HOJA,
  TEMA_VALIDO,
  distribucionRecomendada,
  escalarDistribucion,
  letrasDesde,
  obtenerTiposPrueba,
  guardarTotalModalidad,
  restablecerTotalModalidad,
  type TipoPrueba,
} from '../../utils/estructuraExamen';
import { type Caratula, obtenerCaratula, caratulaCompleta, caratulaAPayload } from '../../utils/caratulas';

/** Letra de tema inicial: la de la carátula de esa área + modalidad (por defecto "A"). */
const temaDe = (c: Caratula | null): string => {
  const tema = String(c?.temaLetra || '').trim().toUpperCase();
  return TEMA_VALIDO.test(tema) ? tema : 'A';
};

interface CategoriaExamen {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

interface Curso {
  id: number;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  activo: boolean;
}

interface CategoriaCursoConfig {
  id: number;
  cursoId: number;
  cursoNombre: string;
  cursoCodigo: string | null;
  cantidadSugerida: number | null;
  activo: boolean;
}

interface Quantities {
  total: number;
  facil: number;
  medio: number;
  dificil: number;
}

type Paso = 1 | 2;

const emptyQuantities = (): Quantities => ({ total: 0, facil: 0, medio: 0, dificil: 0 });

export default function GenerarExamen() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState<Paso>(1);
  const [categorias, setCategorias] = useState<CategoriaExamen[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [configs, setConfigs] = useState<CategoriaCursoConfig[]>([]);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<number | ''>('');
  const [tipoPruebaId, setTipoPruebaId] = useState<string>('ORDINARIA');
  const [formatoHoja, setFormatoHoja] = useState<string>('A4');
  const [configsBackend, setConfigsBackend] = useState<CategoriaCursoConfig[]>([]);
  const [nombreExamen, setNombreExamen] = useState('Examen de admisión');
  const [numVersions, setNumVersions] = useState<number>(1);
  const [letrasVersion, setLetrasVersion] = useState<string[]>(['A']);
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [selectedCourses, setSelectedCourses] = useState<Record<number, boolean>>({});
  const [quantities, setQuantities] = useState<Record<number, Quantities>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [filtroCurso, setFiltroCurso] = useState('');

  const cargarCategoriasYCursos = async () => {
    try {
      setLoading(true);
      const [categoriasData, cursosData] = await Promise.all([listarCategorias(), listarCursos()]);
      setCategorias(categoriasData.filter((categoria: CategoriaExamen) => categoria.activo));
      setCursos(cursosData.filter((curso: Curso) => curso.activo));
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo conectar con el backend'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCategoriasYCursos();
  }, []);

  const [tiposPrueba, setTiposPrueba] = useState<TipoPrueba[]>(() => obtenerTiposPrueba());
  const tipoPrueba = tiposPrueba.find((t) => t.id === tipoPruebaId) ?? tiposPrueba[0];
  const totalOriginalModalidad = TIPOS_PRUEBA.find((t) => t.id === tipoPruebaId)?.total ?? null;

  const handleCambiarTotalModalidad = (nuevoValorStr: string) => {
    const val = nuevoValorStr.trim() === '' ? null : Math.max(1, parseInt(nuevoValorStr, 10) || 1);
    guardarTotalModalidad(tipoPruebaId, val);
    setTiposPrueba(obtenerTiposPrueba());
  };

  const handleRestablecerTotalModalidad = () => {
    restablecerTotalModalidad(tipoPruebaId);
    setTiposPrueba(obtenerTiposPrueba());
  };

  // Carátula de la combinación área + modalidad elegida (se define en Configuración).
  const caratula = useMemo(() => obtenerCaratula(selectedCategoriaId, tipoPruebaId), [selectedCategoriaId, tipoPruebaId]);

  // El primer tema viene de esa carátula; las demás versiones continúan el abecedario.
  useEffect(() => {
    setLetrasVersion((prev) => letrasDesde(temaDe(caratula), prev.length));
  }, [caratula]);

  // Sugerencias guardadas en el backend para la categoría (se usan en pruebas de 100 preguntas).
  useEffect(() => {
    if (!selectedCategoriaId) {
      setConfigsBackend([]);
      return;
    }
    listarConfigCursos(selectedCategoriaId)
      .then((data: CategoriaCursoConfig[]) => setConfigsBackend(data.filter((c) => c.activo)))
      .catch(() => setConfigsBackend([]));
  }, [selectedCategoriaId]);

  // Precarga las cantidades recomendadas cada vez que cambia el tipo de prueba o el área.
  // Son solo una recomendación: el usuario puede marcar/desmarcar cursos y cambiar cantidades.
  const aplicarSugerencias = () => {
    if (!selectedCategoriaId || cursos.length === 0) {
      setConfigs([]);
      return;
    }
    if (tipoPrueba.total === null) {
      setConfigs([]); // Personalizado: se mantiene lo que el usuario ya eligió
      return;
    }
    const categoriaObj = categorias.find((c) => c.id === selectedCategoriaId);
    // La distribución del área (Áreas → Distribución de cursos) está pensada para 100 preguntas:
    // se usa en las modalidades de 100 y se escala si su total se cambió (p. ej. a 80).
    const usarBackend = totalOriginalModalidad === 100 && configsBackend.length > 0;
    const backendEscalado = usarBackend
      ? escalarDistribucion(
          Object.fromEntries(configsBackend.map((c) => [c.cursoId, c.cantidadSugerida || 0])) as Record<number, number>,
          tipoPrueba.total,
        )
      : {};
    const plantilla = distribucionRecomendada(tipoPrueba, categoriaObj?.nombre || '') ?? {};
    const sugerencias: CategoriaCursoConfig[] = usarBackend
      ? configsBackend.map((c) => ({ ...c, cantidadSugerida: (backendEscalado as Record<number, number>)[c.cursoId] ?? 0 }))
      : cursos.map((c) => ({
          id: c.id,
          cursoId: c.id,
          cursoNombre: c.nombre,
          cursoCodigo: c.codigo,
          cantidadSugerida: plantilla[c.codigo || ''] || 0,
          activo: true,
        }));

    const selected: Record<number, boolean> = {};
    const nextQuantities: Record<number, Quantities> = {};
    sugerencias.forEach((config) => {
      const cantidad = config.cantidadSugerida || 0;
      selected[config.cursoId] = cantidad > 0;
      nextQuantities[config.cursoId] = { total: cantidad, facil: 0, medio: 0, dificil: 0 };
    });
    setConfigs(sugerencias.filter((c) => (c.cantidadSugerida || 0) > 0));
    setSelectedCourses(selected);
    setQuantities(nextQuantities);
  };

  // También al cambiar la cantidad de preguntas de la modalidad: la distribución se reescala al nuevo total.
  useEffect(aplicarSugerencias, [selectedCategoriaId, tipoPruebaId, tipoPrueba.total, categorias, cursos, configsBackend]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantiene una letra de tema por versión (las nuevas continúan el abecedario).
  const cambiarNumeroVersiones = (valor: number) => {
    const cantidad = Math.min(Math.max(valor || 1, 1), 26);
    setNumVersions(cantidad);
    setLetrasVersion((prev) => {
      if (cantidad <= prev.length) return prev.slice(0, cantidad);
      const sugeridas = letrasDesde(prev[0] || temaDe(caratula), cantidad + prev.length)
        .filter((l) => !prev.includes(l));
      return [...prev, ...sugeridas].slice(0, cantidad);
    });
  };

  const cambiarLetra = (indice: number, valor: string) => {
    const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    setLetrasVersion((prev) => prev.map((l, i) => (i === indice ? limpio : l)));
  };

  const letrasInvalidas = letrasVersion.some((l) => !TEMA_VALIDO.test(l));
  const letrasRepetidas = new Set(letrasVersion).size !== letrasVersion.length;

  const cursosProcesados = useMemo(() => cursos.map((curso) => {
    const config = configs.find((item) => item.cursoId === curso.id);
    const req = quantities[curso.id] || emptyQuantities();
    return {
      ...curso,
      sugerido: Boolean(config),
      cantidadSugerida: config?.cantidadSugerida || null,
      isSelected: Boolean(selectedCourses[curso.id]),
      req,
    };
  }), [configs, cursos, quantities, selectedCourses]);

  const cursosFiltrados = useMemo(() => {
    const q = filtroCurso.trim().toLowerCase();
    if (!q) return cursosProcesados;
    return cursosProcesados.filter((c) => c.nombre.toLowerCase().includes(q) || (c.codigo || '').toLowerCase().includes(q));
  }, [cursosProcesados, filtroCurso]);

  const cursosSeleccionados = cursosProcesados.filter((c) => c.isSelected);
  const totalSelected = cursosSeleccionados.reduce((total, curso) => total + curso.req.total, 0);
  const hasErrors = cursosSeleccionados.some((curso) => curso.req.total <= 0);
  const totalObjetivo = tipoPrueba.total;
  const sobra = totalObjetivo !== null && totalSelected > totalObjetivo;
  const falta = totalObjetivo !== null && totalSelected < totalObjetivo;
  const esExacto = totalObjetivo !== null ? totalSelected === totalObjetivo : totalSelected > 0;
  const caratulaOk = caratulaCompleta(caratula);
  const selectedCategoria = categorias.find((categoria) => categoria.id === selectedCategoriaId);

  const paso1Completo = Boolean(selectedCategoriaId) && !letrasInvalidas && !letrasRepetidas;
  const paso2Completo = esExacto && totalSelected > 0 && !hasErrors;

  const requisitos = [
    { ok: Boolean(selectedCategoriaId), texto: 'Área seleccionada' },
    { ok: !letrasInvalidas && !letrasRepetidas, texto: 'Temas de versión válidos' },
    {
      ok: paso2Completo,
      texto: totalObjetivo !== null
        ? (esExacto
            ? `Total de preguntas exacto: ${totalSelected} de ${totalObjetivo}`
            : sobra
              ? `Límite superado: ${totalSelected}/${totalObjetivo} (sobran ${totalSelected - totalObjetivo})`
              : `Faltan preguntas: ${totalSelected}/${totalObjetivo} (faltan ${totalObjetivo - totalSelected})`)
        : (totalSelected > 0 ? `Preguntas asignadas: ${totalSelected}` : 'Asigna al menos una pregunta a un curso'),
    },
    { ok: caratulaOk, texto: 'Carátula para esta área y modalidad' },
  ];

  const isGenerateDisabled = requisitos.some((r) => !r.ok) || generating;
  const progreso = totalObjetivo ? Math.min((totalSelected / totalObjetivo) * 100, 100) : (totalSelected > 0 ? 100 : 0);
  const estadoTotal = totalSelected === 0 ? 'vacio' : sobra ? 'error' : falta ? 'aviso' : 'ok';

  const handleToggleCourse = (id: number, checked: boolean) => {
    setSelectedCourses((prev) => ({ ...prev, [id]: checked }));
    setQuantities((prev) => ({
      ...prev,
      [id]: checked ? (prev[id] || emptyQuantities()) : emptyQuantities(),
    }));
  };

  /** Lo máximo que puede tener un curso sin pasar del total de la modalidad. */
  const maximoPara = (id: number) =>
    totalObjetivo === null ? Infinity : totalObjetivo - (totalSelected - (quantities[id]?.total ?? 0));

  const handleQuantityChange = (id: number, value: string) => {
    let val = Math.max(parseInt(value, 10) || 0, 0);
    const maximo = maximoPara(id);
    // No se permite pasar del límite: el valor se ajusta al máximo disponible.
    if (val > maximo) {
      val = Math.max(0, maximo);
      toast.info(`Máximo ${val} para este curso: el examen es de ${totalObjetivo} preguntas.`);
    }
    setQuantities((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || emptyQuantities()), total: val },
    }));
  };

  const limpiarSeleccion = () => {
    setSelectedCourses({});
    setQuantities({});
  };

  const solicitarGeneracion = () => {
    if (!caratulaOk) {
      toast.error('No hay carátula para esta área y modalidad. Créala en Configuración.');
      return;
    }
    if (totalObjetivo !== null && totalSelected !== totalObjetivo) {
      if (sobra) {
        toast.error(`La distribución tiene ${totalSelected} preguntas, superando el límite de ${totalObjetivo} (sobran ${totalSelected - totalObjetivo}). Ajusta los cursos.`);
      } else {
        toast.error(`La distribución tiene ${totalSelected} preguntas, faltando para alcanzar el límite de ${totalObjetivo} (faltan ${totalObjetivo - totalSelected}). Ajusta los cursos.`);
      }
      return;
    }
    if (isGenerateDisabled) return;
    setShowConfirm(true);
  };

  const handleGenerate = async () => {
    if (!caratulaCompleta(caratula) || !selectedCategoriaId) return;
    setShowConfirm(false);

    const cursosPayload = cursosSeleccionados.map((curso) => ({
      idCurso: curso.id,
      cantidadTotal: curso.req.total,
      cantidadFacil: 0,
      cantidadMedio: curso.req.total,
      cantidadDificil: 0,
    }));

    try {
      setGenerating(true);
      await generarExamen({
        idCategoria: selectedCategoriaId,
        nombreExamen: nombreExamen.trim() || 'Examen de admisión',
        cantidadVersiones: numVersions,
        aleatorizarPreguntas: randomizeQuestions,
        aleatorizarAlternativas: randomizeOptions,
        cursos: cursosPayload,
        ...caratulaAPayload(caratula),
        tipoPrueba: tipoPrueba.nombre,
        formatoHoja,
        codigosVersion: letrasVersion,
      });
      toast.success(`Examen generado con ${numVersions} versión(es). Ya está en el Historial.`);
      navigate('/historial');
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo generar el examen'));
    } finally {
      setGenerating(false);
    }
  };

  const irAConfiguracion = () => navigate(`/configuracion?categoria=${selectedCategoriaId}&modalidad=${tipoPruebaId}`);

  const hoja = FORMATOS_HOJA.find((f) => f.value === formatoHoja)?.label ?? formatoHoja;

  return (
    <div className="generar-container">
      <header className="ge-header">
        <div>
          <h2 className="page-title">Generación de Exámenes</h2>
          <p className="ge-subtitle">Define los datos del examen y luego distribuye las preguntas por curso.</p>
        </div>
      </header>

      {/* Pasos */}
      <nav className="ge-steps" aria-label="Pasos de generación">
        {([
          { n: 1 as Paso, titulo: 'Datos del examen', desc: 'Área, modalidad, formato y versiones', completo: paso1Completo },
          { n: 2 as Paso, titulo: 'Distribución de preguntas', desc: 'Cursos y cantidad por curso', completo: paso2Completo },
        ]).map((s) => (
          <button
            key={s.n}
            type="button"
            className={`ge-step ${paso === s.n ? 'is-active' : ''} ${s.completo ? 'is-done' : ''}`}
            onClick={() => setPaso(s.n)}
            aria-current={paso === s.n ? 'step' : undefined}
          >
            <span className="ge-step-num">
              {s.completo && paso !== s.n ? <span className="material-icons-outlined">check</span> : s.n}
            </span>
            <span className="ge-step-text">
              <strong>{s.titulo}</strong>
              <small>{s.desc}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="ge-layout">
        <div className="ge-main">
          {paso === 1 && (
            <>
              <section className="ge-card">
                <header className="ge-card-header">
                  <span className="material-icons-outlined">info</span>
                  <div>
                    <h3>Información general</h3>
                    <p>El área y la modalidad determinan la distribución sugerida de preguntas.</p>
                  </div>
                </header>
                <div className="ge-grid">
                  <div className="ge-field">
                    <label>Área / categoría <span className="ge-req">*</span></label>
                    <div className="ge-inline">
                      <CustomSelect
                        options={categorias.map((c) => ({ value: String(c.id), label: c.nombre }))}
                        value={selectedCategoriaId !== '' ? String(selectedCategoriaId) : ''}
                        onChange={(val) => setSelectedCategoriaId(val ? Number(val) : '')}
                        placeholder={loading ? 'Cargando…' : 'Selecciona un área'}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="ge-icon-btn"
                        onClick={cargarCategoriasYCursos}
                        disabled={loading}
                        title="Recargar áreas y cursos"
                        aria-label="Recargar áreas y cursos"
                      >
                        <span className={`material-icons-outlined ${loading ? 'ge-spin' : ''}`}>refresh</span>
                      </button>
                    </div>
                  </div>
                  <div className="ge-field">
                    <label>Tipo de prueba / modalidad</label>
                    <CustomSelect
                      options={tiposPrueba.map((t) => ({
                        value: t.id,
                        label: t.total ? `${t.nombre} (${t.total} preguntas)` : t.nombre,
                      }))}
                      value={tipoPruebaId}
                      onChange={(val) => setTipoPruebaId(val || 'ORDINARIA')}
                      placeholder="Selecciona el tipo de prueba"
                    />
                    <span className="field-hint">{tipoPrueba.descripcion}.</span>
                  </div>
                  <div className="ge-field">
                    <label htmlFor="ge-total-modalidad">Cantidad de preguntas ({tipoPrueba.nombre})</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        id="ge-total-modalidad"
                        type="number"
                        min="1"
                        max="500"
                        className="form-control"
                        style={{ maxWidth: '140px', fontWeight: 700 }}
                        value={tipoPrueba.total ?? ''}
                        onChange={(e) => handleCambiarTotalModalidad(e.target.value)}
                        placeholder="Sin límite"
                      />
                      {totalOriginalModalidad !== null && tipoPrueba.total !== totalOriginalModalidad && (
                        <button
                          type="button"
                          className="ge-btn ge-btn-ghost ge-btn-sm"
                          onClick={handleRestablecerTotalModalidad}
                          title={`Restablecer a ${totalOriginalModalidad} preguntas`}
                        >
                          <span className="material-icons-outlined">restart_alt</span> Predeterminado ({totalOriginalModalidad})
                        </button>
                      )}
                    </div>
                    <span className="field-hint">
                      Límite de preguntas requerido para esta modalidad. Se actualiza en la sección de distribución.
                    </span>
                  </div>
                  <div className="ge-field ge-span-2">
                    <label htmlFor="ge-nombre">Nombre del archivo</label>
                    <input
                      id="ge-nombre"
                      className="form-control"
                      placeholder="Ej. Examen de admisión 2026-II"
                      value={nombreExamen}
                      onChange={(e) => setNombreExamen(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="ge-card">
                <header className="ge-card-header">
                  <span className="material-icons-outlined">print</span>
                  <div>
                    <h3>Formato y versiones</h3>
                    <p>Cada versión se imprime con su propio tema (letra) y orden de preguntas.</p>
                  </div>
                </header>
                <div className="ge-grid">
                  <div className="ge-field">
                    <label>Formato de hoja</label>
                    <CustomSelect
                      options={FORMATOS_HOJA}
                      value={formatoHoja}
                      onChange={(val) => setFormatoHoja(val || 'A4')}
                      placeholder="Selecciona el formato"
                    />
                  </div>
                  <div className="ge-field">
                    <label htmlFor="ge-versiones">Número de versiones</label>
                    <div className="ge-stepper">
                      <button type="button" onClick={() => cambiarNumeroVersiones(numVersions - 1)} disabled={numVersions <= 1} aria-label="Quitar versión">−</button>
                      <input
                        id="ge-versiones"
                        type="number"
                        min="1"
                        max="26"
                        value={numVersions}
                        onChange={(e) => cambiarNumeroVersiones(parseInt(e.target.value, 10))}
                      />
                      <button type="button" onClick={() => cambiarNumeroVersiones(numVersions + 1)} disabled={numVersions >= 26} aria-label="Agregar versión">+</button>
                    </div>
                  </div>
                  <div className="ge-field ge-span-2">
                    <label>Tema de cada versión</label>
                    <div className="tema-versiones">
                      {letrasVersion.map((letra, i) => (
                        <label key={i} className="tema-version-item">
                          <span>V{i + 1}</span>
                          <input
                            className={`tema-input ${!TEMA_VALIDO.test(letra) || letrasVersion.indexOf(letra) !== i ? 'tema-input-error' : ''}`}
                            value={letra}
                            maxLength={5}
                            onChange={(e) => cambiarLetra(i, e.target.value)}
                            aria-label={`Tema de la versión ${i + 1}`}
                          />
                        </label>
                      ))}
                    </div>
                    <span className={`field-hint ${letrasInvalidas || letrasRepetidas ? 'ge-hint-error' : ''}`}>
                      {letrasInvalidas || letrasRepetidas
                        ? 'Los temas no pueden estar vacíos ni repetirse.'
                        : 'Se imprime como TEMA y en el nombre de cada archivo. El primero viene de Configuración.'}
                    </span>
                  </div>
                  <div className="ge-field ge-span-2">
                    <label>Aleatorización</label>
                    <div className="ge-toggles">
                      <label className="ge-toggle">
                        <input type="checkbox" checked={randomizeQuestions} onChange={(e) => setRandomizeQuestions(e.target.checked)} />
                        <span className="ge-toggle-track" aria-hidden="true" />
                        <span>
                          <strong>Orden de preguntas</strong>
                          <small>Cada versión mezcla las preguntas</small>
                        </span>
                      </label>
                      <label className="ge-toggle">
                        <input type="checkbox" checked={randomizeOptions} onChange={(e) => setRandomizeOptions(e.target.checked)} />
                        <span className="ge-toggle-track" aria-hidden="true" />
                        <span>
                          <strong>Orden de alternativas</strong>
                          <small>Mezcla A, B, C, D, E en cada pregunta</small>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </section>

              <div className="ge-footer-nav">
                <span />
                <button
                  type="button"
                  className="ge-btn ge-btn-primary"
                  onClick={() => {
                    if (!selectedCategoriaId) {
                      toast.error('Selecciona un área para continuar.');
                      return;
                    }
                    setPaso(2);
                  }}
                >
                  Siguiente: distribución
                  <span className="material-icons-outlined">arrow_forward</span>
                </button>
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <section className="ge-card">
                <header className="ge-card-header">
                  <span className="material-icons-outlined">format_list_numbered</span>
                  <div>
                    <h3>Distribución de preguntas</h3>
                    <p>
                      {selectedCategoria
                        ? <>Sugerencia precargada para <strong>{selectedCategoria.nombre}</strong> · {tipoPrueba.nombre}. Puedes ajustarla libremente.</>
                        : 'Selecciona un área en el paso 1 para precargar la distribución sugerida.'}
                    </p>
                  </div>
                </header>

                {totalObjetivo !== null && (
                  <div
                    style={{
                      margin: '12px 0 16px 0',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: esExacto ? 'rgba(34, 197, 94, 0.1)' : sobra ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      border: `1px solid ${esExacto ? 'rgba(34, 197, 94, 0.3)' : sobra ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                      color: esExacto ? '#15803d' : sobra ? '#b91c1c' : '#b45309',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
                        {esExacto ? 'check_circle' : sobra ? 'error' : 'warning'}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        {esExacto
                          ? `Distribución exacta: se han asignado las ${totalObjetivo} preguntas requeridas.`
                          : sobra
                            ? `Límite superado: has puesto ${totalSelected} de ${totalObjetivo} preguntas (sobran ${totalSelected - totalObjetivo}).`
                            : `Faltan preguntas: has puesto ${totalSelected} de ${totalObjetivo} preguntas (faltan ${totalObjetivo - totalSelected}).`}
                      </span>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '14px' }}>
                      {totalSelected} / {totalObjetivo}
                    </span>
                  </div>
                )}

                <div className="ge-toolbar">
                  <div className="ge-search">
                    <span className="material-icons-outlined">search</span>
                    <input
                      placeholder="Buscar curso…"
                      value={filtroCurso}
                      onChange={(e) => setFiltroCurso(e.target.value)}
                      aria-label="Buscar curso"
                    />
                  </div>
                  <div className="ge-toolbar-actions">
                    <button type="button" className="ge-btn ge-btn-ghost" onClick={aplicarSugerencias} disabled={!selectedCategoriaId || tipoPrueba.total === null}>
                      <span className="material-icons-outlined">auto_fix_high</span> Restaurar sugerencia
                    </button>
                    <button type="button" className="ge-btn ge-btn-ghost" onClick={limpiarSeleccion} disabled={cursosSeleccionados.length === 0}>
                      <span className="material-icons-outlined">clear_all</span> Limpiar
                    </button>
                  </div>
                </div>

                <div className="ge-course-list" role="list">
                  {loading && <div className="ge-empty">Cargando cursos…</div>}
                  {!loading && cursosFiltrados.length === 0 && <div className="ge-empty">No hay cursos que coincidan.</div>}
                  {!loading && cursosFiltrados.map((curso) => (
                    <div
                      key={curso.id}
                      role="listitem"
                      className={`ge-course ${curso.isSelected ? 'is-selected' : ''} ${curso.isSelected && curso.req.total <= 0 ? 'is-error' : ''}`}
                      onClick={() => handleToggleCourse(curso.id, !curso.isSelected)}
                    >
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        checked={curso.isSelected}
                        onChange={(e) => handleToggleCourse(curso.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Incluir ${curso.nombre}`}
                      />
                      <div className="ge-course-info">
                        <strong>{curso.nombre}</strong>
                        <span>
                          {curso.codigo && <code>{curso.codigo}</code>}
                          {curso.sugerido && <em className="ge-badge">Sugerido: {curso.cantidadSugerida}</em>}
                        </span>
                      </div>
                      <input
                        type="number"
                        className="input-number"
                        min="0"
                        max={Number.isFinite(maximoPara(curso.id)) ? Math.max(0, maximoPara(curso.id)) : undefined}
                        disabled={!curso.isSelected}
                        value={curso.isSelected && curso.req.total ? curso.req.total : ''}
                        placeholder="0"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleQuantityChange(curso.id, e.target.value)}
                        aria-label={`Cantidad de preguntas de ${curso.nombre}`}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <div className="ge-footer-nav">
                <button type="button" className="ge-btn ge-btn-ghost" onClick={() => setPaso(1)}>
                  <span className="material-icons-outlined">arrow_back</span>
                  Volver a datos
                </button>
                <span />
              </div>
            </>
          )}
        </div>

        {/* Resumen */}
        <aside className="ge-summary">
          <div className="ge-card ge-summary-card">
            <h3 className="ge-summary-title">
              <span className="material-icons-outlined">receipt_long</span> Resumen
            </h3>

            <dl className="ge-facts">
              <div><dt>Área</dt><dd>{selectedCategoria?.nombre ?? '—'}</dd></div>
              <div><dt>Modalidad</dt><dd>{tipoPrueba.nombre}</dd></div>
              <div><dt>Hoja</dt><dd>{hoja}</dd></div>
              <div><dt>Versiones</dt><dd>{numVersions} · {letrasVersion.filter(Boolean).join(', ') || '—'}</dd></div>
            </dl>

            {/* Carátula que se imprimirá: la de esta área + modalidad */}
            <div className={`ge-caratula ${caratulaOk ? '' : 'is-missing'}`}>
              {caratulaOk
                ? <PortadaMiniatura data={{ ...caratula, temaLetra: letrasVersion[0] || caratula.temaLetra }} ancho={72} />
                : <div className="ge-caratula-vacia"><span className="material-icons-outlined">image_not_supported</span></div>}
              <div className="ge-caratula-info">
                <span>Carátula</span>
                <strong>
                  {caratulaOk
                    ? `${selectedCategoria?.nombre} · ${tipoPrueba.nombre}`
                    : selectedCategoriaId ? 'No existe para esta área y modalidad' : 'Elige un área'}
                </strong>
                {selectedCategoriaId !== '' && (
                  <button type="button" className="ge-link" onClick={irAConfiguracion}>
                    {caratulaOk ? 'Editar carátula' : 'Crear carátula'}
                  </button>
                )}
              </div>
            </div>

            <div className={`ge-total ge-total-${estadoTotal}`}>
              <div className="ge-total-row">
                <span>Preguntas</span>
                <strong>{totalSelected}{totalObjetivo !== null ? <small> / {totalObjetivo}</small> : null}</strong>
              </div>
              <div className="ge-progress"><div style={{ width: `${progreso}%` }} /></div>
              {totalObjetivo !== null && totalSelected > 0 && (
                <span className={`ge-total-note ${esExacto ? 'ge-total-ok' : sobra ? 'ge-total-error' : 'ge-total-warn'}`} style={{ fontWeight: 600 }}>
                  {esExacto
                    ? `Distribución exacta: ${totalObjetivo} preguntas.`
                    : sobra
                      ? `Límite superado: sobran ${totalSelected - totalObjetivo} preguntas.`
                      : `Faltan ${totalObjetivo - totalSelected} preguntas para el límite de ${totalObjetivo}.`}
                </span>
              )}
              <span className="ge-total-note">{cursosSeleccionados.length} curso(s) incluidos</span>
            </div>

            <ul className="ge-checklist">
              {requisitos.map((r) => (
                <li key={r.texto} className={r.ok ? 'ok' : ''}>
                  <span className="material-icons-outlined">{r.ok ? 'check_circle' : 'radio_button_unchecked'}</span>
                  {r.texto}
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="ge-btn ge-btn-primary ge-btn-block"
              disabled={isGenerateDisabled}
              onClick={solicitarGeneracion}
            >
              <span className={`material-icons-outlined ${generating ? 'ge-spin' : ''}`}>{generating ? 'autorenew' : 'note_add'}</span>
              {generating ? 'Generando…' : 'Generar examen'}
            </button>
          </div>
        </aside>
      </div>

      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content ge-confirm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ge-confirm-title">
            <span className="material-icons-outlined ge-confirm-icon">help_outline</span>
            <h3 id="ge-confirm-title">¿Generar el examen?</h3>
            {caratulaOk && (
              <div className="ge-confirm-portada">
                <PortadaMiniatura data={{ ...caratula, temaLetra: letrasVersion[0] || caratula.temaLetra }} ancho={110} />
              </div>
            )}
            <dl className="ge-facts">
              <div><dt>Área</dt><dd>{selectedCategoria?.nombre}</dd></div>
              <div><dt>Modalidad</dt><dd>{tipoPrueba.nombre}</dd></div>
              <div><dt>Preguntas</dt><dd>{totalSelected}</dd></div>
              <div><dt>Hoja</dt><dd>{hoja}</dd></div>
              <div><dt>Versiones</dt><dd>{numVersions} (tema {letrasVersion.join(', ')})</dd></div>
            </dl>
            <div className="ge-confirm-actions">
              <button type="button" className="ge-btn ge-btn-ghost" onClick={() => setShowConfirm(false)}>Cancelar</button>
              <button type="button" className="ge-btn ge-btn-primary" onClick={handleGenerate}>Generar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
