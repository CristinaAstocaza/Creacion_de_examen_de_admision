/**
 * Carátulas (portadas) del examen, guardadas por combinación ÁREA + MODALIDAD.
 * Se persisten en localStorage; al generar o descargar un examen se usa la
 * carátula que corresponde a su área y modalidad.
 */
import { TIPOS_PRUEBA } from './estructuraExamen';

export interface Caratula {
  categoriaId: number;
  categoriaNombre: string;
  /** id de TIPOS_PRUEBA (ORDINARIA, PRIMEROS…). */
  modalidadId: string;
  institutionName: string;
  headerText: string;
  /** Texto de modalidad que se imprime en la portada. */
  modalidad: string;
  footerText: string;
  instructions: string;
  logoUrl: string | null;
  /** Letra de tema de la primera versión. */
  temaLetra: string;
  colorPortada: string;
  actualizado: string;
}

/** Fondo por defecto de una carátula nueva. */
export const COLOR_PORTADA_DEFECTO = '#ffffff';

const STORAGE_KEY = 'caratulasExamen';
/** Formato anterior: una sola carátula global. Se usa solo para precargar valores. */
const LEGACY_KEY = 'configuracionExamen';

const clave = (categoriaId: number, modalidadId: string) => `${categoriaId}|${modalidadId}`;

const leerMapa = (): Record<string, Caratula> => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
};

export const listarCaratulas = (): Caratula[] =>
  Object.values(leerMapa()).sort((a, b) => b.actualizado.localeCompare(a.actualizado));

export const obtenerCaratula = (categoriaId: number | '' | null | undefined, modalidadId: string | null | undefined) => {
  if (!categoriaId || !modalidadId) return null;
  return leerMapa()[clave(categoriaId, modalidadId)] ?? null;
};

/** Guarda la carátula. Lanza error si el navegador se quedó sin espacio (p. ej. logos muy pesados). */
export const guardarCaratula = (c: Omit<Caratula, 'actualizado'>): Caratula => {
  const mapa = leerMapa();
  const guardada: Caratula = { ...c, actualizado: new Date().toISOString() };
  mapa[clave(c.categoriaId, c.modalidadId)] = guardada;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
  return guardada;
};

export const eliminarCaratula = (categoriaId: number, modalidadId: string) => {
  const mapa = leerMapa();
  delete mapa[clave(categoriaId, modalidadId)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
};

export const caratulaCompleta = (c: Caratula | null): c is Caratula =>
  Boolean(c && c.institutionName.trim() && c.headerText.trim() && c.modalidad.trim() && c.colorPortada);

export const nombreModalidad = (modalidadId: string) =>
  TIPOS_PRUEBA.find((t) => t.id === modalidadId)?.nombre ?? modalidadId;

/** Busca el id de modalidad a partir del nombre guardado en el examen ("Admisión ordinaria" → ORDINARIA). */
export const modalidadIdPorNombre = (nombre: string | null | undefined) =>
  TIPOS_PRUEBA.find((t) => t.nombre === nombre)?.id ?? 'ORDINARIA';

/** Texto sugerido para imprimir: "MODALIDAD ADMISIÓN ORDINARIA". */
export const textoModalidadSugerido = (modalidadId: string) =>
  `MODALIDAD ${nombreModalidad(modalidadId).toUpperCase()}`;

/** Valores de la carátula global antigua, para no perder lo que ya se había configurado. */
export const leerCaratulaLegacy = (): Partial<Caratula> => {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

/** Campos que espera el backend (GenerarExamenRequest / CaratulaPdfRequest). */
export const caratulaAPayload = (c: Caratula) => ({
  nombreUniversidad: c.institutionName.trim() || null,
  tituloExamen: c.headerText.trim() || null,
  modalidad: c.modalidad.trim() || null,
  colorPortada: c.colorPortada || null,
  logoUrl: c.logoUrl || null,
  instruccionesPortada: c.instructions.trim() || null,
  textoPie: c.footerText.trim() || null,
});

/** Color de texto legible sobre el color de portada. */
export const colorContraste = (hexColor: string) => {
  const hex = (hexColor || '#ffffff').replace('#', '');
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#0f172a' : '#ffffff';
};
