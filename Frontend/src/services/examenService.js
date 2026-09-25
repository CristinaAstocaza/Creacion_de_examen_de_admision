import katex from 'katex';
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
  let current = value;

  for (let i = 0; i < 4; i += 1) {
    if (Array.isArray(current)) return current;
    if (typeof current !== 'string') break;

    try {
      const parsed = JSON.parse(current);
      current = parsed;
    } catch {
      break;
    }
  }

  if (Array.isArray(current)) return current;
  if (current && typeof current === 'object' && current.tipo) return [current];

  return [{ tipo: 'texto', valor: String(current ?? value) }];
};

const plain = (value) => parseBlocks(value)
  .map(b => b.contenido ?? b.valor ?? b.texto ?? (b.tipo === 'imagen' ? '[Imagen]' : ''))
  .join(' ');

const getImageUrlsFromBlocks = (value) =>
  [...new Set(
    parseBlocks(value)
      .filter(b => b?.tipo === 'imagen' && b?.url)
      .map(b => String(b.url))
  )];

const getFirstImageFromBlocks = (value) => getImageUrlsFromBlocks(value)[0] || null;

const renderLatex = (expr = '') => {
  try {
    const clean = String(expr)
      .replace(/\$\$/g, '')
      .replace(/^\$|\$/g, '')
      .trim();
    return katex.renderToString(clean, {
      throwOnError: false,
      displayMode: false,
      output: 'html'
    });
  } catch {
    return `<span>${escapeHtml(expr)}</span>`;
  }
};

const looksLikeLatex = (value = '') => {
  const text = String(value);
  return /\\[a-zA-Z]+|[_^]\{?[^\s]+|\\frac|\\sqrt|\\rho|\\theta|\\pi|\\Delta/.test(text);
};

const looksLikePureLatex = (value = '') => {
  const text = String(value).trim();
  if (!looksLikeLatex(text)) return false;
  const proseWords = text.match(/[A-Za-zÁÉÍÓÚáéíóúÑñ]{4,}/g) || [];
  return proseWords.length <= 2 || /^[\\A-Za-z0-9_{}^=+\-*/().,<>\s]+$/.test(text);
};

const renderMixedText = (value = '') => {
  let html = escapeHtml(String(value));
  html = html
    .replace(/\\,/g, ' ')
    .replace(/\\text\s*\{([^{}]+)\}/g, '$1')
    .replace(/\\rho/g, 'ρ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\pi/g, 'π')
    .replace(/\\Delta/g, 'Δ')
    .replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>')
    .replace(/_([A-Za-z0-9]+)/g, '<sub>$1</sub>')
    .replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>')
    .replace(/\^([A-Za-z0-9]+)/g, '<sup>$1</sup>');
  return html;
};

const contentHtml = (value, maxWidth = 250, maxHeight = 130, options = {}) => {
  const { allowImages = true } = options;
  return parseBlocks(value).map(b => {
    const val = b.contenido ?? b.valor ?? b.texto ?? '';

    if (b.tipo === 'imagen') {
      if (!allowImages) return '';
      return b.url
        ? `<img src="${escapeHtml(b.url)}" style="max-width:${maxWidth}px;max-height:${maxHeight}px;display:block;margin:6px auto;object-fit:contain">`
        : '';
    }

    // Algunos registros antiguos tienen otro JSON serializado dentro de "valor/contenido".
    if (typeof val === 'string' && /^\s*[\[{]/.test(val)) {
      const nested = parseBlocks(val);
      const isRealNested = !(nested.length === 1 && nested[0]?.tipo === 'texto' && nested[0]?.valor === val);
      if (isRealNested) {
        return contentHtml(val, maxWidth, maxHeight, options);
      }
    }

    if (b.tipo === 'latex' || looksLikePureLatex(val)) {
      return `<span class="math-inline">${renderLatex(val)}</span>`;
    }
    return `<span>${renderMixedText(val)}</span>`;
  }).join('');
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

const contrastColor = (hex = '#ffffff') => {
  const clean = String(hex).replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#111827';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#111827' : '#ffffff';
};

const htmlVersion = (exam, version, solucionario = false) => {
  const cfg = cover();
  const coverBg = cfg.colorPortada || '#6366f1';
  const coverFg = contrastColor(coverBg);

  const grouped = {};
  version.preguntas.forEach(p => {
    const curso = p.cursoNombre || 'OTROS';
    if (!grouped[curso]) grouped[curso] = [];
    grouped[curso].push(p);
  });

  const courseSections = Object.entries(grouped).map(([curso, preguntas]) => {
    const items = preguntas.map(p => {
      const altItems = p.alternativas.map(a => {
        const blockImage = getFirstImageFromBlocks(a.contenidoTexto);
        const finalAltImage = a.imagenUrl || blockImage;
        return {
          html: `
            <div class="alt">
              <span class="alt-letter">${a.letra})</span>
              <div class="alt-content">
                ${contentHtml(a.contenidoTexto, 160, 80, { allowImages: false })}
                ${finalAltImage ? `<img src="${escapeHtml(finalAltImage)}" class="alt-image">` : ''}
              </div>
            </div>`,
          hasImage: Boolean(finalAltImage),
          length: plain(a.contenidoTexto).length
        };
      });

      const alts = altItems.map(a => a.html).join('');

      const correct = p.alternativas.find(a => a.esCorrecta)?.letra || '-';

      const blockImages = getImageUrlsFromBlocks(p.enunciado);
      const questionImages = [...new Set([
        ...blockImages,
        ...(p.imagenUrl && !blockImages.includes(p.imagenUrl) ? [p.imagenUrl] : [])
      ])];

      return `
        <article class="question">
          <div class="question-line">
            <span class="q-number">${p.numeroOrden}.</span>
            <div class="q-body">
              <div class="q-statement">
                ${contentHtml(p.enunciado, 235, 120, { allowImages: false })}
              </div>
              ${questionImages.length ? `
                <div class="question-images images-${Math.min(questionImages.length, 4)}">
                  ${questionImages.map((url, index) => `
                    <div class="question-figure">
                      <img src="${escapeHtml(url)}" class="question-image" alt="Figura ${index + 1}">
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${solucionario
                ? `<div class="solution">Respuesta: ${correct}</div>`
                : `<div class="alternatives">${alts}</div>`
              }
            </div>
          </div>
        </article>`;
    });


    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push(`
        <div class="question-row">
          <div class="question-cell">${items[i] || ''}</div>
          <div class="question-cell">${items[i + 1] || ''}</div>
        </div>
      `);
    }
    return `
      <section class="course-block">
        <div class="course-title">${escapeHtml(String(curso).toUpperCase())}</div>
        <div class="course-question-grid">
          ${rows.join('')}
        </div>
      </section>`;
  }).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(exam.nombre)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #111827; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .math-inline { display: inline-block; vertical-align: middle; }
    .katex { font-size: 1em; }
    .katex .katex-mathml { position: absolute; clip: rect(1px,1px,1px,1px); padding: 0; border: 0; height: 1px; width: 1px; overflow: hidden; }

    .cover {
      width: 100%;
      min-height: 1123px;
      page-break-after: always;
      break-after: page;
      background: ${coverBg};
      color: ${coverFg};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 70px 90px;
      position: relative;
    }
    .cover-inner { width: 100%; max-width: 620px; }
    .cover-institution {
      font-size: 19px;
      font-weight: 700;
      letter-spacing: .8px;
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    .cover-logo {
      max-width: 115px;
      max-height: 115px;
      object-fit: contain;
      margin: 0 auto 26px;
      display: block;
      background: rgba(255,255,255,.92);
      padding: 6px;
      border-radius: 10px;
    }
    .cover-title {
      font-size: 31px;
      line-height: 1.15;
      font-weight: 800;
      text-transform: uppercase;
      margin: 0 0 20px;
    }
    .cover-version {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 140px;
      padding: 10px 22px;
      margin: 4px 0 18px;
      border: 2px solid currentColor;
      border-radius: 10px;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 1px;
    }
    .cover-modality {
      font-size: 15px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 26px;
    }
    .cover-instructions {
      max-width: 560px;
      margin: 0 auto;
      padding: 16px 18px;
      border: 1px solid currentColor;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.55;
      background: rgba(255,255,255,.08);
    }
    .cover-footer {
      position: absolute;
      left: 70px;
      right: 70px;
      bottom: 42px;
      font-size: 12px;
      opacity: .88;
    }

    .exam-pages {
      padding: 20px 26px 26px;
      background: #fff;
    }
    .exam-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      border-bottom: 2px solid #111827;
      padding-bottom: 7px;
      margin-bottom: 14px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .questions-columns {
      display: block;
      width: 100%;
    }
    .course-block {
      break-inside: auto;
      margin-bottom: 16px;
    }
    .course-question-grid { display: block; width: 100%; }
    .question-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 0 22px;
      align-items: start;
      width: 100%;
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 10px;
    }
    .question-cell {
      min-width: 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .course-title {
      break-after: avoid;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .8px;
      color: #1e3a8a;
      border-bottom: 1px solid #cbd5e1;
      padding: 3px 0 5px;
      margin: 5px 0 9px;
    }
    .question {
      break-inside: avoid;
      page-break-inside: avoid;
      margin: 0;
      padding: 0 0 2px;
      font-size: 10.2px;
      line-height: 1.36;
    }
    .question-line { display: flex; align-items: flex-start; gap: 5px; }
    .q-number { font-weight: 800; min-width: 19px; }
    .q-body { flex: 1; min-width: 0; }
    .q-statement { font-weight: 500; text-align: left; }
    .q-statement + .question-images { margin-top: 8px; }
    .question-images {
      display: grid;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin: 7px auto 6px;
      width: 100%;
      break-inside: avoid;
    }
    .question-images.images-1 {
      grid-template-columns: minmax(0, 190px);
    }
    .question-images.images-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      max-width: 100%;
      gap: 8px;
    }
    .question-images.images-3,
    .question-images.images-4 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      max-width: 100%;
      gap: 6px 8px;
    }
    .question-figure {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 74px;
      padding: 0;
      background: transparent;
      border: 0;
    }
    .question-image {
      display: block;
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 108px;
      object-fit: contain;
      margin: 0 auto;
    }
    .question-images.images-1 .question-image {
      max-width: 165px;
      max-height: 112px;
    }
    .question-images.images-2 .question-image {
      max-height: 105px;
    }
    .alternatives {
      margin-top: 6px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .alternatives-columns {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 0 22px;
      align-items: start;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .alt-column {
      min-width: 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .alt {
      display: flex;
      align-items: flex-start;
      gap: 5px;
      margin: 4px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .alt-letter { font-weight: 800; min-width: 18px; }
    .alt-content { flex: 1; min-width: 0; }
    .alt-image {
      display: block;
      max-width: 100px;
      max-height: 48px;
      object-fit: contain;
      margin: 3px 0 2px 1px;
    }
    .solution {
      margin-top: 6px;
      font-weight: 800;
      color: #166534;
    }
  </style>
</head>
<body>
  ${!solucionario ? `
    <section class="cover">
      <div class="cover-inner">
        <div class="cover-institution">${escapeHtml(cfg.institutionName || 'INSTITUCIÓN EDUCATIVA')}</div>
        ${cfg.logoUrl ? `<img src="${escapeHtml(cfg.logoUrl)}" class="cover-logo">` : ''}
        <div class="cover-title">${escapeHtml(cfg.headerText || exam.nombre || 'EXAMEN DE ADMISIÓN')}</div>
        <div class="cover-version">VERSIÓN ${escapeHtml(version.codigoVersion)}</div>
        <div class="cover-modality">${escapeHtml(cfg.modalidad || 'MODALIDAD ORDINARIO')}</div>
        <div class="cover-instructions">
          <strong>Instrucciones</strong><br>
          ${escapeHtml(cfg.instructions || 'Lea cuidadosamente cada pregunta y marque solo una alternativa.')}
        </div>
      </div>
      <div class="cover-footer">${escapeHtml(cfg.footerText || exam.nombre || 'Examen de admisión')}</div>
    </section>
  ` : ''}

  <main class="exam-pages">
    <div class="exam-topbar">
      <span>${escapeHtml(cfg.institutionName || 'INSTITUCIÓN EDUCATIVA')}</span>
      <span>${escapeHtml(cfg.headerText || exam.nombre)} · VERSIÓN ${escapeHtml(version.codigoVersion)}</span>
    </div>
    <div class="questions-columns">
      ${courseSections}
    </div>
  </main>
</body>
</html>`;
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

const insertPdfPageSpacers = (root, pageHeight = 1123) => {
  const rows = [...root.querySelectorAll('.question-row')];
  for (const row of rows) {
    const rootTop = root.getBoundingClientRect().top;
    const rect = row.getBoundingClientRect();
    const top = rect.top - rootTop;
    const height = rect.height;
    const pageBottom = (Math.floor(top / pageHeight) + 1) * pageHeight;

    if (height < pageHeight * 0.9 && top + height > pageBottom - 10) {
      const spacer = document.createElement('div');
      spacer.className = 'pdf-page-spacer';
      spacer.style.height = `${Math.max(0, pageBottom - top + 12)}px`;
      spacer.style.breakBefore = 'page';
      row.parentNode?.insertBefore(spacer, row);
    }
  }
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
    insertPdfPageSpacers(wrapper, 1123);
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
    const usableWidth = pageWidth;
    const usableHeight = pageHeight;

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
      pdf.addImage(imgData, 'JPEG', 0, 0, usableWidth, renderedHeightMm, undefined, 'FAST');

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
