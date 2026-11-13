/**
 * Conversión entre el contenido guardado (bloques JSON) y el documento del editor enriquecido (TipTap).
 *
 * Al guardar se usa el formato más simple posible:
 *  - Si solo hay párrafos normales (sin títulos, alineación, listas, citas ni tablas) se guarda en el
 *    formato original texto/latex/imagen, que entienden la IA, el parser y el PDF desde siempre.
 *  - Si no, se guardan bloques "parrafo", "lista" y "tabla".
 * Dentro del texto: **negrita**, *cursiva*, __subrayado__, fórmulas $...$ y saltos de línea.
 */
import type { JSONContent } from '@tiptap/core';
import { parsearBloques, textoEditableABloques, type Bloque } from './contenidoBloques';
import { partirFormato } from './formatoTexto';

type Alineacion = NonNullable<Bloque['alineacion']>;

const ALINEACION_A_EDITOR: Record<Alineacion, string> = {
  izquierda: 'left', centro: 'center', derecha: 'right', justificado: 'justify',
};
const ALINEACION_DESDE_EDITOR: Record<string, Alineacion> = {
  left: 'izquierda', center: 'centro', right: 'derecha', justify: 'justificado',
};

const LATEX = /\$([^$]+)\$/g;

// ─────────────────────────────────────────────
// Bloques → documento del editor
// ─────────────────────────────────────────────

/** Texto con marcas y fórmulas → nodos en línea del editor. */
export const textoANodos = (texto: string): JSONContent[] => {
  const nodos: JSONContent[] = [];
  const agregarTexto = (parte: string) => {
    for (const tramo of partirFormato(parte)) {
      const marcas = [
        ...(tramo.negrita ? [{ type: 'bold' }] : []),
        ...(tramo.cursiva ? [{ type: 'italic' }] : []),
        ...(tramo.subrayado ? [{ type: 'underline' }] : []),
        ...(tramo.subindice ? [{ type: 'subscript' }] : []),
        ...(tramo.superindice ? [{ type: 'superscript' }] : []),
      ];
      tramo.texto.split('\n').forEach((linea, i) => {
        if (i > 0) nodos.push({ type: 'hardBreak' });
        if (linea) nodos.push({ type: 'text', text: linea, ...(marcas.length ? { marks: marcas } : {}) });
      });
    }
  };
  let ultimo = 0;
  for (const m of texto.matchAll(LATEX)) {
    const inicio = m.index ?? 0;
    agregarTexto(texto.slice(ultimo, inicio));
    nodos.push({ type: 'inlineMath', attrs: { latex: m[1].trim() } });
    ultimo = inicio + m[0].length;
  }
  agregarTexto(texto.slice(ultimo));
  return nodos;
};

const parrafo = (contenido: JSONContent[], alineacion?: Alineacion): JSONContent => ({
  type: 'paragraph',
  ...(alineacion && alineacion !== 'izquierda' ? { attrs: { textAlign: ALINEACION_A_EDITOR[alineacion] } } : {}),
  ...(contenido.length ? { content: contenido } : {}),
});

export const bloquesADocumento = (contenido: string | null | undefined): JSONContent => {
  const nodos: JSONContent[] = [];
  let enLinea: JSONContent[] | null = null; // texto/latex del formato original se unen en un párrafo
  const cerrar = () => {
    if (enLinea) nodos.push(parrafo(enLinea));
    enLinea = null;
  };

  for (const b of parsearBloques(contenido)) {
    switch (b.tipo) {
      case 'texto':
      case 'latex': {
        const nuevos = b.tipo === 'latex'
          ? (b.valor?.trim() ? [{ type: 'inlineMath', attrs: { latex: b.valor.replace(/\$\$/g, '').trim() } }] : [])
          : textoANodos(b.valor ?? '');
        if (!nuevos.length) break;
        enLinea ??= [];
        if (enLinea.length) enLinea.push({ type: 'text', text: ' ' });
        enLinea.push(...nuevos);
        break;
      }
      case 'imagen':
        cerrar();
        if (b.url) nodos.push({ type: 'image', attrs: { src: b.url } });
        break;
      case 'parrafo': {
        cerrar();
        const estilo = b.estilo ?? 'normal';
        const alineacion = b.alineacion !== 'izquierda' && b.alineacion ? { textAlign: ALINEACION_A_EDITOR[b.alineacion] } : {};
        if (estilo === 'codigo') {
          nodos.push({ type: 'codeBlock', ...(b.valor ? { content: [{ type: 'text', text: b.valor }] } : {}) });
        } else if (estilo === 'cita') {
          nodos.push({ type: 'blockquote', content: [parrafo(textoANodos(b.valor ?? ''), b.alineacion)] });
        } else if (estilo.startsWith('h')) {
          const contenidoH = textoANodos(b.valor ?? '');
          nodos.push({ type: 'heading', attrs: { level: Number(estilo.slice(1)), ...alineacion }, ...(contenidoH.length ? { content: contenidoH } : {}) });
        } else {
          nodos.push(parrafo(textoANodos(b.valor ?? ''), b.alineacion));
        }
        break;
      }
      case 'lista':
        cerrar();
        if (b.items?.length) {
          nodos.push({
            type: b.ordenada ? 'orderedList' : 'bulletList',
            content: b.items.map((item) => ({ type: 'listItem', content: [parrafo(textoANodos(item))] })),
          });
        }
        break;
      case 'tabla':
        cerrar();
        if (b.filas?.length) {
          nodos.push({
            type: 'table',
            content: b.filas.map((fila, i) => ({
              type: 'tableRow',
              content: fila.map((celda) => ({
                type: i === 0 && b.encabezado ? 'tableHeader' : 'tableCell',
                content: [parrafo(textoANodos(celda))],
              })),
            })),
          });
        }
        break;
    }
  }
  cerrar();
  return { type: 'doc', content: nodos.length ? nodos : [{ type: 'paragraph' }] };
};

// ─────────────────────────────────────────────
// Documento del editor → bloques
// ─────────────────────────────────────────────

/** Nodos en línea → texto con marcas. Si hay varias marcas a la vez se conserva una (negrita > subrayado > cursiva). */
const nodosATexto = (nodos: JSONContent[] | undefined): string =>
  (nodos ?? []).map((n) => {
    if (n.type === 'hardBreak') return '\n';
    if (n.type === 'inlineMath' || n.type === 'blockMath') return n.attrs?.latex ? `$${n.attrs.latex}$` : '';
    if (n.type !== 'text' || !n.text) return '';
    const marcas = new Set((n.marks ?? []).map((m) => m.type));
    // Los espacios quedan fuera de las marcas: "** hola **" no se reconocería como negrita.
    const [, antes, medio, despues] = n.text.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? ['', '', n.text, ''];
    if (!medio) return n.text;
    // Subíndice / superíndice tienen prioridad (H₂O, x², 10⁻³): se guardan como <sub>/<sup>.
    if (marcas.has('subscript')) return `${antes}<sub>${medio}</sub>${despues}`;
    if (marcas.has('superscript')) return `${antes}<sup>${medio}</sup>${despues}`;
    const envolver = marcas.has('bold') ? '**' : marcas.has('underline') ? '__' : marcas.has('italic') ? '*' : '';
    return `${antes}${envolver}${medio}${envolver}${despues}`;
  }).join('');

/** Contenido de un nodo de bloque (párrafos de una celda o ítem) → texto. */
const contenidoATexto = (nodo: JSONContent): string =>
  (nodo.content ?? [])
    .map((hijo) => (hijo.type === 'paragraph' || hijo.type === 'heading' ? nodosATexto(hijo.content) : contenidoATexto(hijo)))
    .filter(Boolean)
    .join('\n');

const alineacionDe = (n: JSONContent): Alineacion | undefined => {
  const a = ALINEACION_DESDE_EDITOR[n.attrs?.textAlign as string];
  return a && a !== 'izquierda' ? a : undefined;
};

const nodoABloques = (n: JSONContent): Bloque[] => {
  switch (n.type) {
    case 'paragraph':
      return [{ tipo: 'parrafo', valor: nodosATexto(n.content), estilo: 'normal', alineacion: alineacionDe(n) }];
    case 'heading':
      return [{ tipo: 'parrafo', valor: nodosATexto(n.content), estilo: `h${Math.min(3, Number(n.attrs?.level) || 1)}` as Bloque['estilo'], alineacion: alineacionDe(n) }];
    case 'codeBlock':
      return [{ tipo: 'parrafo', valor: (n.content ?? []).map((t) => t.text ?? '').join(''), estilo: 'codigo' }];
    case 'blockquote':
      return (n.content ?? []).flatMap(nodoABloques).map((b) => (b.tipo === 'parrafo' ? { ...b, estilo: 'cita' as const } : b));
    case 'bulletList':
    case 'orderedList':
      return [{ tipo: 'lista', ordenada: n.type === 'orderedList', items: (n.content ?? []).map(contenidoATexto) }];
    case 'table': {
      const filas = (n.content ?? []).map((fila) => (fila.content ?? []).map(contenidoATexto));
      const encabezado = (n.content?.[0]?.content ?? []).some((c) => c.type === 'tableHeader');
      return [{ tipo: 'tabla', filas, encabezado }];
    }
    case 'image':
      return n.attrs?.src ? [{ tipo: 'imagen', url: n.attrs.src as string }] : [];
    case 'blockMath':
      return n.attrs?.latex ? [{ tipo: 'parrafo', valor: `$${n.attrs.latex}$`, estilo: 'normal', alineacion: 'centro' }] : [];
    default:
      return [];
  }
};

/** Quita espacios sobrantes y bloques vacíos. */
const limpiar = (bloques: Bloque[]): Bloque[] =>
  bloques
    .map((b) => (b.tipo === 'parrafo' && b.estilo !== 'codigo' ? { ...b, valor: (b.valor ?? '').replace(/[ \t]+\n/g, '\n').trim() } : b))
    .filter((b) => {
      if (b.tipo === 'parrafo') return !!b.valor?.trim();
      if (b.tipo === 'lista') return (b.items ?? []).some((i) => i.trim());
      if (b.tipo === 'tabla') return (b.filas ?? []).length > 0;
      return true;
    })
    .map((b) => {
      const { alineacion, ...resto } = b;
      return alineacion ? b : resto; // no guardar "alineacion: undefined"
    });

/** Documento del editor → contenido a guardar (JSON). Devuelve '' si está vacío. */
export const documentoABloques = (doc: JSONContent): string => {
  const bloques = limpiar((doc.content ?? []).flatMap(nodoABloques));
  if (!bloques.length) return '';

  const esSimple = bloques.every((b) =>
    b.tipo === 'imagen' || (b.tipo === 'parrafo' && b.estilo === 'normal' && !b.alineacion));

  if (!esSimple) return JSON.stringify(bloques);

  // Formato original: los párrafos se unen con salto de línea y las fórmulas pasan a bloques latex.
  const simples: Bloque[] = [];
  let texto: string[] = [];
  const volcar = () => {
    if (texto.length) simples.push(...textoEditableABloques(texto.join('\n')));
    texto = [];
  };
  for (const b of bloques) {
    if (b.tipo === 'imagen') {
      volcar();
      simples.push(b);
    } else {
      texto.push(b.valor ?? '');
    }
  }
  volcar();
  return JSON.stringify(simples);
};
