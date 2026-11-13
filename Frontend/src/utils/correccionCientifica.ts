/**
 * Correcciones del texto leído por OCR según la materia de la pregunta.
 *
 * El OCR confunde caracteres pequeños o parecidos: subíndices ("Au₂O" → "AuzO"), la letra O con el
 * cero ("H₂SO₄" → "H2504"), exponentes ("10²³" → "102:"), etc. Conociendo la materia se pueden
 * corregir con reglas seguras: por ejemplo, en química una fórmula solo es válida si está formada
 * por símbolos reales de la tabla periódica.
 */

export type Dominio = 'quimica' | 'fisica' | 'geometria' | 'algebra' | 'general';

// ─────────────────────────────────────────────
// Detección de la materia
// ─────────────────────────────────────────────

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Materia según el nombre del curso destino (la señal más confiable). */
export const dominioPorCurso = (nombreCurso: string | null | undefined): Dominio | null => {
  const n = sinTildes(nombreCurso ?? '');
  if (!n) return null;
  if (/quimic/.test(n)) return 'quimica';
  if (/fisic/.test(n)) return 'fisica';
  if (/geometr|trigonometr/.test(n)) return 'geometria';
  if (/algebr|aritmet|matemat|calculo/.test(n)) return 'algebra';
  return null;
};

const PALABRAS: Record<Exclude<Dominio, 'general'>, RegExp> = {
  quimica: /\b(mol(es)?|molecula|atomo|atomic|uma|compuesto|elemento|reaccion|acido|base|ph|valencia|electron|enlace|oxido|sal(es)?|avogadro|formula|isotopo|ion(es)?|masa molar|masa molecular|estequiometr|solucion|molaridad|gas(es)? ideal)/g,
  fisica: /\b(velocidad|aceleracion|fuerza|newton|joule|watt|trabajo|energia|potencia|movimiento|mru|mruv|caida libre|gravedad|campo|carga|corriente|voltaje|resistencia|presion|densidad|friccion|impulso|momento|m\/s|km\/h|kg)\b/g,
  geometria: /\b(angulo|triangulo|grafico|figura|perimetro|area|circunferencia|radio|segmento|recta|poligono|cuadrilatero|vertice|bisectriz|mediatriz|paralel|perpendicular|halle x|calcular\s*:?\s*x)/g,
  algebra: /\b(ecuacion|polinomio|raiz|exponente|simplific|factoriz|logaritmo|log|inecuacion|funcion|valor de x|resolver|expresion)/g,
};

/** Materia por el vocabulario del texto (si el curso no la indica). */
export const detectarDominio = (texto: string): Dominio => {
  const t = sinTildes(texto);
  const puntos: Record<string, number> = {};
  for (const [dominio, patron] of Object.entries(PALABRAS)) puntos[dominio] = (t.match(patron) ?? []).length;
  // Fórmulas químicas reales (con números) pesan mucho: CO2, H2SO4, NaCl…
  puntos.quimica += 2 * (texto.match(/\b[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+\b/g) ?? []).filter((f) => /\d/.test(f) && esFormulaQuimica(f)).length;
  if (/\d\s*[°º]/.test(texto)) puntos.geometria += 1;
  // Medida de ángulo "m∠ABC" (o como la lee el OCR: m<ABC, mZABC, mxABC) es inconfundible.
  puntos.geometria += 2 * (texto.match(/(?<![\p{L}])m\s?[<∠∡Z2xX]\s?[A-Z]{3}(?![\p{L}])/gu) ?? []).length;
  // Segmentos con barra (\overline{AC}) también.
  puntos.geometria += 2 * (texto.match(/\\overline\{/g) ?? []).length;
  const [mejor, valor] = Object.entries(puntos).sort((a, b) => b[1] - a[1])[0];
  return valor >= 2 ? (mejor as Dominio) : 'general';
};

// ─────────────────────────────────────────────
// Fórmulas químicas
// ─────────────────────────────────────────────

const ELEMENTOS = new Set((
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr '
  + 'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm '
  + 'Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No '
  + 'Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og').split(' '));

/** Un subíndice escrito es ≥ 2, sin cero inicial y razonable (≤ 30). */
const subindiceValido = (d: string) => !d.startsWith('0') && Number(d) >= 2 && Number(d) <= 30;

/** ¿La cadena es una fórmula química válida? (símbolos reales, subíndices plausibles, paréntesis simples). */
export const esFormulaQuimica = (formula: string): boolean => {
  const s = formula.replace(/^\d+(?=[A-Z(])/, ''); // coeficiente: 2H2O
  let elementos = 0;
  const leer = (i: number, nivel: number): number => {
    while (i < s.length) {
      const c = s[i];
      if (c === '(') {
        const fin = leer(i + 1, nivel + 1);
        if (fin < 0 || s[fin] !== ')') return -1;
        i = fin + 1;
      } else if (c === ')') {
        return nivel > 0 ? i : -1;
      } else {
        const dos = s.slice(i, i + 2);
        const simbolo = /^[A-Z][a-z]$/.test(dos) && ELEMENTOS.has(dos) ? dos : ELEMENTOS.has(c) ? c : null;
        if (!simbolo) return -1;
        elementos++;
        i += simbolo.length;
      }
      const num = s.slice(i).match(/^\d+/)?.[0];
      if (num) {
        if (!subindiceValido(num)) return -1;
        i += num.length;
      }
    }
    return nivel === 0 ? i : -1;
  };
  return s.length > 0 && leer(0, 0) === s.length && elementos >= 1;
};

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '+': '⁺' };
const aSuperindice = (s: string) => s.split('').map((c) => SUP[c] ?? c).join('');

/** "H2SO4" → "H₂SO₄" (el coeficiente inicial queda normal: "2H2O" → "2H₂O"). */
export const formulaConSubindices = (formula: string) => {
  const coef = formula.match(/^\d+(?=[A-Z(])/)?.[0] ?? '';
  return coef + formula.slice(coef.length).replace(/([A-Za-z)])(\d+)/g, (_, a, d: string) => a + d.split('').map((x) => SUB[+x]).join(''));
};

/** Caracteres que el OCR confunde dentro de una fórmula y sus posibles lecturas correctas. */
const CONFUSIONES: Record<string, string[]> = {
  0: ['O'], O: ['0'], 5: ['S'], S: ['5'], z: ['2'], Z: ['2'], 8: ['B'], l: ['1', 'I'], 1: ['l', 'I'], $: ['S'], o: ['O'],
};

/**
 * Corrige una palabra que parece fórmula química mal leída probando las confusiones típicas
 * y quedándose con la versión válida que requiera menos cambios. Si no hay ninguna, la deja igual.
 */
export const corregirFormula = (palabra: string): string | null => {
  if (palabra.length < 2 || palabra.length > 14 || !/^[0-9]*[A-Z(]/.test(palabra)) return null;
  if (!/\d|z|\$/.test(palabra)) return null; // sin números ni confusiones: es una palabra o una fórmula sin subíndices
  // Sin números, solo se intenta si tiene 2+ mayúsculas ("AuzO"); así "Luz" no se vuelve "Lu₂".
  if (!/\d/.test(palabra) && (palabra.match(/[A-Z]/g) ?? []).length < 2) return null;
  if (esFormulaQuimica(palabra)) return formulaConSubindices(palabra);

  const posiciones = [...palabra].map((c, i) => (CONFUSIONES[c] ? i : -1)).filter((i) => i >= 0).slice(0, 8);
  // Costo = cambios + penalización por subíndices raros (> 12): "H2504" → H₂SO₄ (2 cambios) gana a H₂₅O₄ (1 cambio + 2).
  const costo = (candidato: string, cambios: number) =>
    cambios + 2 * (candidato.replace(/^\d+/, '').match(/\d+/g) ?? []).filter((n) => Number(n) > 12).length;
  let mejor: { texto: string; costo: number } | null = null;
  const probar = (k: number, actual: string[], cambios: number) => {
    if (mejor && cambios >= mejor.costo) return;
    if (k === posiciones.length) {
      const candidato = actual.join('');
      if (cambios > 0 && /\d/.test(candidato.replace(/^\d+/, '')) && esFormulaQuimica(candidato)) {
        const c = costo(candidato, cambios);
        if (!mejor || c < mejor.costo) mejor = { texto: candidato, costo: c };
      }
      return;
    }
    probar(k + 1, actual, cambios);
    const i = posiciones[k];
    for (const alternativa of CONFUSIONES[palabra[i]]) {
      const copia = [...actual];
      copia[i] = alternativa;
      probar(k + 1, copia, cambios + 1);
    }
  };
  probar(0, [...palabra], 0);
  return mejor ? formulaConSubindices((mejor as { texto: string }).texto) : null;
};

// ─────────────────────────────────────────────
// Reglas por materia
// ─────────────────────────────────────────────

/** Notación científica: "3 x 10-5" → "3 × 10⁻⁵"; constante de Avogadro "6,023 x 102:" → "6,023 × 10²³". */
const corregirNotacionCientifica = (linea: string) =>
  linea
    .replace(/(6\s?[.,\s]?\s?02\d*)\s*[xX×]\s*10[\d:;,.'’"]*\s*/g, '$1 × 10²³ ')
    .replace(/(\d)\s*[xX×]\s*10(-?\d{1,2})(?=\s|$|[\p{L}])/gu, (_, n, e) => `${n} × 10${aSuperindice(e)}`);

const corregirQuimica = (linea: string) => {
  let l = corregirNotacionCientifica(linea);
  // "0 = 16" en una lista de masas atómicas es el oxígeno.
  l = l.replace(/(^|[\s;,(])0(?=\s*=\s*\d)/g, '$1O');
  // "=1C=12" → "=1 C=12": el OCR pega el valor anterior con el siguiente símbolo.
  l = l.replace(/(\d)([A-Z][a-z]?)(?=\s*=)/g, '$1 $2');
  // Masas atómicas con espaciado uniforme: "C=12" / "=1" → "C = 12" / "= 1".
  l = l.replace(/([A-Z][a-z]?)?\s*=\s*(\d)/g, (_, s: string | undefined, d: string) => `${s ? `${s} ` : ''}= ${d}`);
  // Palabras que parecen fórmulas: se validan contra la tabla periódica.
  return l.replace(/(?<![\p{L}\p{N}])[0-9]*[A-Z(][A-Za-z0-9()$]*(?![\p{L}\p{N}])/gu, (p) => corregirFormula(p) ?? p);
};

const corregirFisica = (linea: string) =>
  corregirNotacionCientifica(linea)
    // m/s2 → m/s², 20 m2 → 20 m²
    .replace(/(\/\s?(?:s|h|min|m|cm|km))([23])(?![\p{L}\p{N}])/gu, (_, u, e) => u + aSuperindice(e))
    .replace(/(\d\s?(?:m|cm|km|mm|dm))([23])(?![\p{L}\p{N}])/gu, (_, u, e) => u + aSuperindice(e))
    // 25 *C / 25 ºC → 25 °C
    .replace(/(\d)\s?[*º]\s?C(?![\p{L}])/gu, '$1 °C');

/**
 * Notación de geometría:
 *  - el símbolo de ángulo "∠" se lee como Z, 2, A, < o £: "M2DBC" / "mZACB" / "m ZABC" → "m∠DBC", "m∠ACB", "m∠ABC"
 *  - el "°" pequeño se lee como ", ”, ', º, P o ?: "=10\"" / "=120P" → "=10°" / "=120°"
 */
const corregirGeometria = (linea: string) =>
  linea
    // ∠ y ∡ (ángulo medido) se leen como Z, 2, A, <, £ o x: "M2DBC", "mxABC", "m<BCA" → "m∠DBC"…
    // A veces se cuela una "M" delante: "MmXBAC" → "m∠BAC".
    .replace(/(?<![\p{L}])M?[mM]\s?[Z2∠∡<£zAxX]\s?([A-Z]{3})(?![\p{L}])/gu, 'm∠$1')
    // Rectas L₁, L₂: el subíndice pequeño se lee como letra ("L1 y Ly" → "L₁ y L₂").
    .replace(/(?<![\p{L}])L([1-8])\s+y\s+L[a-z0-9](?![\p{L}\p{N}])/gu, (_, n: string) => `L${SUB[+n]} y L${SUB[+n + 1]}`)
    .replace(/(?<![\p{L}])L([1-9])(?![\p{L}\p{N}])/gu, (_, n: string) => `L${SUB[+n]}`)
    .replace(/(?<![\p{L}\p{N}])[Z∠∡<](?=[A-Z]{3}(?![\p{L}]))/gu, '∠')
    .replace(/(\d)["”'’ºP?](?=[\s.,;)]|$)/g, '$1°');

/** x? / x* / x” → x² (el OCR no distingue el "2" pequeño). */
const corregirAlgebra = (linea: string) =>
  linea.replace(/(?<![\p{L}])([a-zA-Z])[?*”"](?=\s|[+\-=)]|$)/gu, '$1²');

/** Aplica las correcciones de la materia a una línea. */
export const corregirLineaCientifica = (linea: string, dominio: Dominio): string => {
  switch (dominio) {
    case 'quimica': return corregirQuimica(linea);
    case 'fisica': return corregirFisica(linea);
    case 'algebra': return corregirAlgebra(linea);
    case 'geometria': return corregirGeometria(linea);
    default: return linea;
  }
};

// ─────────────────────────────────────────────
// Vocabulario de examen (palabras a las que el OCR les cambia una letra)
// ─────────────────────────────────────────────

const VOCABULARIO = [
  'triángulo', 'triángulos', 'ángulo', 'ángulos', 'rectángulo', 'cuadrilátero', 'circunferencia', 'perímetro',
  'bisectriz', 'mediatriz', 'segmento', 'segmentos', 'ceviana', 'cevianas', 'interiores', 'exteriores', 'interior',
  'exterior', 'intersectan', 'determinar', 'determine', 'calcule', 'calcular', 'número', 'números', 'valores',
  'enteros', 'figura', 'gráfico', 'vértice', 'vértices', 'paralelas', 'paralelo', 'perpendicular', 'polígono',
  'isósceles', 'equilátero', 'hipotenusa', 'catetos', 'diagonal', 'longitud', 'medida', 'moléculas', 'molécula',
  'compuesto', 'compuestos', 'atómicas', 'atómica', 'molecular', 'velocidad', 'aceleración', 'ecuación',
  'expresión', 'siguientes', 'diferentes', 'alternativa', 'elementos', 'presente', 'gramos', 'intersección',
];
const VOCAB_NORMAL = new Map(VOCABULARIO.map((p) => [sinTildes(p), p]));

/** Grupos de caracteres que el OCR confunde entre sí (nunca a/o: cambiaría el género de la palabra). */
const GRUPOS_CONFUSION = ['il1j|', 'o0', 'ec', 'rn'];
const seConfunden = (x: string, y: string) => GRUPOS_CONFUSION.some((g) => g.includes(x) && g.includes(y));

/** Una sola letra distinta y que sea una confusión típica del OCR: "triánguio" ↔ "triángulo". */
const difiereEnUnaLetra = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diferencias = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (++diferencias > 1 || !seConfunden(a[i], b[i])) return false;
  }
  return diferencias === 1;
};

/** Corrige palabras largas (≥ 7 letras) del vocabulario de examen con una letra mal leída. */
export const corregirVocabulario = (linea: string) =>
  linea.replace(/\p{L}{7,}/gu, (palabra) => {
    const n = sinTildes(palabra);
    if (VOCAB_NORMAL.has(n)) return palabra;
    for (const [clave, correcta] of VOCAB_NORMAL) {
      if (difiereEnUnaLetra(n, clave)) {
        return palabra[0] === palabra[0].toUpperCase() ? correcta[0].toUpperCase() + correcta.slice(1) : correcta;
      }
    }
    return palabra;
  });
