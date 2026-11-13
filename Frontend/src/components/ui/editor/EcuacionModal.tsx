import { useEffect, useRef, useState } from 'react';
import { MathfieldElement } from 'mathlive';
import './EcuacionModal.css';

// MathLive funciona sin internet: sus fuentes se sirven desde /mathlive/fonts (scripts/copiar-recursos.mjs).
MathfieldElement.fontsDirectory = `${import.meta.env.BASE_URL}mathlive/fonts`;
MathfieldElement.soundsDirectory = null;
MathfieldElement.locale = 'es';

/** Atajos de un clic para lo más usado en exámenes (#@ = selección, #? = casilla a completar). */
const ATAJOS: { etiqueta: React.ReactNode; titulo: string; latex: string }[] = [
  { etiqueta: '°', titulo: 'Grado', latex: '^{\\circ}' },
  { etiqueta: <span>x<sup>2</sup></span>, titulo: 'Superíndice / potencia', latex: '#@^{#?}' },
  { etiqueta: <span>x<sub>2</sub></span>, titulo: 'Subíndice', latex: '#@_{#?}' },
  { etiqueta: '≈', titulo: 'Aproximadamente', latex: '\\approx ' },
  { etiqueta: <span className="eq-frac"><span>a</span><span>b</span></span>, titulo: 'Fracción', latex: '\\frac{#@}{#?}' },
  { etiqueta: '√', titulo: 'Raíz cuadrada', latex: '\\sqrt{#@}' },
  { etiqueta: <span><sup>n</sup>√</span>, titulo: 'Raíz n-ésima', latex: '\\sqrt[#?]{#@}' },
  { etiqueta: '±', titulo: 'Más o menos', latex: '\\pm ' },
  { etiqueta: '×', titulo: 'Por', latex: '\\times ' },
  { etiqueta: '÷', titulo: 'Entre', latex: '\\div ' },
  { etiqueta: '≠', titulo: 'Diferente', latex: '\\neq ' },
  { etiqueta: '≤', titulo: 'Menor o igual', latex: '\\leq ' },
  { etiqueta: '≥', titulo: 'Mayor o igual', latex: '\\geq ' },
  { etiqueta: 'π', titulo: 'Pi', latex: '\\pi ' },
  { etiqueta: '∠', titulo: 'Ángulo', latex: '\\angle ' },
  { etiqueta: <span className="eq-sobre">AB</span>, titulo: 'Segmento (barra encima)', latex: '\\overline{#@}' },
  { etiqueta: '∞', titulo: 'Infinito', latex: '\\infty ' },
  { etiqueta: 'Δ', titulo: 'Delta', latex: '\\Delta ' },
  { etiqueta: 'θ', titulo: 'Theta', latex: '\\theta ' },
  { etiqueta: 'α', titulo: 'Alfa', latex: '\\alpha ' },
];

interface Props {
  /** LaTeX inicial (al editar una fórmula existente). */
  latexInicial?: string;
  onCancelar: () => void;
  onInsertar: (latex: string) => void;
}

/**
 * Editor de ecuaciones: fórmula visual con teclado matemático (123, símbolos, abc, αβγ)
 * y el código LaTeX equivalente, sincronizados en ambos sentidos.
 */
export default function EcuacionModal({ latexInicial = '', onCancelar, onInsertar }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<MathfieldElement | null>(null);
  const [latex, setLatex] = useState(latexInicial);

  useEffect(() => {
    const campo = new MathfieldElement();
    campo.mathVirtualKeyboardPolicy = 'manual';
    campo.smartFence = true;
    campo.value = latexInicial;
    campo.className = 'eq-campo';
    campo.setAttribute('aria-label', 'Fórmula matemática');
    campo.addEventListener('input', () => setLatex(campo.getValue('latex-without-placeholders')));
    campo.addEventListener('focusin', () => window.mathVirtualKeyboard.show());
    contenedorRef.current?.appendChild(campo);
    campoRef.current = campo;
    requestAnimationFrame(() => campo.focus());

    return () => {
      window.mathVirtualKeyboard.hide();
      campo.remove();
      campoRef.current = null;
    };
  }, [latexInicial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancelar]);

  const cambiarCodigo = (valor: string) => {
    setLatex(valor);
    if (campoRef.current) campoRef.current.value = valor;
  };

  const alternarTeclado = () => {
    const teclado = window.mathVirtualKeyboard;
    if (teclado.visible) teclado.hide();
    else {
      campoRef.current?.focus();
      teclado.show();
    }
  };

  const insertar = () => {
    window.mathVirtualKeyboard.hide();
    onInsertar(latex.trim());
  };

  /** Inserta una plantilla en la fórmula (#@ = lo seleccionado, #? = casilla para completar). */
  const insertarEnCampo = (plantilla: string) => {
    const campo = campoRef.current;
    if (!campo) return;
    campo.insert(plantilla, { focus: true, selectionMode: 'placeholder', format: 'latex' });
    setLatex(campo.getValue('latex-without-placeholders'));
  };

  return (
    <div className="eq-overlay" onMouseDown={onCancelar}>
      <div
        className="eq-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eq-titulo"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="eq-header">
          <h3 id="eq-titulo">Editor de ecuaciones</h3>
          <button type="button" className="eq-cerrar" onClick={onCancelar} aria-label="Cerrar">
            <span className="material-icons-outlined">close</span>
          </button>
        </header>

        <label className="eq-label">Fórmula matemática</label>
        <div className="eq-campo-wrap">
          <div ref={contenedorRef} className="eq-campo-host" />
          <button type="button" className="eq-teclado" onClick={alternarTeclado} title="Mostrar u ocultar el teclado matemático" aria-label="Teclado matemático">
            <span className="material-icons-outlined">keyboard</span>
          </button>
        </div>

        <div className="eq-atajos" role="toolbar" aria-label="Símbolos frecuentes">
          {ATAJOS.map((a) => (
            <button
              key={a.titulo}
              type="button"
              className="eq-atajo"
              title={a.titulo}
              aria-label={a.titulo}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertarEnCampo(a.latex)}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>

        <label className="eq-label" htmlFor="eq-codigo">Código LaTeX</label>
        <textarea
          id="eq-codigo"
          className="eq-codigo"
          rows={2}
          value={latex}
          placeholder="Escribir código LaTeX, por ejemplo \frac{a}{b}"
          spellCheck={false}
          onChange={(e) => cambiarCodigo(e.target.value)}
        />

        <footer className="eq-footer">
          <button type="button" className="eq-btn eq-btn-sec" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="eq-btn eq-btn-pri" onClick={insertar} disabled={!latex.trim()}>
            {latexInicial ? 'Actualizar' : 'Insertar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
