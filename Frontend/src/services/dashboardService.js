import api from './api';

export const obtenerStatsDashboard = async () => {
  const { data } = await api.get('/dashboard/stats');
  return data;
};
