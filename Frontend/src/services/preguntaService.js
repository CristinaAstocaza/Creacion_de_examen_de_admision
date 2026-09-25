import { getPreguntas, setPreguntas, getCursos, nextId, isoNow } from './demoStore';

const normalizarDificultad = (dificultad) => {
  const diffUpper = String(dificultad || 'MEDIO').toUpperCase().trim();
  if (['FACIL', 'MEDIO', 'DIFICIL'].includes(diffUpper)) return diffUpper;
  return 'MEDIO';
};

const normalizarLetra = (letra) => String(letra || '').toUpperCase().trim();
const normalizarTipo = (tipo) => String(tipo || 'TEXTO').toUpperCase() === 'IMAGEN' ? 'IMAGEN' : 'TEXTO';

const cursoNombre = (cursoId) => getCursos().find(c => Number(c.id) === Number(cursoId))?.nombre || 'Sin curso';

const mapPregunta = (payload, existingId = null) => ({
  id: existingId ?? nextId(getPreguntas()),
  codigo: payload.codigo || `PREG-${String(existingId ?? nextId(getPreguntas())).padStart(5, '0')}`,
  enunciado: payload.enunciado || '',
  imagenUrl: payload.imagenUrl || null,
  tieneImagen: Boolean(payload.tieneImagen || payload.imagenUrl),
  dificultad: normalizarDificultad(payload.dificultad),
  activo: payload.activo !== false,
  fechaCreacion: payload.fechaCreacion || isoNow(),
  cursoId: Number(payload.cursoId),
  cursoNombre: cursoNombre(payload.cursoId),
  alternativas: (payload.alternativas || []).map((alt, index) => ({
    id: alt.id ?? Number(`${existingId ?? Date.now()}${index + 1}`),
    letra: normalizarLetra(alt.letra) || ['A','B','C','D','E'][index],
    tipo: normalizarTipo(alt.tipo || (alt.imagenUrl ? 'IMAGEN' : 'TEXTO')),
    contenidoTexto: alt.contenidoTexto || null,
    imagenUrl: alt.imagenUrl || null,
    esCorrecta: Boolean(alt.esCorrecta),
    ordenVisualizacion: alt.ordenVisualizacion ?? index + 1,
    preguntaId: existingId,
  })),
});

export const listarPreguntas = async (params = {}) => {
  let items = getPreguntas();
  const search = String(params.search || params.busqueda || '').toLowerCase().trim();
  if (search) items = items.filter(p => String(p.codigo).toLowerCase().includes(search) || String(p.enunciado).toLowerCase().includes(search));
  if (params.cursoId) items = items.filter(p => Number(p.cursoId) === Number(params.cursoId));
  if (params.dificultad) items = items.filter(p => p.dificultad === params.dificultad);
  return items;
};

export const obtenerPregunta = async (id) => {
  const item = getPreguntas().find(p => Number(p.id) === Number(id));
  if (!item) throw new Error('Pregunta no encontrada');
  return item;
};

export const eliminarPregunta = async (id) => {
  setPreguntas(getPreguntas().filter(p => Number(p.id) !== Number(id)));
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const importarPdfTexto = async () => {
  throw new Error('Para PDF de texto usa la tarjeta Documento: el procesamiento se realiza localmente en el navegador.');
};

const readNetlifyResponse = async (response) => {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (data?.code === 'GEMINI_BUSY') {
      const err = new Error('GEMINI_BUSY');
      err.userMessage = data?.error;
      throw err;
    }
    if (response.status === 504) {
      throw new Error('TIMEOUT_NETLIFY');
    }
    if (response.status === 502 || response.status === 503) {
      throw new Error('TEMPORARY_NETLIFY');
    }
    throw new Error(data?.error || `Error del servidor (${response.status})`);
  }

  if (!data) throw new Error('La respuesta del servidor no fue válida.');
  return data;
};

export const importarImagenes = async (files, cursoId) => {
  const images = await Promise.all(files.map(async file => ({
    name: file.name,
    type: file.type || 'image/jpeg',
    data: await fileToDataUrl(file),
  })));

  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch('/.netlify/functions/ai-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ images, cursoId }),
      });
      return await readNetlifyResponse(response);
    } catch (error) {
      lastError = error;
      const code = error instanceof Error ? error.message : '';
      const retryable = code === 'GEMINI_BUSY' || code === 'TIMEOUT_NETLIFY' || code === 'TEMPORARY_NETLIFY';
      if (!retryable || attempt === 2) break;

      const waitMs = code === 'GEMINI_BUSY'
        ? 2500 + attempt * 1500
        : 1200 + attempt * 800;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  const code = lastError instanceof Error ? lastError.message : '';
  if (code === 'GEMINI_BUSY') {
    throw new Error('Gemini sigue saturado después de varios intentos. Espera unos segundos y vuelve a procesar la imagen.');
  }
  if (code === 'TIMEOUT_NETLIFY') {
    throw new Error('La IA tardó demasiado en responder. Se intentó nuevamente, pero Netlify agotó el tiempo de espera.');
  }
  if (code === 'TEMPORARY_NETLIFY') {
    throw new Error('Netlify está temporalmente ocupado. Intenta nuevamente en unos segundos.');
  }
  throw lastError instanceof Error ? lastError : new Error('No se pudieron procesar las imágenes');
};

export const uploadRecorte = async (blob) => {
  const dataUrl = await fileToDataUrl(blob);
  const response = await fetch('/.netlify/functions/ai-import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'upload', data: dataUrl }),
  });
  const data = await readNetlifyResponse(response);
  return data.url;
};

export const crearPregunta = async (payload) => {
  const items = getPreguntas();
  const id = nextId(items);
  const item = mapPregunta(payload, id);
  item.alternativas = item.alternativas.map(a => ({ ...a, preguntaId: id }));
  setPreguntas([...items, item]);
  return item;
};

export const guardarLotePreguntas = async (preguntas) => {
  const items = getPreguntas();
  let next = nextId(items);
  const nuevas = preguntas.map(payload => {
    const id = next++;
    const item = mapPregunta(payload, id);
    item.alternativas = item.alternativas.map(a => ({ ...a, preguntaId: id }));
    return item;
  });
  setPreguntas([...items, ...nuevas]);
  return nuevas;
};

export const actualizarPregunta = async (id, payload) => {
  const items = getPreguntas();
  const idx = items.findIndex(p => Number(p.id) === Number(id));
  if (idx < 0) throw new Error('Pregunta no encontrada');
  const item = mapPregunta({ ...items[idx], ...payload, fechaCreacion: items[idx].fechaCreacion }, Number(id));
  item.alternativas = item.alternativas.map(a => ({ ...a, preguntaId: Number(id) }));
  items[idx] = item;
  setPreguntas(items);
  return item;
};
