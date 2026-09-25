import { getCategorias, setCategorias, getConfigs, setConfigs, getPreguntas, nextId, isoNow } from './demoStore';

const withTotals = () => getCategorias().map(c => ({
  ...c,
  totalPreguntas: getPreguntas().length,
}));

export const listarCategorias = async () => withTotals();

export const crearCategoria = async (payload) => {
  const items = getCategorias();
  const item = { id: nextId(items), activo: true, totalPreguntas: 0, fechaCreacion: isoNow(), ...payload };
  setCategorias([...items, item]);
  return item;
};

export const actualizarCategoria = async (categoriaId, payload) => {
  const items = getCategorias();
  const idx = items.findIndex(x => Number(x.id) === Number(categoriaId));
  if (idx < 0) throw new Error('Categoría no encontrada');
  items[idx] = { ...items[idx], ...payload };
  setCategorias(items);
  return items[idx];
};

export const eliminarCategoria = async (categoriaId) => {
  setCategorias(getCategorias().filter(x => Number(x.id) !== Number(categoriaId)));
  setConfigs(getConfigs().filter(x => Number(x.categoriaExamenId) !== Number(categoriaId)));
};

export const listarConfigCursos = async (categoriaId) =>
  getConfigs().filter(x => Number(x.categoriaExamenId) === Number(categoriaId));

export const crearConfigCurso = async (categoriaId, payload) => {
  const items = getConfigs();
  const item = { id: nextId(items), categoriaExamenId: Number(categoriaId), activo: true, fechaConfiguracion: isoNow(), ...payload };
  setConfigs([...items, item]);
  return item;
};

export const actualizarConfigCurso = async (_categoriaId, idConfig, payload) => {
  const items = getConfigs();
  const idx = items.findIndex(x => Number(x.id) === Number(idConfig));
  if (idx < 0) throw new Error('Configuración no encontrada');
  items[idx] = { ...items[idx], ...payload };
  setConfigs(items);
  return items[idx];
};

export const eliminarConfigCurso = async (_categoriaId, idConfig) => {
  setConfigs(getConfigs().filter(x => Number(x.id) !== Number(idConfig)));
};
