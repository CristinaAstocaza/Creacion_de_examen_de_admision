export interface ParsedLocalQuestion {
  numero?: number;
  enunciado: string; // JSON string representation of content blocks
  alternativas: { letra: string; contenido: string }[]; // contenido is JSON string of content blocks
}

export interface DiagnosticReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  questionsCount: number;
}

export interface ParserResult {
  questions: ParsedLocalQuestion[];
  diagnostics: DiagnosticReport;
}

const unicodeSupers = {
  '⁰':'0', '¹':'1', '²':'2', '³':'3', '⁴':'4', '⁵':'5', '⁶':'6', '⁷':'7', '⁸':'8', '⁹':'9'
};
const unicodeSubs = {
  '₀':'0', '₁':'1', '₂':'2', '₃':'3', '₄':'4', '₅':'5', '₆':'6', '₇':'7', '₈':'8', '₉':'9'
};

const normalizeUnicodeDigits = (str: string): string => {
  return str.split('').map(char => {
    if (char in unicodeSupers) return unicodeSupers[char as keyof typeof unicodeSupers];
    if (char in unicodeSubs) return unicodeSubs[char as keyof typeof unicodeSubs];
    return char;
  }).join('');
};

export const convertToBlocks = (text: string): { tipo: 'texto' | 'latex'; valor: string }[] => {
  if (!text) return [];

  let formatted = text;
  const commonElements = 'H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Fe|Cu|Zn|Ag|Au|Pt|Hg|Pb|U|Pu|Br|I';

  // Auxiliar para convertir fórmulas químicas complejas o elementos a LaTeX correcto sin \mathrm
  const toChemicalKatex = (str: string): string => {
    let result = str.replace(
      new RegExp(`(${commonElements})([₀₁₂₃₄₅₆₇₈₉\\d]+)`, 'g'),
      (_, element, num) => `${element}_{${normalizeUnicodeDigits(num)}}`
    );
    return result;
  };

  // 1. Iones (ej: Na+, Fe3+, Fe³⁺, Cl-)
  formatted = formatted.replace(
    new RegExp(`\\b(${commonElements})([₀₁₂₃₄₅₆₇₈₉\\d]*)([\\+\\-\\⁺\\⁻])\\b`, 'g'),
    (_, element, num, charge) => {
      const normNum = num ? normalizeUnicodeDigits(num) : '';
      const normCharge = charge === '⁺' || charge === '+' ? '+' : '-';
      return `$ ${element}^{${normNum}${normCharge}} $`;
    }
  );

  // 2. Isótopos (ej: ⁶Li, ⁷Li, 6Li, 235U)
  formatted = formatted.replace(
    new RegExp(`([⁰¹²³⁴⁵⁶⁷⁸⁹]+|\\b\\d+)(${commonElements})\\b`, 'g'),
    (_, num, element) => {
      const normNum = normalizeUnicodeDigits(num);
      return `$ {}^{${normNum}}\\mathrm{${element}} $`;
    }
  );

  // 3. Fórmulas químicas multi-elemento (ej: H2O, H₂O, CO2, H2SO4, NaCl)
  formatted = formatted.replace(
    new RegExp(`\\b((?:${commonElements})(?:[₀₁₂₃₄₅₆₇₈₉\\d]+)?(?:${commonElements})+(?:[₀₁₂₃₄₅₆₇₈₉\\d]+)?)\\b`, 'g'),
    (_, formula) => `$ ${toChemicalKatex(formula)} $`
  );

  // 4. Elementos individuales con números (ej: O2, N2, H2) - Excluimos Si y Al para evitar colisiones con "Si" y "Al" en español
  const singleElements = 'H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|P|S|Cl|Ar|K|Ca|Fe|Cu|Zn|Ag|Au|Pt|Hg|Pb|U|Pu|Br|I';
  formatted = formatted.replace(
    new RegExp(`\\b(${singleElements})([₀₁₂₃₄₅₆₇₈₉\\d]+)\\b`, 'g'),
    (_, element, num) => {
      const normNum = normalizeUnicodeDigits(num);
      return `$ ${element}_{${normNum}} $`;
    }
  );

  // 5. Exponentes algebraicos y unidades (ej: x2, m2, x², m², y³, k⁴)
  const mathVariables = 'x|y|z|n|a|b|c|k|m|X|Y|Z';
  formatted = formatted.replace(
    new RegExp(`\\b(${mathVariables})([²³⁴⁵⁶⁷⁸⁹⁰]+|\\^?\\d+)\\b`, 'g'),
    (_, variable, num) => {
      const normNum = normalizeUnicodeDigits(num.replace('^', ''));
      return `$ ${variable}^{${normNum}} $`;
    }
  );

  // Dividir por $ para separar texto normal y bloques de LaTeX
  const parts = formatted.split('$');
  const blocks = parts.map((part, index) => {
    if (index % 2 === 0) {
      return { tipo: 'texto' as const, valor: part };
    } else {
      return { tipo: 'latex' as const, valor: part.trim() };
    }
  }).filter(block => block.valor.length > 0);

  return blocks;
};

/**
 * Normaliza el texto eliminando saltos de línea duplicados excesivos,
 * retornos de carro (\r), y espacios innecesarios al final de las líneas,
 * conservando la separación de párrafos reales.
 */
export const normalizeText = (text: string): string => {
  // 1. Eliminar encabezados de página generados por extracción de PDF (ej. "--- PÁGINA 1 ---")
  let cleaned = text.replace(/--- PÁGINA \d+ ---/gi, '\n');

  // 2. Normalizar retornos de carro
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 3. Insertar saltos de línea antes de preguntas numeradas embebidas (ej. "1.", "Pregunta 2.")
  // Limitamos el número a un rango de 1 a 3 dígitos para evitar chocar con años o decimales
  cleaned = cleaned.replace(/\s+((?:Pregunta|PREGUNTA)\s+\d+[\)\.\:\-]?\s+)/gi, '\n$1');
  cleaned = cleaned.replace(/\s+(\d{1,3}[\)\.\:\-]\s+)/g, '\n$1');

  // 4. Insertar saltos de línea antes de las alternativas embebidas (ej. " a)", " B.")
  // IMPORTANTE: solo se acepta ) y . como separadores en la fase inline.
  // NO se usa - ni : porque colisionan con vectores ("2i - 6j") y expresiones matemáticas.
  cleaned = cleaned.replace(/\s+([a-eA-E][\)\.][ \t]+)/g, '\n$1');

  // 5. Limpiar espacios al final de cada línea
  let normalized = cleaned.split('\n').map(line => line.trimEnd()).join('\n');

  // 6. Reemplazar 3 o más saltos de línea consecutivos por exactamente dos (para conservar párrafos)
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  return normalized;
};

const mapToSubscript = (numStr: string): string => {
  const subs: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
  };
  return numStr.split('').map(char => subs[char] || char).join('');
};

const mapToSuperscript = (numStr: string): string => {
  const supers: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
  };
  return numStr.split('').map(char => supers[char] || char).join('');
};

/**
 * Corrige errores comunes de OCR en símbolos científicos e inserta
 * subíndices/superíndices en fórmulas químicas y expresiones algebraicas de forma contextual.
 */
export const formatScientificAndOCR = (text: string): string => {
  let formatted = text;

  // 1. Corregir errores comunes de OCR
  // 1.1. Letra 'O' confundida con cero '0' en fórmulas químicas (ej. S04 -> SO4, C02 -> CO2)
  // Solo cuando va precedida de una letra mayúscula (elemento químico real)
  formatted = formatted.replace(/([A-Z][a-z]?)0(\d)/g, '$1O$2');
  
  // 1.2. Cero '0' confundido con letra 'O' en números (ej. 2O -> 20, 1O -> 10, O.5 -> 0.5)
  // Solo cuando la 'O' está al final de un número (no al inicio de una fórmula)
  formatted = formatted.replace(/(\d)O\b(?![a-zA-Z])/g, '$10');
  formatted = formatted.replace(/\bO\.(\d+)/g, '0.$1');

  // 2. Contraer espacios en fórmulas químicas (ej. H 2 S O 4 -> H2SO4)
  // Nota: ELIMINAMOS la contracción "dígito + espacio + elemento" porque produce
  // falsos positivos en valores físicos como "9,81 i" → "9,81I" → "9,₈₁I"
  // Solo contraemos cuando el ELEMENTO precede al número (dirección semántica correcta)
  // Excluimos Si y Al para evitar falsas contracciones con "Si" y "al" en español
  const contractionElements = 'H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|P|S|Cl|Ar|K|Ca|Fe|Cu|Zn|Ag|Au|Pt|Hg|Pb';
  
  for (let k = 0; k < 3; k++) {
    // Contraer Elemento + Espacio + Número (ej. H 2 -> H2) - restringido a espacios horizontales
    formatted = formatted.replace(new RegExp(`(${contractionElements})[ \\t]+(\\d+)`, 'g'), '$1$2');
    // Contraer Elemento + Espacio + Elemento (ej. S O -> SO)
    formatted = formatted.replace(new RegExp(`(${contractionElements})[ \\t]+(${contractionElements})`, 'g'), '$1$2');
  }

  // 3. Convertir a Subíndices en fórmulas químicas (ej. H2SO3 -> H₂SO₃)
  // Regla crítica: el elemento debe ir INMEDIATAMENTE precedido de:
  //   - inicio de cadena, OR
  //   - otro elemento químico (letra mayúscula), OR
  //   - un dígito (para fórmulas como 2H2O)
  //   - un paréntesis de apertura (para grupos como (OH)2)
  // NO debe activarse cuando el número va precedido de: coma, punto decimal, guión/negativo, espacio.
  formatted = formatted.replace(
    new RegExp(`(${contractionElements})(\\d+)`, 'g'),
    (match, element, num, offset, str) => {
      // Verificar el carácter que precede al elemento
      const prevChar = offset > 0 ? str[offset - 1] : '';
      // Si el elemento está precedido de coma, punto, guión, espacio u otro dígito que no es un subíndice
      // (indicador de valor numérico/físico), no convertir
      if (/[,.\-\s\d]/.test(prevChar) && !/[A-Z]/.test(prevChar)) {
        return match;
      }
      return element + mapToSubscript(num);
    }
  );

  // 3b. Segunda contracción: fusionar espacio residual entre subíndice y siguiente elemento
  // Esto resuelve "H₂ SO₄" → "H₂SO₄" tras la conversión de subíndices
  const subDigits = '₀₁₂₃₄₅₆₇₈₉';
  formatted = formatted.replace(
    new RegExp(`([${subDigits}])[ \\t]+(${contractionElements})`, 'g'),
    '$1$2'
  );

  // Convertir subíndices después de paréntesis de grupos químicos (ej. (OH)2 -> (OH)₂)
  formatted = formatted.replace(
    /\)(\d+)/g,
    (_, num) => ')' + mapToSubscript(num)
  );

  // 4. Convertir a Superíndices en variables algebraicas (ej. x2 -> x², y3 -> y³)
  // Requiere adyacencia directa (sin espacio) para evitar "y 10" → "y¹⁰"
  // Solo variables de una letra y dígito inmediato
  const mathVariables = 'x|y|z|n|a|b|c|k';
  formatted = formatted.replace(
    new RegExp(`\\b(${mathVariables})(\\d+)\\b`, 'g'),
    (match, variable, num, offset, str) => {
      // No convertir si la variable está precedida por un dígito (ej. "5x" no → "5x²")
      const prevChar = offset > 0 ? str[offset - 1] : '';
      if (/\d/.test(prevChar)) return match;
      return variable + mapToSuperscript(num);
    }
  );

  return formatted;
};

/**
 * Parsea un texto plano e identifica preguntas de forma heurística,
 * tolerando la ausencia de números, formatos de alternativas diversos
 * y enunciados de múltiples líneas.
 */
export const parseQuestionsHeuristically = (text: string): ParserResult => {
  const normalizedText = normalizeText(text);
  const formattedText = formatScientificAndOCR(normalizedText);
  const rawLines = formattedText.split('\n');
  const questions: ParsedLocalQuestion[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  interface TaggedLine {
    originalText: string;
    type: 'header' | 'alt' | 'text' | 'blank';
    letra?: string;
    altValue?: string;
    number?: number;
    headerText?: string;
  }

  const taggedLines: TaggedLine[] = [];

  // Expresiones regulares tolerantes
  const qStartRegex = /^(?:Pregunta|PREGUNTA)\s+(\d+)[\)\.\:\-]?\s*(.*)$/i;
  const qStartNumberOnlyRegex = /^(\d+)[\)\.\:\-]\s*(.*)$/;
  const altRegex = /^\s*([a-eA-E])\s*[\)\.\:\-]\s*(.*)$/;

  for (let line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      taggedLines.push({ originalText: line, type: 'blank' });
      continue;
    }

    // Match Header "Pregunta X"
    const headerMatch = line.match(qStartRegex);
    if (headerMatch) {
      taggedLines.push({
        originalText: line,
        type: 'header',
        number: parseInt(headerMatch[1]),
        headerText: headerMatch[2]
      });
      continue;
    }

    // Match Header "X."
    const numberOnlyMatch = line.match(qStartNumberOnlyRegex);
    if (numberOnlyMatch) {
      taggedLines.push({
        originalText: line,
        type: 'header',
        number: parseInt(numberOnlyMatch[1]),
        headerText: numberOnlyMatch[2]
      });
      continue;
    }

    // Match Alternative
    const altMatch = line.match(altRegex);
    if (altMatch) {
      taggedLines.push({
        originalText: line,
        type: 'alt',
        letra: altMatch[1].toUpperCase(),
        altValue: altMatch[2]
      });
      continue;
    }

    // Text line
    taggedLines.push({
      originalText: line,
      type: 'text'
    });
  }

  // Variables para la agrupación
  let currentEnunciadoLines: string[] = [];
  let currentAlternatives: { letra: string; text: string }[] = [];
  let activeAlternative: { letra: string; text: string } | null = null;
  let currentNumber: number | undefined = undefined;

  // Lookahead para detectar si la siguiente sección comienza una nueva pregunta
  const isNextQuestionStarting = (index: number): boolean => {
    for (let i = index; i < taggedLines.length; i++) {
      const tl = taggedLines[i];
      if (tl.type === 'blank') continue;
      if (tl.type === 'header') return true;
      if (tl.type === 'alt') {
        if (tl.letra === 'A') {
          // Un nuevo bloque de alternativas A-E sólo comienza una nueva pregunta si ya recolectamos alternativas
          // para la pregunta activa. Si no hay alternativas en la pregunta actual, esta A) es la primera de ella.
          return currentAlternatives.length > 0 || activeAlternative !== null;
        }
        
        // Si la letra de la alternativa ya está presente en la pregunta actual,
        // significa que este es el bloque de alternativas de la siguiente pregunta (ej. el docente no puso A) o se escaneó mal)
        const letterAlreadyPresent = currentAlternatives.some(a => a.letra === tl.letra) || (activeAlternative?.letra === tl.letra);
        if (letterAlreadyPresent) {
          return true;
        }

        return false; // Si vemos B, C, D, E antes de A y no están repetidas, asumimos que pertenecen al mismo grupo
      }
    }
    return false;
  };

  const commitQuestion = () => {
    if (activeAlternative) {
      currentAlternatives.push({
        letra: activeAlternative.letra,
        text: activeAlternative.text.trim()
      });
      activeAlternative = null;
    }

    if (currentEnunciadoLines.length > 0 || currentAlternatives.length > 0) {
      const enunciadoText = currentEnunciadoLines.join('\n').trim();
      questions.push({
        numero: currentNumber,
        enunciado: JSON.stringify(convertToBlocks(enunciadoText)),
        alternativas: currentAlternatives.map(alt => ({
          letra: alt.letra,
          contenido: JSON.stringify(convertToBlocks(alt.text))
        }))
      });
    }

    currentEnunciadoLines = [];
    currentAlternatives = [];
    currentNumber = undefined;
  };

  for (let i = 0; i < taggedLines.length; i++) {
    const tl = taggedLines[i];

    if (tl.type === 'blank') {
      if (activeAlternative) {
        if (isNextQuestionStarting(i + 1)) {
          commitQuestion();
        } else {
          activeAlternative.text += '\n';
        }
      } else if (currentEnunciadoLines.length > 0 && currentAlternatives.length === 0) {
        if (isNextQuestionStarting(i + 1)) {
          commitQuestion();
        } else {
          currentEnunciadoLines.push('');
        }
      }
      continue;
    }

    if (tl.type === 'header') {
      commitQuestion();
      currentNumber = tl.number;
      if (tl.headerText) {
        currentEnunciadoLines.push(tl.headerText);
      }
      continue;
    }

    if (tl.type === 'alt') {
      const altAlreadyPresent = currentAlternatives.some(a => a.letra === tl.letra) || (activeAlternative?.letra === tl.letra);
      if (tl.letra === 'A' && (altAlreadyPresent || currentAlternatives.length > 0)) {
        commitQuestion();
      }

      if (activeAlternative) {
        currentAlternatives.push({
          letra: activeAlternative.letra,
          text: activeAlternative.text.trim()
        });
      }

      activeAlternative = {
        letra: tl.letra!,
        text: tl.altValue || ''
      };

      // Inline consecutive alternatives parser (A) X B) Y)
      // Solo ) y . como separadores inline para evitar falsos positivos con vectores ("2i - 6j")
      const inlineAltRegex = /[ \t]+([b-eB-E])\s*[\)\.][ \t]+/g;
      let inlineMatches = [];
      let match;
      const textToParse = activeAlternative.text;
      while ((match = inlineAltRegex.exec(textToParse)) !== null) {
        inlineMatches.push({
          letra: match[1].toUpperCase(),
          index: match.index,
          length: match[0].length
        });
      }

      if (inlineMatches.length > 0) {
        activeAlternative.text = textToParse.substring(0, inlineMatches[0].index);
        currentAlternatives.push({
          letra: activeAlternative.letra,
          text: activeAlternative.text.trim()
        });

        for (let j = 0; j < inlineMatches.length; j++) {
          const m = inlineMatches[j];
          const start = m.index + m.length;
          const end = (j + 1 < inlineMatches.length) ? inlineMatches[j + 1].index : textToParse.length;
          activeAlternative = {
            letra: m.letra,
            text: textToParse.substring(start, end)
          };
          if (j < inlineMatches.length - 1) {
            currentAlternatives.push({
              letra: activeAlternative.letra,
              text: activeAlternative.text.trim()
            });
          }
        }
      }
      continue;
    }

    if (tl.type === 'text') {
      if (activeAlternative) {
        if (isNextQuestionStarting(i)) {
          commitQuestion();
          currentEnunciadoLines.push(tl.originalText);
        } else {
          activeAlternative.text += '\n' + tl.originalText;
        }
      } else {
        currentEnunciadoLines.push(tl.originalText);
      }
    }
  }

  commitQuestion();

  // Post-procesado de números e inicialización de diagnósticos
  questions.forEach((q, idx) => {
    if (!q.numero) {
      q.numero = idx + 1;
    }
  });

  const questionCount = questions.length;
  let hasText = text.trim().length > 0;
  let hasAlternativesPattern = taggedLines.some(tl => tl.type === 'alt');

  if (!hasText) {
    errors.push('No hay contenido de texto para analizar.');
  } else if (questionCount === 0) {
    if (hasAlternativesPattern) {
      errors.push('Se detectó la presencia de alternativas (A-E), pero no logramos identificar dónde comienza el enunciado de la pregunta.');
    } else {
      errors.push('No se encontraron patrones de alternativas válidas (ej. A), B), C)).');
    }
  } else {
    questions.forEach((q) => {
      const qNumStr = `Pregunta #${q.numero}`;
      const enunciadoText = q.enunciado ? JSON.parse(q.enunciado)[0]?.valor : '';
      if (!enunciadoText || enunciadoText.trim().length === 0) {
        warnings.push(`${qNumStr}: Falta definir el enunciado de la pregunta.`);
      } else if (enunciadoText.trim().length < 10) {
        warnings.push(`${qNumStr}: El enunciado es demasiado corto (debe tener al menos 10 caracteres).`);
      }

      // Filtrar y validar alternativas con contenido real
      const altsWithContent = q.alternativas.filter(alt => {
        try {
          const val = alt.contenido ? JSON.parse(alt.contenido)[0]?.valor : '';
          return val && val.trim().length > 0;
        } catch (e) {
          return false;
        }
      });

      const emptyAlts = q.alternativas.filter(alt => {
        try {
          const val = alt.contenido ? JSON.parse(alt.contenido)[0]?.valor : '';
          return !val || val.trim().length === 0;
        } catch (e) {
          return true;
        }
      }).map(alt => alt.letra);

      if (emptyAlts.length > 0) {
        warnings.push(`${qNumStr}: Las alternativas (${emptyAlts.join(', ')}) están vacías o no tienen texto válido.`);
      }

      if (altsWithContent.length < 5) {
        warnings.push(`${qNumStr}: Se detectaron solo ${altsWithContent.length} alternativas válidas con contenido (se requieren 5 de A a E).`);
      }

      const letters = altsWithContent.map(a => a.letra);
      const expectedLetters = ['A', 'B', 'C', 'D', 'E'];
      const missingLetters = expectedLetters.filter(l => !letters.includes(l));
      if (missingLetters.length > 0 && altsWithContent.length < 5) {
        warnings.push(`${qNumStr}: Falta la letra de alternativa con contenido: ${missingLetters.join(', ')}.`);
      }
    });
  }

  return {
    questions,
    diagnostics: {
      isValid: errors.length === 0,
      errors,
      warnings,
      questionsCount: questionCount
    }
  };
};
