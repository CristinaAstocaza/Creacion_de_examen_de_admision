/**
 * Copia a public/ los recursos que el sistema necesita para funcionar SIN internet.
 * Se ejecuta antes de `dev` y `build`.
 *  - public/ocr:              OCR (tesseract.js): worker, motor WebAssembly e idioma español.
 *  - public/mathlive/fonts:   fuentes del editor de ecuaciones (MathLive).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(raiz, 'node_modules');

const copiar = (destino, archivos) => {
  mkdirSync(destino, { recursive: true });
  for (const [origen, nombre] of archivos) {
    if (!existsSync(origen)) {
      console.error(`[recursos] Falta ${origen}. Ejecuta "npm install".`);
      process.exit(1);
    }
    copyFileSync(origen, join(destino, nombre));
  }
  return archivos.length;
};

const ocr = copiar(join(raiz, 'public', 'ocr'), [
  [join(nm, 'tesseract.js', 'dist', 'worker.min.js'), 'worker.min.js'],
  [join(nm, '@tesseract.js-data', 'spa', '4.0.0_best_int', 'spa.traineddata.gz'), 'spa.traineddata.gz'],
  ...readdirSync(join(nm, 'tesseract.js-core'))
    .filter((f) => f.endsWith('.wasm.js'))
    .map((f) => [join(nm, 'tesseract.js-core', f), f]),
]);

const fuentesMathlive = join(nm, 'mathlive', 'fonts');
const mathlive = copiar(join(raiz, 'public', 'mathlive', 'fonts'),
  readdirSync(fuentesMathlive).map((f) => [join(fuentesMathlive, f), f]));

console.log(`[recursos] OCR: ${ocr} archivos · MathLive: ${mathlive} fuentes`);
