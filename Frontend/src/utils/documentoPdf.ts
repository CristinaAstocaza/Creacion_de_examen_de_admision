/**
 * Lectura de PDF en el navegador con pdf.js empaquetado localmente (sin CDN, funciona sin internet).
 * Además del texto, detecta qué páginas tienen imágenes o gráficos y permite renderizarlas
 * como imagen para recortar figuras o aplicar OCR.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PaginaPdf {
  numero: number;
  texto: string;
  /** La página contiene imágenes incrustadas (fotos, capturas, figuras escaneadas). */
  tieneImagenes: boolean;
  /** Muchos trazos vectoriales: probablemente hay gráficos, tablas o diagramas dibujados. */
  tieneDibujos: boolean;
}

export interface DocumentoPdf {
  paginas: PaginaPdf[];
  /** Texto completo con separadores de página (formato que ya usa el parser). */
  texto: string;
  /** Devuelve la página renderizada como imagen PNG (data URL). Se guarda en caché. */
  renderizarPagina: (numero: number) => Promise<string>;
  /** Libera la memoria del documento. */
  cerrar: () => void;
}

const OPS_IMAGEN = new Set<number>([
  pdfjs.OPS.paintImageXObject,
  pdfjs.OPS.paintInlineImageXObject,
  pdfjs.OPS.paintImageMaskXObject,
  pdfjs.OPS.paintImageXObjectRepeat,
  pdfjs.OPS.paintImageMaskXObjectRepeat,
  pdfjs.OPS.paintInlineImageXObjectGroup,
  pdfjs.OPS.paintImageMaskXObjectGroup,
  pdfjs.OPS.paintSolidColorImageMask,
]);

/** A partir de cuántos trazos consideramos que una página tiene un gráfico dibujado. */
const UMBRAL_TRAZOS = 40;

export const abrirPdf = async (archivo: File): Promise<DocumentoPdf> => {
  const pdf = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
  const paginas: PaginaPdf[] = [];

  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const contenido = await pagina.getTextContent();
    const texto = contenido.items.map((it) => ('str' in it ? it.str : '')).join(' ');
    const ops = await pagina.getOperatorList();
    let imagenes = 0;
    let trazos = 0;
    for (const fn of ops.fnArray) {
      if (OPS_IMAGEN.has(fn)) imagenes++;
      else if (fn === pdfjs.OPS.constructPath) trazos++;
    }
    paginas.push({ numero: n, texto, tieneImagenes: imagenes > 0, tieneDibujos: trazos >= UMBRAL_TRAZOS });
  }

  const cache = new Map<number, Promise<string>>();
  const renderizarPagina = (numero: number) => {
    if (!cache.has(numero)) {
      cache.set(numero, (async () => {
        const pagina = await pdf.getPage(numero);
        const viewport = pagina.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await pagina.render({ canvas, canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/png');
      })());
    }
    return cache.get(numero)!;
  };

  return {
    paginas,
    texto: paginas.map((p) => `\n--- PÁGINA ${p.numero} ---\n${p.texto}`).join(''),
    renderizarPagina,
    cerrar: () => { void pdf.destroy(); cache.clear(); },
  };
};

/** Un PDF sin texto seleccionable es, casi siempre, un escaneo. */
export const esPdfEscaneado = (doc: DocumentoPdf) =>
  doc.texto.replace(/---\s*PÁGINA\s*\d+\s*---/g, '').replace(/\s+/g, '').length < 100;
