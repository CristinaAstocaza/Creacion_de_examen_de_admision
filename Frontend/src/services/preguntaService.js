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

export const importarImagenes = async (files, cursoId) => {
  const images = await Promise.all(files.map(async file => ({
    name: file.name,
    type: file.type || 'image/jpeg',
    data: await fileToDataUrl(file),
  })));

  const response = await fetch('/.netlify/functions/ai-import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ images, cursoId }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'No se pudieron procesar las imágenes');
  return data;
};

export const uploadRecorte = async (blob) => {
  const dataUrl = await fileToDataUrl(blob);
  const response = await fetch('/.netlify/functions/ai-import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'upload', data: dataUrl }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'No se pudo subir el recorte');
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
