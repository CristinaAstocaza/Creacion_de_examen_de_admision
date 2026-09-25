import { getExamenes, setExamenes, getPreguntas, getCursos, getCategorias, nextId, isoNow } from './demoStore';

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const letras = ['A','B','C','D','E'];

const plain = (value) => {
  if (!value) return '';
  try {
    const blocks = JSON.parse(value);
    if (Array.isArray(blocks)) {
      return blocks.map(b => b.contenido || b.valor || b.texto || (b.tipo === 'imagen' ? '[Imagen]' : '')).join(' ');
    }
  } catch {}
  return String(value).replace(/<[^>]+>/g, '');
};

const buildVersion = (numero, codigoVersion, selected, randomQ, randomA) => {
  const preguntas = (randomQ ? shuffle(selected) : [...selected]).map((p, index) => {
    const sourceAlts = randomA ? shuffle(p.alternativas || []) : [...(p.alternativas || [])];
    const alts = sourceAlts.map((a, i) => ({
      ...a,
      letraOriginal: a.letra,
      letra: letras[i] || a.letra,
      ordenVisualizacion: i + 1,
    }));
    return {
      numeroOrden: index + 1,
      preguntaId: p.id,
      codigo: p.codigo,
      enunciado: p.enunciado,
      imagenUrl: p.imagenUrl || null,
      dificultad: p.dificultad,
      cursoNombre: p.cursoNombre,
      alternativasOrdenadas: alts.map(a => a.letraOriginal || a.letra).join(','),
      alternativas: alts,
    };
  });
  return { id: Date.now() + numero, numero, codigoVersion, fechaGeneracion: isoNow(), preguntas };
};

export const listarExamenes = async () => getExamenes();

export const obtenerExamen = async (examenId) => {
  const item = getExamenes().find(e => Number(e.id) === Number(examenId));
  if (!item) throw new Error('Examen no encontrado');
  return item;
};

export const obtenerSolucionario = async (examenId) => {
  const e = await obtenerExamen(examenId);
  return {
    examenId: e.id,
    versiones: e.versiones.map(v => ({
      codigoVersion: v.codigoVersion,
      respuestas: v.preguntas.map(p => ({
        numeroOrden: p.numeroOrden,
        codigo: p.codigo,
        respuesta: p.alternativas.find(a => a.esCorrecta)?.letra || '-',
      })),
    })),
  };
};

export const generarExamen = async ({
  idCategoria,
  nombreExamen,
  cantidadVersiones,
  aleatorizarPreguntas,
  aleatorizarAlternativas,
  cursos,
}) => {
  const preguntas = getPreguntas().filter(p => p.activo !== false);
  const selected = [];
  const cursosUsados = [];

  for (const req of cursos) {
    const pool = preguntas.filter(p => Number(p.cursoId) === Number(req.idCurso));
    if (pool.length < Number(req.cantidadTotal)) {
      const nombre = getCursos().find(c => Number(c.id) === Number(req.idCurso))?.nombre || 'curso';
      throw new Error(`Faltan preguntas en ${nombre}: necesitas ${req.cantidadTotal} y hay ${pool.length}.`);
    }
    selected.push(...shuffle(pool).slice(0, Number(req.cantidadTotal)));
    cursosUsados.push({
      idCurso: Number(req.idCurso),
      cursoNombre: getCursos().find(c => Number(c.id) === Number(req.idCurso))?.nombre || '',
      cantidadTotal: Number(req.cantidadTotal),
      cantidadFacil: Number(req.cantidadFacil || 0),
      cantidadMedio: Number(req.cantidadMedio || 0),
      cantidadDificil: Number(req.cantidadDificil || 0),
    });
  }

  const items = getExamenes();
  const id = nextId(items);
  const categoria = getCategorias().find(c => Number(c.id) === Number(idCategoria));
  const count = Math.max(1, Number(cantidadVersiones) || 1);
  const versiones = Array.from({ length: count }, (_, i) =>
    buildVersion(i + 1, letras[i] || String(i + 1), selected, aleatorizarPreguntas, aleatorizarAlternativas)
  );

  const examen = {
    id,
    codigo: `EXA-${String(id).padStart(5, '0')}`,
    nombre: nombreExamen || 'Examen de admisión',
    descripcion: null,
    duracionMinutos: 120,
    cantidadVersiones: count,
    aleatorizarPreguntas: Boolean(aleatorizarPreguntas),
    aleatorizarAlternativas: Boolean(aleatorizarAlternativas),
    estado: 'ACTIVO',
    fechaCreacion: isoNow(),
    fechaPublicacion: null,
    categoriaExamenId: Number(idCategoria),
    categoriaExamenNombre: categoria?.nombre || 'Sin categoría',
    cursosUsados,
    versiones,
  };
  setExamenes([examen, ...items]);
  return examen;
};

export const obtenerVersionExamen = async (examenId, version) => {
  const e = await obtenerExamen(examenId);
  const v = e.versiones.find(x => String(x.codigoVersion).toUpperCase() === String(version).toUpperCase());
  if (!v) throw new Error('Versión no encontrada');
  return v;
};

const cover = () => {
  try { return JSON.parse(localStorage.getItem('configuracionExamen') || '{}'); } catch { return {}; }
};

const htmlVersion = (exam, version, solucionario = false) => {
  const cfg = cover();
  const questions = version.preguntas.map(p => {
    const alts = p.alternativas.map(a => `<div style="margin:4px 0 4px 22px"><b>${a.letra})</b> ${plain(a.contenidoTexto)}${a.imagenUrl ? `<br><img src="${a.imagenUrl}" style="max-width:180px;max-height:90px">` : ''}</div>`).join('');
    const correct = p.alternativas.find(a => a.esCorrecta)?.letra || '-';
    return `<section style="break-inside:avoid;margin:0 0 14px"><div><b>${p.numeroOrden}.</b> ${plain(p.enunciado)}</div>${p.imagenUrl ? `<img src="${p.imagenUrl}" style="max-width:260px;max-height:130px;display:block;margin:6px auto">` : ''}${solucionario ? `<div style="margin-left:22px"><b>Respuesta: ${correct}</b></div>` : alts}</section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${exam.nombre}</title>
  <style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:11px;color:#111}.cover{height:250mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always}.q{column-count:2;column-gap:22px}h1{font-size:22px}h2{font-size:16px}</style></head><body>
  ${!solucionario ? `<div class="cover"><h2>${cfg.institutionName || 'SISTEMA DE ADMISIÓN'}</h2>${cfg.logoUrl ? `<img src="${cfg.logoUrl}" style="max-width:120px;max-height:120px">` : ''}<h1>${cfg.headerText || exam.nombre}</h1><h2>VERSIÓN ${version.codigoVersion}</h2><p>${cfg.modalidad || ''}</p><p>${cfg.instructions || 'Lea cuidadosamente cada pregunta y marque una alternativa.'}</p></div>` : `<h1>Solucionario - ${exam.nombre} - ${version.codigoVersion}</h1>`}
  <div class="q">${questions}</div></body></html>`;
};

const safeName = (value = 'examen') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9-_]+/g, '_')
  .replace(/^_+|_+$/g, '') || 'examen';

const downloadHtml = (html, filename) => {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const descargarPdfVersion = async (examenId, version, customName = '') => {
  const e = await obtenerExamen(examenId);
  const v = await obtenerVersionExamen(examenId, version);
  const filename = `${safeName(customName || e.nombre)}_Version_${safeName(version)}.html`;
  downloadHtml(htmlVersion(e, v, false), filename);
};

export const descargarPdfsVersiones = async (examenId, customName = '') => {
  const e = await obtenerExamen(examenId);
  const html = e.versiones.map(v => {
    const full = htmlVersion(e, v, false);
    const startBody = full.indexOf('<body>') + 6;
    const endBody = full.lastIndexOf('</body>');
    return startBody >= 6 && endBody > startBody ? full.slice(startBody, endBody) : full;
  }).join('<div style="page-break-before:always"></div>');
  const combined = `<!doctype html><html><head><meta charset="utf-8"><title>${e.nombre}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial;font-size:11px}.q{column-count:2;column-gap:22px}.cover{height:250mm;page-break-after:always;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}</style></head><body>${html}</body></html>`;
  downloadHtml(combined, `${safeName(customName || e.nombre)}_Todas_las_versiones.html`);
};

export const descargarPdfSolucionario = async (examenId, version, customName = '') => {
  const e = await obtenerExamen(examenId);
  const v = await obtenerVersionExamen(examenId, version);
  downloadHtml(htmlVersion(e, v, true), `${safeName(customName || e.nombre)}_Solucionario_${safeName(version)}.html`);
};
