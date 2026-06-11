import api from './api';

export const listarCategorias = async () => {
  const { data } = await api.get('/categorias');
  return data;
};

export const crearCategoria = async (payload) => {
  const { data } = await api.post('/categorias', payload);
  return data;
};

export const actualizarCategoria = async (categoriaId, payload) => {
  const { data } = await api.put(`/categorias/${categoriaId}`, payload);
  return data;
};

export const eliminarCategoria = async (categoriaId) => {
  await api.delete(`/categorias/${categoriaId}`);
};

export const listarConfigCursos = async (categoriaId) => {
  const { data } = await api.get(`/categorias/${categoriaId}/config-cursos`);
  return data;
};
