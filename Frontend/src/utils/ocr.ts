/**
 * Reconocimiento de texto (OCR) en el navegador, SIN IA y SIN internet.
 * Usa tesseract.js con el motor y el idioma español servidos desde /ocr
 * (los copia scripts/copiar-recursos.mjs desde node_modules).
 *
 * Para mejorar la precisión:
 *  1. La imagen se agranda (Tesseract rinde mejor con letras de ~30 px), se pasa a grises y
 *     se binariza (blanco/negro con umbral de Otsu).
 *  2. Se detecta la distribución de la página (columnas, bloques) en vez de leerla como un solo bloque.
 *  3. Se descartan las líneas que son ruido de figuras (letras sueltas de vértices, rayas).
 *  4. Se corrigen confusiones típicas: "°" leído como "*", "%" o "9".
 *  5. Se detecta si la hoja tiene gráficos (tinta fuera de los bloques de texto) para avisar.
 */
import { createWorker, PSM, type Worker } from 'tesseract.js';
import { type Dominio, detectarDominio, corregirLineaCientifica, corregirVocabulario } from './correccionCientifica';
import { reconstruirMatematica, type Caja, type ImagenBinaria, type LineaOcr, type PalabraOcr } from './ocrMatematica';

export interface ResultadoOcr {
  texto: string;
  /** La hoja tiene dibujos o figuras que el OCR no puede convertir en texto. */
  tieneGraficos: boolean;
}

let workerPromise: Promise<Worker> | null = null;
let alProgresar: ((p: number) => void) | null = null;

const obtenerWorker = () => {
  if (!workerPromise) {
    const base = `${import.meta.env.BASE_URL}ocr`;
    workerPromise = createWorker('spa', 1, {
      workerPath: `${base}/worker.min.js`,
      corePath: base,
      langPath: base,
      gzip: true,
      workerBlobURL: false,
      logger: (m) => {
        if (m.status === 'recognizing text' && alProgresar) alProgresar(m.progress);
      },
    })
      .then(async (w) => {
        // Por defecto tesseract.js lee la hoja como UN solo bloque y mezcla figura, enunciado y columnas.
        await w.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
        return w;
      })
      .catch((e) => {
        workerPromise = null;
        throw e;
      });
  }
  return workerPromise;
};

// ─────────────────────────────────────────────
// 1. Preprocesamiento de la imagen
// ─────────────────────────────────────────────

/** 1 = píxel oscuro (tinta), 0 = fondo. */
type ImagenPreparada = ImagenBinaria;

const ANCHO_OBJETIVO = 2000;
const LADO_MAXIMO = 3500;

const cargarImagen = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('No se pudo cargar la imagen para el OCR.'));
  img.src = url;
});

/** Umbral de Otsu: separa automáticamente tinta y fondo según el histograma. */
const umbralOtsu = (histograma: number[], total: number) => {
  let suma = 0;
  for (let i = 0; i < 256; i++) suma += i * histograma[i];
  let sumaFondo = 0, pesoFondo = 0, mejor = 0, umbral = 128;
  for (let i = 0; i < 256; i++) {
    pesoFondo += histograma[i];
    if (!pesoFondo) continue;
    const pesoTinta = total - pesoFondo;
    if (!pesoTinta) break;
    sumaFondo += i * histograma[i];
    const mediaFondo = sumaFondo / pesoFondo;
    const mediaTinta = (suma - sumaFondo) / pesoTinta;
    const varianza = pesoFondo * pesoTinta * (mediaFondo - mediaTinta) ** 2;
    if (varianza > mejor) { mejor = varianza; umbral = i; }
  }
  return umbral;
};

const prepararImagen = async (url: string): Promise<ImagenPreparada> => {
  const img = await cargarImagen(url);
  const ladoMayor = Math.max(img.naturalWidth, img.naturalHeight);
  let escala = Math.min(3, Math.max(1, ANCHO_OBJETIVO / img.naturalWidth));
  if (ladoMayor * escala > LADO_MAXIMO) escala = LADO_MAXIMO / ladoMayor;

  const ancho = Math.round(img.naturalWidth * escala);
  const alto = Math.round(img.naturalHeight * escala);
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, ancho, alto);

  const datos = ctx.getImageData(0, 0, ancho, alto);
  const px = datos.data;
  const grises = new Uint8Array(ancho * alto);
  const histograma = new Array<number>(256).fill(0);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    grises[j] = g;
    histograma[g]++;
  }
  const umbral = umbralOtsu(histograma, grises.length);
  const tinta = new Uint8Array(grises.length);
  for (let i = 0, j = 0; j < grises.length; i += 4, j++) {
    const oscuro = grises[j] <= umbral;
    tinta[j] = oscuro ? 1 : 0;
    const v = oscuro ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  ctx.putImageData(datos, 0, 0);
  return { url: canvas.toDataURL('image/png'), ancho, alto, tinta };
};

// ─────────────────────────────────────────────
// 2–4. Limpieza del texto reconocido
// ─────────────────────────────────────────────

const ES_ALTERNATIVA = /^\s*\(?[A-Ea-e]\s*[).:-]/;
const ES_INICIO_PREGUNTA = /^\s*(?:pregunta\s*)?\d{1,3}\s*[.)-]/i;

/**
 * Letras de vértices o cotas sueltas de una figura ("B", "A 7", "A D") o rayas que no forman texto.
 * Nunca descarta alternativas, inicios de pregunta ni expresiones con operadores ("2x + 3 = 7").
 */
const esRuidoDeFigura = (linea: string) => {
  const t = linea.trim();
  if (!/[\p{L}\p{N}]/u.test(t)) return true; // solo símbolos o rayas
  if (ES_ALTERNATIVA.test(t) || ES_INICIO_PREGUNTA.test(t)) return false;
  if (/[=+×÷/<>()^√≤≥]/.test(t)) return false;
  const palabras = t.split(/\s+/);
  return palabras.length <= 3 && palabras.every((p) => p.replace(/[^\p{L}\p{N}]/gu, '').length <= 2);
};

/** Quita restos al borde de la línea: barras o guiones bajos que vienen de líneas de la figura. */
const limpiarBordes = (linea: string) => linea.replace(/^[|_~¦]+\s*/, '').replace(/\s*[|_~¦]+$/, '');

/** Sufijos con los que Tesseract suele confundir el símbolo de grado. */
const SUFIJO_GRADO = /^(\d{1,3}(?:[.,]\d+)?)\s*([°º*%”"'o?]{1,2})$/;

/**
 * Si las alternativas son medidas en grados, unifica el símbolo "°".
 * Ej.: "30*", "409", "35%", "20*", "25*"  →  "30°", "40°", "35°", "20°", "25°".
 * Si todas terminan en "%" se respeta (es un porcentaje de verdad).
 */
const corregirGradosEnAlternativas = (lineas: string[]) => {
  const todas = lineas
    .map((l, i) => ({ i, m: l.match(/^(\s*\(?([A-Ea-e])\s*[).:-]\s*)(.+?)\s*$/) }))
    .filter((a): a is { i: number; m: RegExpMatchArray } => !!a.m)
    .map((a) => ({ i: a.i, m: [a.m[0], a.m[1], a.m[3]] as unknown as RegExpMatchArray, letra: a.m[2].toUpperCase() }));
  // Cada pregunta por separado: un grupo nuevo empieza en la "A" (las alternativas de otra pregunta no influyen).
  const grupos: typeof todas[] = [];
  for (const a of todas) {
    if (a.letra === 'A' || !grupos.length) grupos.push([a]);
    else grupos[grupos.length - 1].push(a);
  }
  grupos.forEach((g) => corregirGradosEnGrupo(lineas, g));
};

const corregirGradosEnGrupo = (lineas: string[], alternativas: { i: number; m: RegExpMatchArray }[]) => {
  const conSufijo = alternativas
    .map((a) => ({ ...a, s: a.m[2].match(SUFIJO_GRADO) }))
    .filter((a) => a.s);
  if (conSufijo.length < 3) return;
  const sufijos = new Set(conSufijo.map((a) => a.s![2]));
  if (sufijos.size === 1 && sufijos.has('%')) return;
  const digitos = Math.max(...conSufijo.map((a) => a.s![1].length));

  for (const { i, m } of alternativas) {
    const valor = m[2];
    const s = valor.match(SUFIJO_GRADO);
    if (s) {
      lineas[i] = `${m[1]}${s[1]}°`;
    } else if (/^\d+9$/.test(valor) && valor.length === digitos + 1) {
      lineas[i] = `${m[1]}${valor.slice(0, -1)}°`; // "409" → "40°"
    } else if (/^\d{1,3}$/.test(valor) && valor.length <= digitos) {
      lineas[i] = `${m[1]}${valor}°`; // el OCR perdió el "°": "45" → "45°"
    }
  }
};

/**
 * Letras de la figura que quedan en la misma línea del texto, separadas por un hueco grande:
 * "A) 30°            R" → "A) 30°". Solo se cortan tramos finales de 1–2 caracteres por palabra.
 */
const quitarEtiquetasAlFinal = (linea: string) => {
  const tramos = linea.split(/\s{3,}/);
  // Texto justificado ("mediatrices      de      AC      y      BD"): huecos grandes entre TODAS las
  // palabras. No son etiquetas de una figura: solo se juntan los espacios.
  if (tramos.length > 2) return tramos.join(' ');
  if (tramos.length === 2) {
    const ultimo = tramos[1].trim();
    const corto = ultimo.split(/\s+/).every((p) => p.replace(/[^\p{L}\p{N}]/gu, '').length <= 2);
    // Nunca una alternativa ("D) 18°      E) 20°").
    if (corto && !ES_ALTERNATIVA.test(ultimo) && !/[=+×÷/<>()^√≤≥]/.test(ultimo)) return tramos[0];
  }
  return tramos.join('   ');
};

/**
 * Palabras que el OCR suele pegar en español: "Enel" → "En el", "Enlafigura" → "En la figura".
 * Para separar del resto se exige una palabra de 5+ letras (así "enlace" o "enlatado" no se tocan).
 */
const separarPalabrasPegadas = (linea: string) =>
  linea
    .replace(/(?<![\p{L}])([Ee])n(el|la|los|las)(?![\p{L}])/gu, '$1n $2')
    .replace(/(?<![\p{L}])([Ee])n(el|la|los|las)(\p{Ll}{5,})/gu, '$1n $2 $3');

/** "c)40" → "C)40": la letra de la alternativa siempre en mayúscula. */
const normalizarLetraAlternativa = (linea: string) =>
  linea.replace(/^(\s*\(?)([a-e])(\s*\))/, (_, a: string, letra: string, b: string) => a + letra.toUpperCase() + b);

/** Aplica `fn` solo al texto fuera de las fórmulas $...$ (las fórmulas reconstruidas no se tocan). */
const fueraDeFormulas = (linea: string, fn: (texto: string) => string) =>
  linea.split(/(\$[^$]+\$)/).map((parte, i) => (i % 2 === 1 ? parte : fn(parte))).join('');

/** "60*" o "60 *" después de un número casi siempre es "60°" (no es multiplicación si no sigue otro número). */
const corregirGradosEnTexto = (texto: string) => texto.replace(/(\d)\s?\*(?!\s*\d)/g, '$1°');

/**
 * @param dominio materia de las preguntas (química, física…). Si no se indica, se detecta por el texto.
 */
export const limpiarTextoOcr = (lineasCrudas: string[], dominio?: Dominio) => {
  const filtradas = lineasCrudas
    .map((l) => fueraDeFormulas(l, (t) => corregirVocabulario(normalizarLetraAlternativa(separarPalabrasPegadas(quitarEtiquetasAlFinal(limpiarBordes(t)))))))
    .filter((l) => l.trim() && !esRuidoDeFigura(l));
  // Alternativas en un mismo renglón ("A) 10° B) 9° C) 8°…"): una por línea, para corregirlas una a una.
  // También dos por renglón si las separa un hueco grande ("D) 18°      E) 20°").
  const separadas = filtradas.flatMap((l) =>
    ES_ALTERNATIVA.test(l) && (l.match(/(?:^|\s)\(?[A-Ea-e]\)/g) ?? []).length >= 3
      ? l.split(/\s+(?=\(?[A-Ea-e]\))/)
      : ES_ALTERNATIVA.test(l) ? l.split(/\s{2,}(?=\(?[A-E]\))/) : [l]);
  // Una línea que empieza con "=" o un operador continúa la anterior ("masas atómicas: H" / "= 1 C = 12").
  const unidas = separadas.reduce<string[]>((acc, l) => {
    if (acc.length && /^\s*[=+×÷]/.test(l)) acc[acc.length - 1] = `${acc[acc.length - 1].trimEnd()} ${l.trim()}`;
    else acc.push(l);
    return acc;
  }, []);
  const materia = dominio ?? detectarDominio(unidas.join('\n'));
  const lineas = unidas.map((l) => fueraDeFormulas(l, (t) => corregirLineaCientifica(t, materia)));
  corregirGradosEnAlternativas(lineas);
  return {
    lineas: lineas.map((l) => fueraDeFormulas(l, corregirGradosEnTexto)),
    descartadas: lineasCrudas.length - filtradas.length,
    dominio: materia,
  };
};

// ─────────────────────────────────────────────
// 5. ¿La hoja tiene gráficos?
// ─────────────────────────────────────────────


/** Porcentaje de tinta fuera de los bloques de texto (muestreado). Más de 1 % suele ser una figura. */
const tintaFueraDelTexto = (img: ImagenPreparada, cajas: Caja[]) => {
  const margen = 6;
  let fuera = 0, tinta = 0;
  for (let y = 0; y < img.alto; y += 3) {
    for (let x = 0; x < img.ancho; x += 3) {
      if (cajas.some((c) => x >= c.x0 - margen && x <= c.x1 + margen && y >= c.y0 - margen && y <= c.y1 + margen)) continue;
      fuera++;
      tinta += img.tinta[y * img.ancho + x];
    }
  }
  return fuera ? (100 * tinta) / fuera : 0;
};

const UMBRAL_GRAFICOS = 1;

// ─────────────────────────────────────────────
// 6. Segunda lectura en modo "texto disperso" y fusión
// ─────────────────────────────────────────────

export type { PalabraOcr, LineaOcr };

/** Fracción del área de `b` que queda dentro de `a`. */
const fraccionDentro = (a: Caja, b: Caja) => {
  const ancho = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const alto = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const area = Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0));
  return (ancho * alto) / area;
};

/** Palabras con poca confianza en la lectura principal se reemplazan por la otra lectura si es claramente mejor. */
const CONF_DUDOSA = 70;
const MEJORA_MINIMA = 15;

/**
 * Combina la lectura por bloques (buen orden de lectura) con la lectura de "texto disperso"
 * (encuentra textos sueltos junto a figuras):
 *  1. Palabras dudosas de la lectura principal se reemplazan por lo que la otra leyó en el mismo lugar
 *     (p. ej. segmentos con barra encima: "*CYBD" → "AQ y BD").
 *  2. Las alternativas que la lectura principal no vio (escondidas junto a la figura) se insertan
 *     en su lugar según su posición vertical.
 */
export const fusionarLecturas = (principal: LineaOcr[], dispersa: LineaOcr[]): LineaOcr[] => {
  const centro = (c: Caja) => (c.y0 + c.y1) / 2;
  const seSolapanEnX = (a: Caja, b: Caja) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0);

  const corregidas = principal.map((linea) => {
    let cambio = false;
    const textos = linea.palabras.map((p) => {
      if (p.conf >= CONF_DUDOSA) return p.texto;
      const alto = p.caja.y1 - p.caja.y0;
      // Solo la línea de la otra lectura que está a la misma altura (tolerancia de una línea de texto:
      // la barra de un segmento "AB" desplaza un poco la lectura). Nunca la línea de arriba o de abajo.
      const misma = dispersa
        .filter((l) => seSolapanEnX(l.caja, p.caja) && Math.abs(centro(l.caja) - centro(p.caja)) <= alto)
        .sort((a, b) => Math.abs(centro(a.caja) - centro(p.caja)) - Math.abs(centro(b.caja) - centro(p.caja)))[0];
      if (!misma) return p.texto;
      const zona = { x0: p.caja.x0 - 4, x1: p.caja.x1 + 4, y0: misma.caja.y0, y1: misma.caja.y1 };
      const candidatas = misma.palabras
        .filter((d) => fraccionDentro(zona, d.caja) > 0.6 && d.texto.trim())
        .sort((a, b) => a.caja.x0 - b.caja.x0);
      if (!candidatas.length) return p.texto;
      // El reemplazo debe ocupar un ancho parecido al de la palabra original.
      const anchoCandidatas = candidatas[candidatas.length - 1].caja.x1 - candidatas[0].caja.x0;
      const proporcion = anchoCandidatas / Math.max(1, p.caja.x1 - p.caja.x0);
      if (proporcion < 0.6 || proporcion > 1.6) return p.texto;
      const conf = candidatas.reduce((s, d) => s + d.conf, 0) / candidatas.length;
      if (conf < p.conf + MEJORA_MINIMA) return p.texto;
      cambio = true;
      return candidatas.map((d) => d.texto).join(' ');
    });
    return cambio
      ? { ...linea, texto: textos.join(' '), palabras: linea.palabras.map((p, i) => ({ ...p, texto: textos[i] })) }
      : linea;
  });

  const recuperadas = dispersa
    .filter((l) => ES_ALTERNATIVA.test(l.texto) && !principal.some((p) => fraccionDentro(p.caja, l.caja) > 0.3))
    .sort((a, b) => a.caja.y0 - b.caja.y0);

  const resultado = [...corregidas];
  for (const r of recuperadas) {
    let pos = 0;
    resultado.forEach((l, i) => { if (l.caja.y0 <= r.caja.y0) pos = i + 1; });
    resultado.splice(pos, 0, r);
  }
  return resultado;
};

interface BloqueTesseract {
  paragraphs: { lines: { text: string; bbox: Caja; words: { text: string; bbox: Caja; confidence: number }[] }[] }[];
}

const extraerLineas = (bloques: BloqueTesseract[] | null | undefined): LineaOcr[] =>
  (bloques ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) => ({
    texto: l.text.replace(/\s+$/, ''),
    caja: l.bbox,
    palabras: l.words.map((w) => ({ texto: w.text, caja: w.bbox, conf: w.confidence })),
  }))));

/**
 * Lee el texto de una imagen (URL, blob: o data:). `onProgreso` recibe un valor entre 0 y 1.
 */
export const leerTextoDeImagen = async (
  url: string,
  onProgreso?: (p: number) => void,
  /** Materia (según el curso destino). Si no se indica, se detecta por el texto. */
  dominio?: Dominio,
): Promise<ResultadoOcr> => {
  const [worker, imagen] = await Promise.all([obtenerWorker(), prepararImagen(url)]);
  try {
    // 1ª lectura: distribución automática de la página (párrafos en orden).
    alProgresar = (p) => onProgreso?.(p * 0.5);
    const primera = await worker.recognize(imagen.url, {}, { text: true, blocks: true });
    let lineas = extraerLineas(primera.data.blocks as BloqueTesseract[] | null);
    const cajas = lineas.filter((l) => !esRuidoDeFigura(limpiarBordes(l.texto))).map((l) => l.caja);
    const hayFigura = tintaFueraDelTexto(imagen, cajas) > UMBRAL_GRAFICOS;
    const hayDudas = lineas.some((l) => l.palabras.some((p) => p.conf < CONF_DUDOSA));

    // 2ª lectura (solo si hace falta): texto disperso, encuentra lo que quedó junto a figuras.
    if (lineas.length && (hayFigura || hayDudas)) {
      alProgresar = (p) => onProgreso?.(0.5 + p * 0.5);
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      try {
        const segunda = await worker.recognize(imagen.url, {}, { text: true, blocks: true });
        lineas = fusionarLecturas(lineas, extraerLineas(segunda.data.blocks as BloqueTesseract[] | null));
      } finally {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      }
    }

    // Fracciones y segmentos con barra encima: se reconstruyen a partir de la geometría de la imagen.
    if (lineas.length) lineas = await reconstruirMatematica(worker, imagen, lineas);

    const crudas = lineas.length ? lineas.map((l) => l.texto) : primera.data.text.split('\n');
    const { lineas: limpias, descartadas } = limpiarTextoOcr(crudas, dominio);
    return { texto: limpias.join('\n'), tieneGraficos: hayFigura || descartadas > 0 };
  } finally {
    alProgresar = null;
  }
};
