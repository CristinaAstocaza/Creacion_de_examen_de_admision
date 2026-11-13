/**
 * Estructura oficial del examen de admisión UNICA 2026-II (Ica, Chincha y Nasca).
 * Son cantidades RECOMENDADAS: al generar el examen se pueden cambiar libremente.
 *
 * Claves de curso = código del curso en el sistema.
 *   CUR-GEO = Geografía · CUR-GEO2 = Geometría · CUR-RV / CUR-RM = Razonamiento Verbal / Matemático
 */

export type AreaExamen = 'salud' | 'social' | 'ingenier' | 'educaci';

export interface TipoPrueba {
  id: string;
  nombre: string;
  /** Total recomendado de preguntas; null = personalizado (sin recomendación). */
  total: number | null;
  descripcion: string;
}

export const TIPOS_PRUEBA: TipoPrueba[] = [
  { id: 'ORDINARIA', nombre: 'Admisión ordinaria', total: 100, descripcion: 'Prueba de 100 preguntas' },
  { id: 'VICTIMAS', nombre: 'Víctimas de terrorismo', total: 100, descripcion: 'Prueba de 100 preguntas' },
  { id: 'DISCAPACIDAD', nombre: 'Personas con discapacidad', total: 100, descripcion: 'Prueba de 100 preguntas' },
  { id: 'PRIMEROS', nombre: 'Primeros puestos', total: 60, descripcion: 'Prueba de 60 preguntas' },
  { id: 'DEPORTISTAS', nombre: 'Deportistas calificados', total: 60, descripcion: 'Prueba de 60 preguntas' },
  { id: 'TITULADOS', nombre: 'Titulados y graduados', total: 40, descripcion: 'Prueba de 40 preguntas (solo Aptitud Académica)' },
  { id: 'PERSONALIZADO', nombre: 'Personalizado', total: null, descripcion: 'Elige libremente cursos y cantidades' },
];

const STORAGE_KEY_TOTALES_MODALIDAD = 'admissio_totales_modalidad';

export const obtenerTotalesGuardados = (): Record<string, number | null> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TOTALES_MODALIDAD);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const guardarTotalModalidad = (modalidadId: string, total: number | null): void => {
  try {
    const actuales = obtenerTotalesGuardados();
    actuales[modalidadId] = total;
    localStorage.setItem(STORAGE_KEY_TOTALES_MODALIDAD, JSON.stringify(actuales));
  } catch (e) {
    console.error('Error guardando total de modalidad', e);
  }
};

export const restablecerTotalModalidad = (modalidadId: string): void => {
  try {
    const actuales = obtenerTotalesGuardados();
    delete actuales[modalidadId];
    localStorage.setItem(STORAGE_KEY_TOTALES_MODALIDAD, JSON.stringify(actuales));
  } catch (e) {
    console.error('Error restableciendo total de modalidad', e);
  }
};

/** Devuelve la lista de tipos de prueba con los totales actualizados por el usuario. */
export const obtenerTiposPrueba = (): TipoPrueba[] => {
  const guardados = obtenerTotalesGuardados();
  return TIPOS_PRUEBA.map((t) => {
    if (t.id in guardados) {
      const nuevoTotal = guardados[t.id];
      return {
        ...t,
        total: nuevoTotal,
        descripcion: nuevoTotal !== null ? `Prueba de ${nuevoTotal} preguntas` : 'Elige libremente cursos y cantidades',
      };
    }
    return t;
  });
};

type Distribucion = Record<string, number>;

const PRUEBA_100: Record<AreaExamen, Distribucion> = {
  salud: {
    'CUR-BIO': 17, 'CUR-QUI': 8, 'CUR-FIS': 5, 'CUR-HIS': 2, 'CUR-GEO': 2,
    'CUR-ECO': 1, 'CUR-CIV': 2, 'CUR-PSI': 2, 'CUR-LEN': 3, 'CUR-LIT': 3,
    'CUR-TRI': 3, 'CUR-GEO2': 4, 'CUR-ALG': 4, 'CUR-ARI': 4, 'CUR-RV': 20, 'CUR-RM': 20,
  },
  social: {
    'CUR-BIO': 8, 'CUR-QUI': 4, 'CUR-FIS': 3, 'CUR-HIS': 4, 'CUR-GEO': 3,
    'CUR-ECO': 3, 'CUR-CIV': 4, 'CUR-PSI': 4, 'CUR-LEN': 6, 'CUR-LIT': 6,
    'CUR-TRI': 3, 'CUR-GEO2': 4, 'CUR-ALG': 4, 'CUR-ARI': 4, 'CUR-RV': 20, 'CUR-RM': 20,
  },
  ingenier: {
    'CUR-BIO': 2, 'CUR-QUI': 5, 'CUR-FIS': 8, 'CUR-HIS': 2, 'CUR-GEO': 2,
    'CUR-ECO': 1, 'CUR-CIV': 2, 'CUR-PSI': 2, 'CUR-LEN': 3, 'CUR-LIT': 3,
    'CUR-TRI': 7, 'CUR-GEO2': 8, 'CUR-ALG': 7, 'CUR-ARI': 8, 'CUR-RV': 20, 'CUR-RM': 20,
  },
  // No figura en el documento 2026-II; se conserva la plantilla que ya usaba el sistema.
  educaci: {
    'CUR-BIO': 4, 'CUR-QUI': 3, 'CUR-FIS': 2, 'CUR-HIS': 6, 'CUR-GEO': 5,
    'CUR-ECO': 4, 'CUR-CIV': 5, 'CUR-PSI': 8, 'CUR-LEN': 8, 'CUR-LIT': 8,
    'CUR-TRI': 1, 'CUR-GEO2': 1, 'CUR-ALG': 2, 'CUR-ARI': 3, 'CUR-RV': 20, 'CUR-RM': 20,
  },
};

const PRUEBA_60_SALUD: Distribucion = {
  'CUR-BIO': 5, 'CUR-QUI': 3, 'CUR-FIS': 2, 'CUR-HIS': 1, 'CUR-GEO': 1,
  'CUR-LEN': 2, 'CUR-LIT': 1, 'CUR-TRI': 1, 'CUR-GEO2': 1, 'CUR-ALG': 1, 'CUR-ARI': 2,
  'CUR-RV': 20, 'CUR-RM': 20,
};
const PRUEBA_60_SOCIAL: Distribucion = {
  'CUR-BIO': 3, 'CUR-QUI': 1, 'CUR-FIS': 1, 'CUR-HIS': 2, 'CUR-GEO': 1,
  'CUR-ECO': 1, 'CUR-CIV': 1, 'CUR-PSI': 1, 'CUR-LEN': 2, 'CUR-LIT': 2,
  'CUR-TRI': 1, 'CUR-GEO2': 1, 'CUR-ALG': 1, 'CUR-ARI': 2, 'CUR-RV': 20, 'CUR-RM': 20,
};
const PRUEBA_60: Record<AreaExamen, Distribucion> = {
  salud: PRUEBA_60_SALUD,
  social: PRUEBA_60_SOCIAL,
  ingenier: {
    'CUR-BIO': 1, 'CUR-QUI': 2, 'CUR-FIS': 2, 'CUR-HIS': 1, 'CUR-GEO': 1,
    'CUR-LEN': 2, 'CUR-LIT': 1, 'CUR-TRI': 2, 'CUR-GEO2': 3, 'CUR-ALG': 2, 'CUR-ARI': 3,
    'CUR-RV': 20, 'CUR-RM': 20,
  },
  educaci: PRUEBA_60_SOCIAL,
};

const SOLO_APTITUD: Distribucion = { 'CUR-RV': 20, 'CUR-RM': 20 };
const PRUEBA_40: Record<AreaExamen, Distribucion> = {
  salud: SOLO_APTITUD, social: SOLO_APTITUD, ingenier: SOLO_APTITUD, educaci: SOLO_APTITUD,
};

/** Deduce el área a partir del nombre de la categoría (ej. "Ciencias de la Salud" → salud). */
export const resolverArea = (nombreCategoria: string): AreaExamen => {
  const norm = (nombreCategoria || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const area of ['salud', 'social', 'ingenier', 'educaci'] as AreaExamen[]) {
    if (norm.includes(area)) return area;
  }
  return 'ingenier';
};

/** Cantidades recomendadas por código de curso, o null si el tipo es personalizado. */
/**
 * Reparte `nuevoTotal` preguntas en la misma proporción que `base`, y la suma da EXACTAMENTE `nuevoTotal`
 * (método del mayor resto: primero la parte entera y luego las preguntas sobrantes a quien tenga
 * la mayor fracción). Ej.: plantilla de 100 llevada a 80.
 */
export const escalarDistribucion = <K extends string | number>(base: Record<K, number>, nuevoTotal: number): Record<K, number> => {
  const claves = (Object.keys(base) as K[]).filter((k) => base[k] > 0);
  const totalBase = claves.reduce((s, k) => s + base[k], 0);
  const resultado = {} as Record<K, number>;
  if (!totalBase || nuevoTotal <= 0) return resultado;
  if (totalBase === nuevoTotal) {
    claves.forEach((k) => { resultado[k] = base[k]; });
    return resultado;
  }
  const partes = claves.map((k) => {
    const exacto = (base[k] * nuevoTotal) / totalBase;
    return { k, entero: Math.floor(exacto), resto: exacto - Math.floor(exacto) };
  });
  let sobrantes = nuevoTotal - partes.reduce((s, p) => s + p.entero, 0);
  [...partes].sort((a, b) => b.resto - a.resto).forEach((p) => {
    if (sobrantes > 0) { p.entero += 1; sobrantes -= 1; }
  });
  partes.forEach((p) => { if (p.entero > 0) resultado[p.k] = p.entero; });
  return resultado;
};

/** Plantilla oficial según el total ORIGINAL de la modalidad (100, 60 o 40). */
const plantillaOriginal = (totalOriginal: number | null, area: AreaExamen): Distribucion | null => {
  if (totalOriginal === 100) return PRUEBA_100[area];
  if (totalOriginal === 60) return PRUEBA_60[area];
  if (totalOriginal === 40) return PRUEBA_40[area];
  return null;
};

/**
 * Distribución recomendada para la modalidad y el área. Si el total de la modalidad se cambió
 * (p. ej. Ordinaria a 80), se escala la plantilla oficial al nuevo total.
 */
export const distribucionRecomendada = (tipo: TipoPrueba, nombreCategoria: string): Distribucion | null => {
  const area = resolverArea(nombreCategoria);
  const original = TIPOS_PRUEBA.find((t) => t.id === tipo.id)?.total ?? tipo.total;
  const base = plantillaOriginal(original, area) ?? plantillaOriginal(tipo.total, area);
  if (!base || tipo.total === null) return null;
  return escalarDistribucion(base, tipo.total);
};

export const FORMATOS_HOJA = [
  { value: 'A4', label: 'A4 (210 × 297 mm)' },
  { value: 'OFICIO', label: 'Oficio (216 × 330 mm)' },
];

/** Formato válido para la letra de tema: 1 a 5 letras o números (A, P, T1...). */
export const TEMA_VALIDO = /^[A-Z0-9]{1,5}$/;

/** Letras de tema para N versiones empezando en la letra inicial (P → P, Q, R...). */
export const letrasDesde = (inicial: string, cantidad: number): string[] => {
  const base = (inicial || 'A').trim().toUpperCase();
  const letras: string[] = [base];
  let codigo = base.length === 1 && /[A-Z]/.test(base) ? base.charCodeAt(0) : 64; // 64 = '@' (antes de 'A')
  for (let intentos = 0; letras.length < cantidad && intentos < 26; intentos++) {
    codigo = codigo >= 90 ? 65 : codigo + 1; // después de Z vuelve a A
    const letra = String.fromCharCode(codigo);
    if (!letras.includes(letra)) letras.push(letra);
  }
  // Más de 26 versiones: se completa con códigos numerados (V27, V28...).
  while (letras.length < cantidad) letras.push(`V${letras.length + 1}`);
  return letras.slice(0, cantidad);
};
