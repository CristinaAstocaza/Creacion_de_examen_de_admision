import { parseQuestionsHeuristically, formatScientificAndOCR } from './preguntaParser';

let passed = 0;
let failed = 0;

const check = (label: string, actual: string, expected: string) => {
  const ok = actual === expected;
  if (ok) passed++; else failed++;
  console.log(`${ok ? '✅' : '❌'} ${label}\n   actual:   "${actual}"\n   expected: "${expected}"`);
};

const checkQ = (label: string, text: string, expectedAlt: string[]) => {
  const r = parseQuestionsHeuristically(text);
  const alts = r.questions[0]?.alternativas.map((a: any) => {
    const v = JSON.parse(a.contenido)[0]?.valor;
    return `${a.letra}) ${v}`;
  }) ?? [];
  const allMatch = alts.length === expectedAlt.length && alts.every((a, i) => a === expectedAlt[i]);
  if (allMatch) passed++; else failed++;
  console.log(`${allMatch ? '✅' : '❌'} ${label}`);
  if (!allMatch) {
    console.log('   actual:   ', alts);
    console.log('   expected: ', expectedAlt);
  }
};

console.log('\n── Formato Científico / OCR ─────────────────────────────');
check('H2SO3',        formatScientificAndOCR('H2SO3'),        'H₂SO₃');
check('CO2',          formatScientificAndOCR('CO2'),          'CO₂');
check('H2SO4',        formatScientificAndOCR('H2SO4'),        'H₂SO₄');
check('Ca(OH)2',      formatScientificAndOCR('Ca(OH)2'),      'Ca(OH)₂');
check('H 2 S O 4',   formatScientificAndOCR('H 2 S O 4'),    'H₂SO₄');
check('x2',           formatScientificAndOCR('x2'),           'x²');
check('a2 + b2',      formatScientificAndOCR('a2 + b2'),      'a² + b²');
check('9,81 i',       formatScientificAndOCR('9,81 i'),       '9,81 i');
check('12,6 i',       formatScientificAndOCR('12,6 i'),       '12,6 i');
check('-9,81 i',      formatScientificAndOCR('-9,81 i'),      '-9,81 i');
check('30 °C',        formatScientificAndOCR('30 °C'),        '30 °C');
check('5 i m/s',      formatScientificAndOCR('5 i m/s'),      '5 i m/s');
check('9,81 m/s²',   formatScientificAndOCR('9,81 m/s²'),    '9,81 m/s²');
check('2 kg',         formatScientificAndOCR('2 kg'),         '2 kg');

console.log('\n── Parser: Vectores (nuevos casos) ─────────────────────');
checkQ('Vectores en líneas separadas',
  `A) -2i +3j\nB) -2i + 6j\nC) 2i - 6j\nD) -6i - 2j\nE) -2i- 6j`,
  ['A) -2i +3j', 'B) -2i + 6j', 'C) 2i - 6j', 'D) -6i - 2j', 'E) -2i- 6j']
);
checkQ('Vectores en una sola línea',
  `A) -2i +3j B) -2i + 6j C) 2i - 6j D) -6i - 2j E) -2i- 6j`,
  ['A) -2i +3j', 'B) -2i + 6j', 'C) 2i - 6j', 'D) -6i - 2j', 'E) -2i- 6j']
);
checkQ('Vectores con enunciado',
  `Cuerpo con fuerza vectorial\n\nA) -2i +3j\nB) -2i + 6j\nC) 2i - 6j\nD) -6i - 2j\nE) -2i- 6j`,
  ['A) -2i +3j', 'B) -2i + 6j', 'C) 2i - 6j', 'D) -6i - 2j', 'E) -2i- 6j']
);

console.log('\n── Parser: Casos previos ────────────────────────────────');
checkQ('Pregunta sin numeración',
  `¿Qué es Java?\n\nA) Lenguaje\nB) Sistema\nC) Navegador\nD) Protocolo\nE) Framework`,
  ['A) Lenguaje', 'B) Sistema', 'C) Navegador', 'D) Protocolo', 'E) Framework']
);
checkQ('Alternativas pegadas inline',
  `A) Lima B) Cusco C) Piura D) Ica E) Tacna`,
  ['A) Lima', 'B) Cusco', 'C) Piura', 'D) Ica', 'E) Tacna']
);
checkQ('Física sin modificar',
  `Velocidad\n\nA) 9,81 i\nB) 12,6 i\nC) 14,1 i\nD) -9,81 i\nE) -12,6 i`,
  ['A) 9,81 i', 'B) 12,6 i', 'C) 14,1 i', 'D) -9,81 i', 'E) -12,6 i']
);

console.log(`\n── RESULTADO FINAL: ${passed}/${passed+failed} pruebas OK ─────────────────`);
