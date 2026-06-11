import api from './api';

export const generarExamen = async (payload) => {
  const { data } = await api.post('/examenes/generar', payload);
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
