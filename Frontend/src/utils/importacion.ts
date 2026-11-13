/**
 * Modelo y reglas de las preguntas en revisión dentro de "Importar Preguntas".
 * Permite completar a mano lo que la extracción (IA, OCR o texto) no logró:
 * texto, alternativas faltantes e imágenes/gráficos.
 */
import { parsearBloques, textoEditableABloques, textosDeBloque, esCapturaImportada, type Bloque } from './contenidoBloques';

export const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;

export interface ParsedAlternativa {
  letra: string;
  tipo: 'TEXTO' | 'IMAGEN';
  contenidoTexto: string | null;
  esCorrecta: false;
  imagenUrl?: string;
  ordenVisualizacion?: number;
  needsImage?: boolean;
}

/** Imagen de donde se pueden recortar figuras: página de un PDF, imagen subida, escaneo… */
export interface FuenteImagen {
  id: string;
  etiqueta: string;
  obtenerUrl: () => Promise<string>;
  /** Aviso: en esta fuente se detectaron imágenes o gráficos. */
  tieneGraficos?: boolean;
}

export interface AnalyzedQuestion {
  id: string;
  numero: number;
  enunciado: string;
  isValid: boolean;
  errorMessage?: string;
  dificultad: string;
  tiene_imagen_enunciado?: boolean;
  descripcion_imagen?: string;
  imagenUrl?: string;
  originalImageUrl?: string;
  parsedAlternativas: ParsedAlternativa[];
  tipo_bloque?: 'pregunta' | 'contexto' | 'encabezado' | 'otro';
  posible_incompleta?: boolean;
  confianza_extraccion?: number;
  needsReview: boolean;
  enunciadoNeedsImage?: boolean;
  /** Fuente (página/imagen) de la que proviene la pregunta: se abre por defecto al recortar. */
  fuenteId?: string;
  /** Aviso de que el origen tiene gráficos que pudieron no importarse. */
  avisoGraficos?: string;
  avisoRevisado?: boolean;
}

const aJson = (bloques: Bloque[]) => JSON.stringify(bloques);

/** Hay algo que mostrar: texto/fórmula no vacíos o una imagen ya recortada. */
export const tieneContenido = (contenido: string | null | undefined) =>
  parsearBloques(contenido).some((b) => (b.tipo === 'imagen' ? !!b.url : textosDeBloque(b).some((t) => t.trim())));

/** Bloques de imagen marcados por la IA que aún no tienen recorte. */
export const tieneImagenPendiente = (contenido: string | null | undefined) =>
  parsearBloques(contenido).some((b) => b.tipo === 'imagen' && !b.url);

/** Reemplaza el texto/fórmulas conservando las imágenes del contenido. */
export const reemplazarTexto = (contenido: string | null | undefined, texto: string): string => {
  const imagenes = parsearBloques(contenido).filter((b) => b.tipo === 'imagen');
  return aJson([...textoEditableABloques(texto), ...imagenes]);
};

/** Agrega una imagen al final, o completa el bloque de imagen pendiente indicado. */
export const ponerImagen = (contenido: string | null | undefined, url: string, indiceBloque?: number): string => {
  const bloques = parsearBloques(contenido);
  if (indiceBloque !== undefined && bloques[indiceBloque]?.tipo === 'imagen') {
    bloques[indiceBloque] = { ...bloques[indiceBloque], url };
  } else {
    bloques.push({ tipo: 'imagen', url });
  }
  return aJson(bloques);
};

/**
 * Coloca las imágenes después del texto ("debajo del problema"), conservando el orden entre ellas.
 * Solo para el formato original (texto/latex/imagen); el contenido enriquecido se deja como lo escribió el usuario.
 */
export const imagenesAlFinal = (contenido: string | null | undefined): string => {
  const bloques = parsearBloques(contenido);
  if (!bloques.some((b) => b.tipo === 'imagen') || bloques.some((b) => b.tipo === 'parrafo' || b.tipo === 'lista' || b.tipo === 'tabla')) {
    return contenido ?? '';
  }
  return aJson([...bloques.filter((b) => b.tipo !== 'imagen'), ...bloques.filter((b) => b.tipo === 'imagen')]);
};

/** Quita la imagen del bloque indicado. */
export const quitarImagen = (contenido: string | null | undefined, indiceBloque: number): string =>
  aJson(parsearBloques(contenido).filter((_, i) => i !== indiceBloque));

/** Siempre devuelve las 5 alternativas (A–E), creando vacías las que falten. */
export const completarAlternativas = (alts: ParsedAlternativa[]): ParsedAlternativa[] =>
  LETRAS.map((letra, i) => {
    const existente = alts.find((a) => a.letra === letra);
    return existente
      ? { ...existente, ordenVisualizacion: i + 1 }
      : { letra, tipo: 'TEXTO', contenidoTexto: null, esCorrecta: false, ordenVisualizacion: i + 1 };
  });

/** Recalcula si la pregunta está completa y qué le falta. Llamar tras cada edición. */
export const evaluarPregunta = (q: AnalyzedQuestion): AnalyzedQuestion => {
  const alternativas = completarAlternativas(q.parsedAlternativas).map((a) => ({
    ...a,
    needsImage: tieneImagenPendiente(a.contenidoTexto),
  }));
  const faltantes = alternativas
    .filter((a) => !tieneContenido(a.contenidoTexto) && !a.imagenUrl)
    .map((a) => a.letra);
  // La captura completa que guarda la IA no cuenta como contenido (solo sirve para recortar).
  const enunciadoOk = tieneContenido(q.enunciado) || (!!q.imagenUrl && !esCapturaImportada(q.imagenUrl));
  const enunciadoNeedsImage = tieneImagenPendiente(q.enunciado);

  const errores: string[] = [];
  if (!enunciadoOk) errores.push('Falta el enunciado.');
  if (faltantes.length) errores.push(`Faltan alternativas: ${faltantes.join(', ')}.`);

  const isValid = errores.length === 0;
  const needsReview = !isValid
    || enunciadoNeedsImage
    || alternativas.some((a) => a.needsImage)
    || (q.confianza_extraccion !== undefined && q.confianza_extraccion < 80)
    || !!q.posible_incompleta
    || (q.tipo_bloque !== undefined && q.tipo_bloque !== 'pregunta')
    || (!!q.avisoGraficos && !q.avisoRevisado);

  return {
    ...q,
    parsedAlternativas: alternativas,
    enunciadoNeedsImage,
    isValid,
    needsReview,
    errorMessage: errores.join(' ') || undefined,
  };
};

/** Lista para guardar: completa y sin figuras pendientes de recortar. */
export const listaParaGuardar = (q: AnalyzedQuestion) =>
  q.isValid && !q.enunciadoNeedsImage && !q.parsedAlternativas.some((a) => a.needsImage);

/** Texto normalizado para buscar a qué página pertenece una pregunta. */
export const normalizarParaBuscar = (texto: string) =>
  texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
