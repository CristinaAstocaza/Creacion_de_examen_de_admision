import api from './api';

const leerConfiguracionCaratula = () => {
  const savedConfig = localStorage.getItem('configuracionExamen');
  if (!savedConfig) return null;
  try {
    const parsed = JSON.parse(savedConfig);
    return {
      nombreUniversidad: parsed.institutionName?.trim() || null,
      tituloExamen: parsed.headerText?.trim() || null,
      modalidad: parsed.modalidad?.trim() || null,
      colorPortada: parsed.colorPortada || null,
      logoUrl: parsed.logoUrl || null,
      instruccionesPortada: parsed.instructions?.trim() || null,
    };
  } catch {
    return null;
  }
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

export const descargarPdfVersion = (examenId, version, customName) => descargarArchivo(
  `/examenes/${examenId}/versiones/${version}/pdf`,
  `examen_version_${version}.pdf`,
  {
    method: 'post',
    body: leerConfiguracionCaratula(),
    customName,
  },
);

export const descargarPdfsVersiones = (examenId, customName) => descargarArchivo(
  `/examenes/${examenId}/pdfs`,
  'examen_versiones.zip',
  {
    customName,
  }
);

export const descargarPdfSolucionario = (examenId, version, customName) => descargarArchivo(
  `/examenes/${examenId}/versiones/${version}/solucionario-pdf`,
  `solucionario_version_${version}.pdf`,
  {
    customName,
  }
);
