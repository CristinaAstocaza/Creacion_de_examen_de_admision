import api from './api';

export const listarPreguntas = async (params = {}) => {
  const { data } = await api.get('/preguntas', { params });
  return data;
};

export const crearPregunta = async (payload) => {
  const { data } = await api.post('/preguntas', payload);
  return data;
};

export const actualizarPregunta = async (id, payload) => {
  const { data } = await api.put(`/preguntas/${id}`, payload);
  return data;
};
