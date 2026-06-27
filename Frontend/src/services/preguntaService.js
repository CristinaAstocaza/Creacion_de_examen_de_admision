import api from './api';

export const listarPreguntas = async (params = {}) => {
  const { data } = await api.get('/preguntas', { params });
  return data;
};

export const obtenerPregunta = async (id) => {
  const { data } = await api.get(`/preguntas/${id}`);
  return data;
};

export const eliminarPregunta = async (id) => {
  await api.delete(`/preguntas/${id}`);
};

export const importarPdfTexto = async (file, cursoId) => {
  const formData = new FormData();
  formData.append('pdf', file);
  formData.append('cursoId', cursoId);
  
  const { data } = await api.post('/preguntas/importar/pdf-texto', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return data;
};

export const importarImagenes = async (files, cursoId) => {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('imagenes', files[i]);
  }
  formData.append('cursoId', cursoId);
  
  const { data } = await api.post('/preguntas/importar/imagenes', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return data;
};

export const uploadRecorte = async (blob) => {
  const formData = new FormData();
  formData.append('file', blob, 'recorte.png');
  const { data } = await api.post('/preguntas/importar/upload-recorte', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return data.url;
};

// Validar y normalizar NivelDificultad enum
const normalizarDificultad = (dificultad) => {
  const diffUpper = String(dificultad).toUpperCase().trim();
  if (['FACIL', 'MEDIO', 'DIFICIL'].includes(diffUpper)) {
    return diffUpper;
  }
  throw new Error(`Dificultad inválida: ${dificultad}. Debe ser FACIL, MEDIO o DIFICIL.`);
};

// Validar y normalizar LetraAlternativa enum
const normalizarLetra = (letra) => {
  const letraUpper = String(letra).toUpperCase().trim();
  if (['A', 'B', 'C', 'D', 'E'].includes(letraUpper)) {
    return letraUpper;
  }
  throw new Error(`Letra de alternativa inválida: ${letra}. Debe ser A, B, C, D o E.`);
};

// Validar y normalizar TipoAlternativa enum
const normalizarTipo = (tipo) => {
  const tipoUpper = String(tipo).toUpperCase().trim();
  if (['TEXTO', 'IMAGEN'].includes(tipoUpper)) {
    return tipoUpper;
  }
  throw new Error(`Tipo de alternativa inválido: ${tipo}. Debe ser TEXTO o IMAGEN.`);
};

export const crearPregunta = async ({
  codigo,
  enunciado,
  imagenUrl,
  tieneImagen,
  dificultad,
  activo,
  cursoId,
  alternativas
}) => {
  const payload = {
    codigo: codigo || null,
    enunciado,
    imagenUrl: imagenUrl || null,
    tieneImagen: tieneImagen === true,
    dificultad: normalizarDificultad(dificultad),
    activo: activo !== false,
    cursoId: Number(cursoId),
    alternativas: alternativas.map(alt => ({
      letra: normalizarLetra(alt.letra),
      tipo: normalizarTipo(alt.tipo || 'TEXTO'),
      contenidoTexto: alt.contenidoTexto || null,
      imagenUrl: alt.imagenUrl || null,
      esCorrecta: false,   // forzar false en importaciones
      ordenVisualizacion: alt.ordenVisualizacion !== undefined ? Number(alt.ordenVisualizacion) : null
    }))
  };

  const { data } = await api.post('/preguntas', payload);
  return data;
};

export const guardarLotePreguntas = async (preguntas) => {
  const payload = preguntas.map(pregunta => ({
    codigo: pregunta.codigo || null,
    enunciado: pregunta.enunciado,
    imagenUrl: pregunta.imagenUrl || null,
    tieneImagen: pregunta.tieneImagen === true,
    dificultad: normalizarDificultad(pregunta.dificultad || 'MEDIO'),
    activo: pregunta.activo !== false,
    cursoId: Number(pregunta.cursoId),
    alternativas: pregunta.alternativas.map((alt, index) => ({
      letra: normalizarLetra(alt.letra),
      tipo: normalizarTipo(alt.tipo || (alt.imagenUrl ? 'IMAGEN' : 'TEXTO')),
      contenidoTexto: alt.contenidoTexto || null,
      imagenUrl: alt.imagenUrl || null,
      esCorrecta: false,
      ordenVisualizacion: index + 1
    }))
  }));

  const { data } = await api.post('/preguntas/guardar', payload);
  return data;
};

export const actualizarPregunta = async (id, {
  codigo,
  enunciado,
  imagenUrl,
  dificultad,
  activo,
  cursoId,
  alternativas
}) => {
  const payload = {
    codigo: codigo || null,
    enunciado,
    imagenUrl: imagenUrl || null,
    dificultad: normalizarDificultad(dificultad),
    activo: activo !== false,
    cursoId: Number(cursoId),
    alternativas: alternativas.map(alt => ({
      letra: normalizarLetra(alt.letra),
      tipo: normalizarTipo(alt.tipo),
      contenidoTexto: alt.contenidoTexto || null,
      imagenUrl: alt.imagenUrl || null,
      esCorrecta: Boolean(alt.esCorrecta),
      ordenVisualizacion: alt.ordenVisualizacion !== undefined ? Number(alt.ordenVisualizacion) : null
    }))
  };

  const { data } = await api.put(`/preguntas/${id}`, payload);
  return data;
};
