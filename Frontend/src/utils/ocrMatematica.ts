/**
 * Reconstrucción de notación matemática en dos dimensiones que el OCR lee línea por línea y destroza:
 *  - Fracciones (numerador / barra / denominador): "m<ABC / 4"  →  $\frac{m\angle ABC}{4}$
 *  - Barras encima (segmentos, AC con raya arriba):              →  $\overline{AC}$
 *
 * Método: se buscan en la imagen binarizada barras horizontales finas. Si hay texto arriba y abajo es una
 * fracción; si solo hay texto debajo, pegado, es una barra encima. Cada parte se vuelve a leer por separado
 * (una sola línea de texto) y se arma la fórmula LaTeX, que el editor y el PDF ya muestran.
 */
import { PSM, type Worker } from 'tesseract.js';

export interface Caja { x0: number; y0: number; x1: number; y1: number }
export interface PalabraOcr { texto: string; caja: Caja; conf: number }
export interface LineaOcr { texto: string; caja: Caja; palabras: PalabraOcr[] }
/** Imagen preparada para el OCR: `tinta[i] = 1` si el píxel es oscuro. */
export interface ImagenBinaria { url: string; ancho: number; alto: number; tinta: Uint8Array }

interface Barra extends Caja {
  tipo: 'fraccion' | 'sobre';
  arriba?: Caja;
  abajo: Caja;
}

const alto = (c: Caja) => c.y1 - c.y0 + 1;
const ancho = (c: Caja) => c.x1 - c.x0 + 1;
const centroY = (c: Caja) => (c.y0 + c.y1) / 2;
const centroX = (c: Caja) => (c.x0 + c.x1) / 2;
const union = (a: Caja, b: Caja): Caja => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

/** Altura típica de una palabra (referencia de escala para todos los umbrales). */
export const alturaDeTexto = (lineas: LineaOcr[]) => {
  const alturas = lineas.flatMap((l) => l.palabras)
    .filter((p) => p.conf > 60 && p.texto.length >= 2)
    .map((p) => alto(p.caja))
    .sort((a, b) => a - b);
  return alturas.length ? alturas[alturas.length >> 1] : 40;
};

// ─────────────────────────────────────────────
// Detección de barras
// ─────────────────────────────────────────────

/** Tramos horizontales de tinta largos y finos, agrupados en rectángulos. */
const buscarTramosHorizontales = (img: ImagenBinaria, minLargo: number, maxGrosor: number): Caja[] => {
  const abiertas: Caja[] = [];
  const cerradas: Caja[] = [];
  for (let y = 0; y < img.alto; y++) {
    const fila = y * img.ancho;
    let x = 0;
    while (x < img.ancho) {
      if (!img.tinta[fila + x]) { x++; continue; }
      const inicio = x;
      while (x < img.ancho && img.tinta[fila + x]) x++;
      const fin = x - 1;
      if (fin - inicio + 1 < minLargo) continue;
      const r = abiertas.find((a) => a.y1 === y - 1
        && Math.min(a.x1, fin) - Math.max(a.x0, inicio) >= 0.8 * Math.min(ancho(a), fin - inicio + 1));
      if (r) { r.y1 = y; r.x0 = Math.min(r.x0, inicio); r.x1 = Math.max(r.x1, fin); }
      else abiertas.push({ x0: inicio, x1: fin, y0: y, y1: y });
    }
    for (let i = abiertas.length - 1; i >= 0; i--) {
      if (abiertas[i].y1 < y) cerradas.push(...abiertas.splice(i, 1));
    }
  }
  cerradas.push(...abiertas);
  return cerradas.filter((c) => alto(c) <= maxGrosor && ancho(c) <= img.ancho * 0.5);
};

/**
 * Bloque de tinta junto a la barra (hacia arriba dir=-1 o abajo dir=+1), dentro de su ancho.
 * Se detiene en el primer hueco blanco después del texto. `terminado` indica que encontró ese hueco
 * (un texto real lo tiene; las líneas de una figura siguen de largo).
 */
const bloqueJunto = (img: ImagenBinaria, b: Caja, dir: 1 | -1, h: number) => {
  const margen = Math.round(h * 0.05);
  const x0 = Math.max(0, b.x0 - margen);
  const x1 = Math.min(img.ancho - 1, b.x1 + margen);
  const desde = dir === 1 ? b.y1 + 1 : b.y0 - 1;
  const maximo = Math.round(h * 1.8);
  const primeraMax = Math.round(h * 0.7);
  const hueco = Math.max(2, Math.round(h * 0.2));
  let caja: Caja | null = null;
  let blancas = 0;
  for (let k = 0; k < maximo; k++) {
    const y = desde + dir * k;
    if (y < 0 || y >= img.alto) break;
    let minx = Infinity, maxx = -1;
    for (let x = x0; x <= x1; x++) {
      if (img.tinta[y * img.ancho + x]) { if (x < minx) minx = x; maxx = x; }
    }
    if (maxx >= 0) {
      blancas = 0;
      const fila = { x0: minx, x1: maxx, y0: y, y1: y };
      caja = caja ? union(caja, fila) : fila;
    } else if (caja) {
      if (++blancas >= hueco) {
        // Una mota (punta de un "=" vecino, polvo del escaneo) no es texto: se descarta y se sigue buscando.
        if (alto(caja) < h * 0.2 && ancho(caja) < h * 0.3) { caja = null; blancas = 0; continue; }
        return { caja, terminado: true, distancia: dir === 1 ? caja.y0 - b.y1 : b.y0 - caja.y1 };
      }
    } else if (k > primeraMax) {
      return null;
    }
  }
  return caja ? { caja, terminado: false, distancia: dir === 1 ? caja.y0 - b.y1 : b.y0 - caja.y1 } : null;
};

/** Barras de fracción y barras encima (vínculos) de la imagen. */
export const detectarBarras = (img: ImagenBinaria, h: number): Barra[] => {
  const minLargo = Math.max(18, Math.round(h * 0.9));
  const maxGrosor = Math.max(4, Math.round(h * 0.18));
  const pareceTexto = (r: ReturnType<typeof bloqueJunto>) =>
    !!r && r.terminado && alto(r.caja) >= h * 0.3 && alto(r.caja) <= h * 1.5;

  // Una barra de fracción o de segmento termina "en el aire". Un tramo de una línea de figura sigue
  // (se une a otras líneas o continúa en diagonal): tiene tinta pegada a sus extremos.
  const sep = Math.max(2, Math.round(h * 0.06));
  const extremoLibre = (b: Caja, lado: -1 | 1) => {
    const xs = lado === -1 ? [b.x0 - sep, b.x0 - 1] : [b.x1 + 1, b.x1 + sep];
    for (let y = Math.max(0, b.y0 - sep); y <= Math.min(img.alto - 1, b.y1 + sep); y++) {
      for (let x = Math.max(0, xs[0]); x <= Math.min(img.ancho - 1, xs[1]); x++) {
        if (img.tinta[y * img.ancho + x]) return false;
      }
    }
    return true;
  };

  const barras: Barra[] = [];
  for (const b of buscarTramosHorizontales(img, minLargo, maxGrosor)) {
    if (!extremoLibre(b, -1) || !extremoLibre(b, 1)) continue;
    const arriba = bloqueJunto(img, b, -1, h);
    const abajo = bloqueJunto(img, b, 1, h);
    if (!pareceTexto(abajo)) continue;
    const debajo = abajo!.distancia;
    const centrado = Math.abs(centroX(abajo!.caja) - centroX(b)) <= ancho(b) * 0.35;
    // Fracción: numerador y denominador a distancias parecidas de la barra (medido: 22 px y 23 px).
    // Barra encima: el texto de abajo está claramente más cerca que el renglón de arriba (medido: 16 vs 26 px).
    if (pareceTexto(arriba) && centrado && ancho(arriba!.caja) <= ancho(b) * 1.4 && arriba!.distancia <= debajo * 1.3 + 2) {
      barras.push({ ...b, tipo: 'fraccion', arriba: arriba!.caja, abajo: abajo!.caja });
    } else if ((!arriba || arriba.distancia >= debajo * 1.4) && debajo <= h * 0.5 && ancho(b) <= h * 5) {
      barras.push({ ...b, tipo: 'sobre', abajo: abajo!.caja });
    }
  }
  return barras;
};

// ─────────────────────────────────────────────
// Lectura de cada parte y armado de la fórmula
// ─────────────────────────────────────────────

const leerZona = async (worker: Worker, img: ImagenBinaria, c: Caja, h: number) => {
  const pad = Math.round(h * 0.15);
  const left = Math.max(0, c.x0 - pad);
  const top = Math.max(0, c.y0 - pad);
  const width = Math.min(img.ancho - left, ancho(c) + 2 * pad);
  const height = Math.min(img.alto - top, alto(c) + 2 * pad);
  if (width < 4 || height < 4) return '';
  const { data } = await worker.recognize(img.url, { rectangle: { left, top, width, height } });
  return data.text.replace(/\s+/g, ' ').trim();
};

const DIGITO_PARECIDO: Record<string, string> = { S: '5', s: '5', O: '0', o: '0', I: '1', l: '1', '|': '1', Z: '2', z: '2', B: '8', g: '9', q: '9' };

/** Texto leído → LaTeX seguro: ángulos, signos y caracteres reservados. */
export const aLatex = (texto: string, esNumero = false) => {
  let t = texto
    .replace(/[{}$\\]/g, '')
    .replace(/^[|_~¦‘’'"“”«»]+|[|_~¦‘’'"“”«».,;:]+$/g, '')
    .trim();
  if (esNumero && DIGITO_PARECIDO[t]) t = DIGITO_PARECIDO[t];
  return t
    .replace(/(?<![\p{L}])[mM]\s?[<Z2∠∡£zAxX]\s?([A-Z]{3})(?![\p{L}])/gu, 'm\\angle $1')
    .replace(/[∠∡]\s?/g, '\\angle ')
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/([%#&])/g, '\\$1');
};

const OPERADORES = /[=+−\-×÷<>≤≥]/;
const normalizarOperador = (t: string) => {
  const limpio = t.replace(/\s+/g, '');
  if (!limpio || /^[—–_\-:=]{1,3}$/.test(limpio)) return '=';
  const op = limpio.match(OPERADORES)?.[0];
  return op === '−' ? '-' : op ?? '=';
};

const hayTintaEn = (img: ImagenBinaria, c: Caja) => {
  for (let y = Math.max(0, c.y0); y <= Math.min(img.alto - 1, c.y1); y++) {
    for (let x = Math.max(0, c.x0); x <= Math.min(img.ancho - 1, c.x1); x++) {
      if (img.tinta[y * img.ancho + x]) return true;
    }
  }
  return false;
};

const centroDentro = (zona: Caja, c: Caja) => {
  const cx = centroX(c), cy = centroY(c);
  return cx >= zona.x0 && cx <= zona.x1 && cy >= zona.y0 && cy <= zona.y1;
};

const reconstruirTexto = (l: LineaOcr): LineaOcr => ({ ...l, texto: l.palabras.map((p) => p.texto).join(' ') });

/** Fracciones de la imagen agrupadas por renglón y convertidas en fórmulas. */
const armarFracciones = async (worker: Worker, img: ImagenBinaria, barras: Barra[], h: number) => {
  const fracciones = barras.filter((b) => b.tipo === 'fraccion').sort((a, b) => centroY(a) - centroY(b) || a.x0 - b.x0);
  const renglones: Barra[][] = [];
  for (const f of fracciones) {
    const r = renglones.find((g) => Math.abs(centroY(g[0]) - centroY(f)) < h * 0.6);
    if (r) r.push(f); else renglones.push([f]);
  }

  const formulas: { zona: Caja; texto: string }[] = [];
  for (const renglon of renglones) {
    renglon.sort((a, b) => a.x0 - b.x0);
    const partes: string[] = [];
    let zona: Caja | null = null;
    for (let i = 0; i < renglon.length; i++) {
      const f = renglon[i];
      const num = aLatex(await leerZona(worker, img, f.arriba!, h));
      const den = aLatex(await leerZona(worker, img, f.abajo, h), true);
      // Si alguna parte no se lee como texto (p. ej. trazos de una figura), no es una fracción: se deja como estaba.
      const valida = (t: string) => /[\p{L}\p{N}]/u.test(t) && !/[/|]/.test(t);
      if (!valida(num) || !valida(den)) continue;
      if (partes.length) {
        const previa = renglon[i - 1];
        const hueco = { x0: previa.x1 + 2, x1: f.x0 - 2, y0: Math.round(f.y0 - h * 0.45), y1: Math.round(f.y1 + h * 0.45) };
        if (hueco.x1 > hueco.x0 && hayTintaEn(img, hueco)) partes.push(normalizarOperador(await leerZona(worker, img, hueco, h)));
      }
      partes.push(`\\frac{${num}}{${den}}`);
      const completa = union(union(f, f.arriba!), f.abajo);
      zona = zona ? union(zona, completa) : completa;
    }
    if (zona) formulas.push({ zona, texto: `$${partes.join(' ')}$` });
  }
  return formulas;
};

/** Palabras con barra encima: "AC" → "$\overline{AC}$" (también varias en una: "AQ y BD"). */
const aplicarBarrasEncima = async (worker: Worker, img: ImagenBinaria, barras: Barra[], lineas: LineaOcr[], h: number) => {
  const sobre = barras.filter((b) => b.tipo === 'sobre');
  if (!sobre.length) return lineas;
  const resultado: LineaOcr[] = [];
  for (const linea of lineas) {
    let cambio = false;
    const palabras: PalabraOcr[] = [];
    for (const p of linea.palabras) {
      const encima = sobre
        .filter((b) => Math.min(b.x1, p.caja.x1) - Math.max(b.x0, p.caja.x0) >= ancho(b) * 0.5
          && p.caja.y0 >= b.y0 - h * 0.3 && p.caja.y0 <= b.y1 + h * 0.8)
        .sort((a, b) => a.x0 - b.x0);
      if (!encima.length) { palabras.push(p); continue; }

      const trozos: string[] = [];
      const entre = async (x0: number, x1: number) => {
        if (x1 - x0 < h * 0.3) return;
        const zona = { x0, x1, y0: p.caja.y0, y1: p.caja.y1 };
        if (hayTintaEn(img, zona)) {
          // Restos de la barra o de su borde: paréntesis y rayas sueltas no son texto.
          const t = (await leerZona(worker, img, zona, h)).replace(/[|_~¦()[\]{}]/g, '').trim();
          if (/[\p{L}\p{N},.;:]/u.test(t)) trozos.push(t);
        }
      };
      await entre(p.caja.x0, encima[0].x0 - 3);
      for (let i = 0; i < encima.length; i++) {
        if (i > 0) await entre(encima[i - 1].x1 + 3, encima[i].x0 - 3);
        const segmento = aLatex(await leerZona(worker, img, encima[i].abajo, h)).replace(/[^A-Za-z0-9]/g, '');
        if (segmento) trozos.push(`$\\overline{${segmento}}$`);
      }
      await entre(encima[encima.length - 1].x1 + 3, p.caja.x1);
      if (trozos.some((t) => t.startsWith('$'))) {
        palabras.push({ ...p, texto: trozos.join(' ').replace(/\s+([,.;:])/g, '$1').replace(/([,.;:])\1+/g, '$1') });
        cambio = true;
      } else {
        palabras.push(p);
      }
    }
    resultado.push(cambio ? reconstruirTexto({ ...linea, palabras }) : linea);
  }
  return resultado;
};

/**
 * Reemplaza en las líneas leídas las fracciones y los segmentos con barra por fórmulas LaTeX.
 * Devuelve las líneas sin cambios si la imagen no tiene esa notación.
 */
export const reconstruirMatematica = async (worker: Worker, img: ImagenBinaria, lineas: LineaOcr[]): Promise<LineaOcr[]> => {
  const h = alturaDeTexto(lineas);
  const barras = detectarBarras(img, h);
  if (!barras.length) return lineas;

  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  try {
    let resultado = await aplicarBarrasEncima(worker, img, barras, lineas, h);

    for (const { zona, texto } of await armarFracciones(worker, img, barras, h)) {
      // Lo que el OCR leyó dentro de la fracción es basura: se quita y se pone la fórmula en su lugar.
      const formula: PalabraOcr = { texto, caja: zona, conf: 100 };
      resultado = resultado
        .map((l) => {
          const quedan = l.palabras.filter((p) => !centroDentro(zona, p.caja));
          return quedan.length === l.palabras.length ? l : reconstruirTexto({ ...l, palabras: quedan });
        })
        .filter((l) => l.palabras.length > 0);
      const anfitriona = resultado.find((l) => centroY(l.caja) >= zona.y0 && centroY(l.caja) <= zona.y1);
      if (anfitriona) {
        anfitriona.palabras = [...anfitriona.palabras, formula].sort((a, b) => a.caja.x0 - b.caja.x0);
        Object.assign(anfitriona, reconstruirTexto(anfitriona));
      } else {
        let pos = 0;
        resultado.forEach((l, i) => { if (l.caja.y0 <= zona.y0) pos = i + 1; });
        resultado.splice(pos, 0, { texto, caja: zona, palabras: [formula] });
      }
    }
    return resultado;
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  }
};
