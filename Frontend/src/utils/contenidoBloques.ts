/**
 * Conversión entre el contenido guardado (JSON de bloques texto/latex/imagen)
 * y lo que se edita en los formularios (texto + una figura).
 *
 * En el texto editable las fórmulas se escriben entre signos $, por ejemplo: "Si $x^2 = 4$, halle x".
 */

/**
 * Bloques del contenido de una pregunta o alternativa.
 * - texto / latex / imagen: formato original (todo fluye en una línea, como lo genera la IA).
 * - parrafo / lista / tabla: los genera el editor enriquecido solo cuando hay títulos, alineación,
 *   listas, citas o tablas. Su texto admite **negrita**, *cursiva*, __subrayado__ y fórmulas $...$.
 */
export interface Bloque {
  tipo: 'texto' | 'latex' | 'imagen' | 'parrafo' | 'lista' | 'tabla';
  valor?: string;
  url?: string | null;
  /** parrafo */
  estilo?: 'normal' | 'h1' | 'h2' | 'h3' | 'codigo' | 'cita';
  alineacion?: 'izquierda' | 'centro' | 'derecha' | 'justificado';
  /** lista */
  ordenada?: boolean;
  items?: string[];
  /** tabla: la primera fila es encabezado si `encabezado` es true */
  filas?: string[][];
  encabezado?: boolean;
}

/** Textos visibles de un bloque (para buscar, resumir o validar). */
export const textosDeBloque = (b: Bloque): string[] => {
  if (b.tipo === 'lista') return b.items ?? [];
  if (b.tipo === 'tabla') return (b.filas ?? []).flat();
  if (b.tipo === 'imagen') return [];
  return b.valor ? [b.valor] : [];
};

export const parsearBloques = (contenido: string | null | undefined): Bloque[] => {
  if (!contenido) return [];
  try {
    const parsed = JSON.parse(contenido);
    if (Array.isArray(parsed)) return parsed as Bloque[];
  } catch {
    // texto plano antiguo
  }
  return [{ tipo: 'texto', valor: contenido }];
};

export const tieneBloquesImagen = (contenido: string | null | undefined): boolean =>
  parsearBloques(contenido).some(b => b.tipo === 'imagen' && !!b.url);

/** Primera figura (ya recortada) dentro del contenido, si existe. */
export const primeraImagen = (contenido: string | null | undefined): string | null =>
  parsearBloques(contenido).find(b => b.tipo === 'imagen' && !!b.url)?.url ?? null;

/**
 * Las importaciones por imagen guardaban la captura COMPLETA como imagen de la pregunta
 * (carpeta examenes_admi/ en Cloudinary). Esa captura no es una figura: nunca se muestra.
 */
export const esCapturaImportada = (url: string | null | undefined): boolean =>
  !!url && url.includes('/examenes_admi/');

/** Imagen principal "suelta" (campo imagenUrl) que sí debe mostrarse junto al contenido. */
export const imagenPrincipalVisible = (contenido: string | null | undefined, imagenUrl: string | null | undefined): string | null => {
  if (!imagenUrl || esCapturaImportada(imagenUrl) || tieneBloquesImagen(contenido)) return null;
  return imagenUrl;
};

/** Bloques → texto editable (las fórmulas quedan como $...$; las imágenes se editan aparte). */
export const bloquesATextoEditable = (contenido: string | null | undefined): string =>
  parsearBloques(contenido)
    .flatMap(b => (b.tipo === 'latex' ? (b.valor ? [`$${b.valor.trim()}$`] : []) : textosDeBloque(b).map(t => t.trim())))
    .filter(Boolean)
    .join(' ')
    .trim();

/** Texto editable → bloques de texto y fórmulas. */
export const textoEditableABloques = (texto: string): Bloque[] => {
  const bloques: Bloque[] = [];
  const regex = /\$([^$]+)\$/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    const antes = texto.slice(ultimo, m.index).trim();
    if (antes) bloques.push({ tipo: 'texto', valor: antes });
    bloques.push({ tipo: 'latex', valor: m[1].trim() });
    ultimo = m.index + m[0].length;
  }
  const resto = texto.slice(ultimo).trim();
  if (resto) bloques.push({ tipo: 'texto', valor: resto });
  return bloques;
};

/**
 * Arma el contenido final a guardar: texto/fórmulas editados + figura.
 * Conserva las demás figuras que ya tenía el contenido original (solo reemplaza o quita la primera).
 */
export const construirContenido = (
  texto: string,
  figuraUrl: string | null,
  contenidoOriginal?: string | null,
): string | null => {
  const imagenes = parsearBloques(contenidoOriginal).filter(b => b.tipo === 'imagen' && !!b.url);
  if (figuraUrl) {
    if (imagenes.length > 0) imagenes[0] = { tipo: 'imagen', url: figuraUrl };
    else imagenes.push({ tipo: 'imagen', url: figuraUrl });
  } else {
    imagenes.shift();
  }
  const bloques = [...textoEditableABloques(texto), ...imagenes];
  return bloques.length > 0 ? JSON.stringify(bloques) : null;
};
