import { getExamenes, setExamenes, getPreguntas, getCursos, getCategorias, nextId, isoNow } from './demoStore';

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const letras = ['A','B','C','D','E'];

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const parseBlocks = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [{ tipo: 'texto', valor: String(value) }];
};

const plain = (value) => parseBlocks(value)
  .map(b => b.contenido ?? b.valor ?? b.texto ?? (b.tipo === 'imagen' ? '[Imagen]' : ''))
  .join(' ');

const contentHtml = (value, maxWidth = 250, maxHeight = 130) => parseBlocks(value).map(b => {
  const val = b.contenido ?? b.valor ?? b.texto ?? '';
  if (b.tipo === 'imagen') {
    return b.url
      ? `<img src="${escapeHtml(b.url)}" style="max-width:${maxWidth}px;max-height:${maxHeight}px;display:block;margin:6px auto;object-fit:contain">`
      : '';
  }
  if (b.tipo === 'latex') {
    return `<span style="font-family:serif;font-style:italic">${escapeHtml(val)}</span>`;
  }
  return `<span>${escapeHtml(val)}</span>`;
}).join('');

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
    const alts = p.alternativas.map(a => `<div style="margin:5px 0 7px 22px;break-inside:avoid"><b>${a.letra})</b> ${contentHtml(a.contenidoTexto, 170, 85)}${a.imagenUrl ? `<br><img src="${escapeHtml(a.imagenUrl)}" style="max-width:170px;max-height:85px;display:block;margin:5px auto;object-fit:contain">` : ''}</div>`).join('');
    const correct = p.alternativas.find(a => a.esCorrecta)?.letra || '-';
    return `<section style="break-inside:avoid;margin:0 0 14px"><div><b>${p.numeroOrden}.</b> ${contentHtml(p.enunciado, 250, 125)}</div>${p.imagenUrl ? `<img src="${escapeHtml(p.imagenUrl)}" style="max-width:250px;max-height:125px;display:block;margin:6px auto;object-fit:contain">` : ''}${solucionario ? `<div style="margin-left:22px"><b>Respuesta: ${correct}</b></div>` : alts}</section>`;
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

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

const loadScript = (src, globalName) => new Promise((resolve, reject) => {
  if (window[globalName]) {
    resolve(window[globalName]);
    return;
  }
  const existing = document.querySelector(`script[data-runtime-lib="${globalName}"]`);
  if (existing) {
    existing.addEventListener('load', () => resolve(window[globalName]), { once: true });
    existing.addEventListener('error', reject, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.dataset.runtimeLib = globalName;
  script.onload = () => resolve(window[globalName]);
  script.onerror = () => reject(new Error(`No se pudo cargar ${globalName}`));
  document.head.appendChild(script);
});

const waitForImages = async (root) => {
  const imgs = [...root.querySelectorAll('img')];
  await Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  }));
};

const htmlToPdfBlob = async (html) => {
  const html2canvas = await loadScript(
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'html2canvas'
  );
  const jspdfNs = await loadScript(
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
    'jspdf'
  );
  const { jsPDF } = jspdfNs;

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '0';
  wrapper.style.top = '0';
  wrapper.style.width = '794px';
  wrapper.style.minHeight = '1123px';
  wrapper.style.background = '#ffffff';
  wrapper.style.color = '#111111';
  wrapper.style.zIndex = '999999';
  wrapper.style.pointerEvents = 'none';
  wrapper.style.overflow = 'visible';

  const styles = [...parsed.head.querySelectorAll('style')]
    .map(s => s.textContent || '')
    .join('\n');

  const styleTag = document.createElement('style');
  styleTag.textContent = styles;
  wrapper.appendChild(styleTag);

  const content = document.createElement('div');
  content.innerHTML = parsed.body.innerHTML;
  wrapper.appendChild(content);
  document.body.appendChild(wrapper);

  try {
    await waitForImages(wrapper);
    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch {}
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(wrapper, {
      scale: 1.5,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 794,
      windowHeight: Math.max(wrapper.scrollHeight, 1123)
    });

    if (!canvas.width || !canvas.height) {
      throw new Error('No se pudo capturar el contenido del examen.');
    }

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const pxPerMm = canvas.width / usableWidth;
    const sliceHeightPx = Math.floor(usableHeight * pxPerMm);
    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height) {
      const currentSliceHeight = Math.min(sliceHeightPx, canvas.height - offsetY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = currentSliceHeight;

      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo preparar una página del PDF.');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0, offsetY, canvas.width, currentSliceHeight,
        0, 0, canvas.width, currentSliceHeight
      );

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.96);
      const renderedHeightMm = currentSliceHeight / pxPerMm;

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, margin, usableWidth, renderedHeightMm, undefined, 'FAST');

      offsetY += currentSliceHeight;
      pageIndex += 1;
    }

    return pdf.output('blob');
  } finally {
    wrapper.remove();
  }
};

export const descargarPdfVersion = async (examenId, version, customName = '') => {
  const e = await obtenerExamen(examenId);
  const v = await obtenerVersionExamen(examenId, version);
  const blob = await htmlToPdfBlob(htmlVersion(e, v, false));
  downloadBlob(blob, `${safeName(customName || e.nombre)}_Version_${safeName(version)}.pdf`);
};

export const descargarPdfsVersiones = async (examenId, customName = '') => {
  const e = await obtenerExamen(examenId);
  const JSZip = await loadScript(
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    'JSZip'
  );

  const zip = new JSZip();
  for (const v of e.versiones) {
    const blob = await htmlToPdfBlob(htmlVersion(e, v, false));
    zip.file(`${safeName(customName || e.nombre)}_Version_${safeName(v.codigoVersion)}.pdf`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `${safeName(customName || e.nombre)}_Versiones.zip`);
};

export const descargarPdfSolucionario = async (examenId, version, customName = '') => {
  const e = await obtenerExamen(examenId);
  const v = await obtenerVersionExamen(examenId, version);
  const blob = await htmlToPdfBlob(htmlVersion(e, v, true));
  downloadBlob(blob, `${safeName(customName || e.nombre)}_Solucionario_${safeName(version)}.pdf`);
};
