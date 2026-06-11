import api from './api';

export const listarCursos = async () => {
  const { data } = await api.get('/cursos');
  return data;
};

export const crearCurso = async (payload) => {
  const { data } = await api.post('/cursos', payload);
  return data;
};

export const actualizarCurso = async (id, payload) => {
  const { data } = await api.put(`/cursos/${id}`, payload);
  return data;
};

export const eliminarCurso = async (id) => {
  await api.delete(`/cursos/${id}`);
};
