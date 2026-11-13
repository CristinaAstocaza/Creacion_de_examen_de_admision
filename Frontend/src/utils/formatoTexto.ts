/**
 * Formato de texto dentro de los bloques de contenido (mismo criterio que el PDF del backend):
 *   **negrita**   *cursiva*   __subrayado__   <sub>subíndice</sub>   <sup>superíndice</sup>
 * Las fórmulas siguen yendo entre $...$.
 */
export interface TramoTexto {
  texto: string;
  negrita?: boolean;
  cursiva?: boolean;
  subrayado?: boolean;
  subindice?: boolean;
  superindice?: boolean;
}

// Mismo patrón que PdfContenidoRenderer.FORMATO (Java) + <sub>/<sup> (el PDF los dibuja con desplazamiento).
// La cursiva exige que el * no esté pegado a letras/números por fuera (evita confundir "2*3*4"); el
// subrayado no acepta solo guiones bajos (los espacios para completar "_____" se respetan).
const FORMATO = /<sub>(.+?)<\/sub>|<sup>(.+?)<\/sup>|\*\*(.+?)\*\*|__([^_\s](?:[^_]*?[^_\s])?)__|(?<![\p{L}\p{N}*])\*([^*\s](?:[^*]*?[^*\s])?)\*(?![\p{L}\p{N}*])/giu;

export const partirFormato = (texto: string): TramoTexto[] => {
  const tramos: TramoTexto[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(FORMATO)) {
    const inicio = m.index ?? 0;
    if (inicio > ultimo) tramos.push({ texto: texto.slice(ultimo, inicio) });
    if (m[1] !== undefined) tramos.push({ texto: m[1], subindice: true });
    else if (m[2] !== undefined) tramos.push({ texto: m[2], superindice: true });
    else if (m[3] !== undefined) tramos.push({ texto: m[3], negrita: true });
    else if (m[4] !== undefined) tramos.push({ texto: m[4], subrayado: true });
    else tramos.push({ texto: m[5], cursiva: true });
    ultimo = inicio + m[0].length;
  }
  if (ultimo < texto.length) tramos.push({ texto: texto.slice(ultimo) });
  return tramos;
};

/** Texto sin las marcas de formato (para vistas resumidas). */
export const quitarFormato = (texto: string) => partirFormato(texto).map((t) => t.texto).join('');

/** Etiqueta HTML con la que se muestra un tramo con formato (o null si es texto normal). */
export const etiquetaDeTramo = (t: TramoTexto): 'sub' | 'sup' | 'strong' | 'em' | 'u' | null =>
  t.subindice ? 'sub' : t.superindice ? 'sup' : t.negrita ? 'strong' : t.cursiva ? 'em' : t.subrayado ? 'u' : null;
