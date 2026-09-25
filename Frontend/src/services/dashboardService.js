import { getCursos, getCategorias, getPreguntas, getExamenes } from './demoStore';

export const obtenerStatsDashboard = async () => ({
  totalCursos: getCursos().length,
  totalAreas: getCategorias().length,
  totalCategorias: getCategorias().length,
  totalPreguntas: getPreguntas().length,
  totalExamenes: getExamenes().length,
  examenesGenerados: getExamenes().length,
});
