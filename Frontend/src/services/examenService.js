import api from './api';

export const listarExamenes = async () => {
  const { data } = await api.get('/examenes');
  return data;
};

export const obtenerExamen = async (examenId) => {
  const { data } = await api.get(`/examenes/${examenId}`);
  return data;
};

export const obtenerSolucionario = async (examenId) => {
  const { data } = await api.get(`/examenes/${examenId}/solucionario`);
  return data;
};

export const generarExamen = async ({
  idCategoria,
  nombreExamen,
  cantidadVersiones,
  aleatorizarPreguntas,
  aleatorizarAlternativas,
  cursos
}) => {
  const { data } = await api.post('/examenes/generar', {
    idCategoria,
    nombreExamen,
    cantidadVersiones,
    aleatorizarPreguntas,
    aleatorizarAlternativas,
    cursos: cursos.map(curso => ({
      idCurso: curso.idCurso,
      cantidadTotal: curso.cantidadTotal,
      cantidadFacil: curso.cantidadFacil,
      cantidadMedio: curso.cantidadMedio,
      cantidadDificil: curso.cantidadDificil
    }))
  });
  return data;
};

export const obtenerVersionExamen = async (examenId, version) => {
  const { data } = await api.get(`/examenes/${examenId}/versiones/${version}`);
  return data;
};

const descargarArchivo = async (url, nombreFallback) => {
  const response = await api.get(url, { responseType: 'blob' });
  const disposition = response.headers['content-disposition'];
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || nombreFallback;
  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

export const descargarPdfVersion = (examenId, version) => descargarArchivo(
  `/examenes/${examenId}/versiones/${version}/pdf`,
  `examen_version_${version}.pdf`,
);

export const descargarPdfsVersiones = (examenId) => descargarArchivo(
  `/examenes/${examenId}/pdfs`,
  'examen_versiones.zip',
);

export const descargarPdfSolucionario = (examenId, version) => descargarArchivo(
  `/examenes/${examenId}/versiones/${version}/solucionario-pdf`,
  `solucionario_version_${version}.pdf`,
);
