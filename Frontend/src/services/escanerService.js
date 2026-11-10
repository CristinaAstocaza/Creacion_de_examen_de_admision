import api from './api';

/** Escáneres / impresoras multifunción conectados a la PC donde corre el backend. */
export const listarEscaneres = async () => {
  const { data } = await api.get('/escaner/dispositivos');
  return data;
};

/** Escanea una página y la devuelve como File PNG (lista para enviarla a extraer). */
export const escanearPagina = async ({ dispositivoId, dpi = 300, modo = 'gris' }) => {
  const response = await api.post(
    '/escaner/escanear',
    { dispositivoId, dpi, modo },
    { responseType: 'blob', timeout: 200000, validateStatus: () => true },
  );
  if (response.status !== 200) {
    // Con responseType 'blob' el mensaje de error del backend también llega como blob.
    let mensaje = 'No se pudo escanear la página.';
    try {
      const cuerpo = JSON.parse(await response.data.text());
      mensaje = cuerpo.message || cuerpo.error || mensaje;
    } catch { /* respuesta sin JSON */ }
    throw new Error(mensaje);
  }
  const nombre = `escaneo_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  return new File([response.data], nombre, { type: 'image/png' });
};

/** Envía las páginas escaneadas (imágenes o PDF) y devuelve todas las preguntas encontradas. */
export const extraerPreguntasEscaneadas = async (paginas, cursoId) => {
  const formData = new FormData();
  paginas.forEach((pagina) => formData.append('paginas', pagina));
  formData.append('cursoId', cursoId);
  const { data } = await api.post('/escaner/extraer', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 15 * 60 * 1000,
  });
  return data;
};
