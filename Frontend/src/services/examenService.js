import api from './api';
import { obtenerCaratula, caratulaCompleta, caratulaAPayload, modalidadIdPorNombre } from '../utils/caratulas';

/**
 * Carátula guardada para el área + modalidad del examen (Configuración).
 * Si no existe se envía null y el backend usa la carátula con la que se generó.
 * @param {{ categoriaExamenId?: number, tipoPrueba?: string } | null | undefined} examen
 */
const leerConfiguracionCaratula = (examen) => {
  if (!examen) return null;
  const caratula = obtenerCaratula(examen.categoriaExamenId, modalidadIdPorNombre(examen.tipoPrueba));
  return caratulaCompleta(caratula) ? caratulaAPayload(caratula) : null;
};

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
  cursos,
  nombreUniversidad,
  tituloExamen,
  modalidad,
  colorPortada,
  logoUrl,
  instruccionesPortada,
  tipoPrueba,
  formatoHoja,
  codigosVersion,
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
    })),
    nombreUniversidad: nombreUniversidad || null,
    tituloExamen: tituloExamen || null,
    modalidad: modalidad || null,
    colorPortada: colorPortada || null,
    logoUrl: logoUrl || null,
    instruccionesPortada: instruccionesPortada || null,
    tipoPrueba: tipoPrueba || null,
    formatoHoja: formatoHoja || 'A4',
    codigosVersion: codigosVersion && codigosVersion.length ? codigosVersion : null,
  });
  return data;
};

/** Cambia la letra (tema) de una versión ya generada, p. ej. de "A" a "P". */
export const cambiarTemaVersion = async (examenId, versionActual, nuevoTema) => {
  const { data } = await api.put(`/examenes/${examenId}/versiones/${versionActual}/tema`, {
    codigoVersion: nuevoTema,
  });
  return data;
};

export const obtenerVersionExamen = async (examenId, version) => {
  const { data } = await api.get(`/examenes/${examenId}/versiones/${version}`);
  return data;
};

const descargarArchivo = async (url, nombreFallback, config = {}) => {
  const { method = 'get', body = null, customName = '' } = config;
  const response = method === 'post'
    ? await api.post(url, body, { responseType: 'blob' })
    : await api.get(url, { responseType: 'blob' });
  const disposition = response.headers['content-disposition'];
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  const backendFilename = match?.[1] || nombreFallback;
  
  // Extract extension
  const extMatch = backendFilename.match(/\.[0-9a-z]+$/i);
  const extension = extMatch ? extMatch[0] : '';
  
  let filename = backendFilename;
  if (customName && customName.trim()) {
    filename = `${customName.trim()}${extension}`;
  } else {
    filename = `Examen${extension}`;
  }

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};

/**
 * Pide al backend el mismo PDF que se descarga y devuelve una URL local (blob:)
 * para mostrarlo en la vista previa. Quien la use debe liberarla con URL.revokeObjectURL.
 */
export const obtenerPdfVersionUrl = async (examenId, version, examen) => {
  const response = await api.post(
    `/examenes/${examenId}/versiones/${version}/pdf`,
    leerConfiguracionCaratula(examen),
    { responseType: 'blob' },
  );
  return window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
};

/** Descarga una versión como "<nombre> - Version <tema>.pdf". */
export const descargarPdfVersion = (examenId, version, customName, examen) => descargarArchivo(
  `/examenes/${examenId}/versiones/${version}/pdf`,
  `examen_version_${version}.pdf`,
  {
    method: 'post',
    body: leerConfiguracionCaratula(examen),
    customName: `${(customName || 'Examen').trim()} - Version ${version}`,
  },
);

/** ZIP con todas las versiones; dentro, cada PDF se llama "<nombre>_Version_<tema>.pdf". */
export const descargarPdfsVersiones = (examenId, customName, examen) => descargarArchivo(
  `/examenes/${examenId}/pdfs`,
  'examen_versiones.zip',
  {
    method: 'post',
    body: leerConfiguracionCaratula(examen),
    customName,
  }
);

