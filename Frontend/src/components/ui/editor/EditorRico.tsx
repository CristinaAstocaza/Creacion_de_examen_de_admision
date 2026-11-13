import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import { ImagenConBotonQuitar } from './ImagenEditor';
import { Placeholder } from '@tiptap/extensions';
import { Mathematics } from '@tiptap/extension-mathematics';
import 'katex/dist/katex.min.css';
import './EditorRico.css';
import { bloquesADocumento, documentoABloques } from '../../../utils/documentoEditor';
import { uploadRecorte } from '../../../services/preguntaService';
import { toast } from '../toast';

// MathLive pesa bastante: solo se descarga al abrir el editor de ecuaciones.
const EcuacionModal = lazy(() => import('./EcuacionModal'));

interface Props {
  /** Contenido guardado (JSON de bloques). */
  value: string | null | undefined;
  onChange: (contenido: string) => void;
  placeholder?: string;
  /** Alto mínimo del área de escritura, en px. */
  alturaMinima?: number;
  autoFocus?: boolean;
  /**
   * Para "Insertar imagen": si se indica, la imagen la elige quien usa el editor (p. ej. recortarla
   * de la página del documento importado). Si no, se sube desde el equipo.
   */
  pedirImagen?: () => Promise<string | null>;
  etiqueta?: string;
}

interface EstadoEcuacion {
  latex: string;
  pos?: number;
  bloque?: boolean;
}

const TAM_MAX_IMAGEN = 5 * 1024 * 1024;

/** Botón de la barra de herramientas. */
function Boton({ icono, titulo, onClick, activo, deshabilitado, children }: {
  icono?: string;
  titulo: string;
  onClick: () => void;
  activo?: boolean;
  deshabilitado?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`er-btn ${activo ? 'is-activo' : ''}`}
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      disabled={deshabilitado}
      onMouseDown={(e) => e.preventDefault()} // no quitar el foco del texto
      onClick={onClick}
    >
      {icono ? <span className="material-icons-outlined">{icono}</span> : children}
    </button>
  );
}

/** Botón con menú desplegable. */
function Menu({ titulo, boton, children, activo, alinearDerecha }: {
  titulo: string;
  boton: ReactNode;
  children: (cerrar: () => void) => ReactNode;
  activo?: boolean;
  alinearDerecha?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  return (
    <div className="er-menu" ref={ref}>
      <button
        type="button"
        className={`er-btn er-btn-menu ${abierto || activo ? 'is-activo' : ''}`}
        title={titulo}
        aria-label={titulo}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setAbierto((v) => !v)}
      >
        {boton}
        <span className="material-icons-outlined er-caret">arrow_drop_down</span>
      </button>
      {abierto && (
        <div className={`er-menu-lista ${alinearDerecha ? 'er-derecha' : ''}`} role="menu">
          {children(() => setAbierto(false))}
        </div>
      )}
    </div>
  );
}

function OpcionMenu({ onClick, children, activo, cerrar }: { onClick: () => void; children: ReactNode; activo?: boolean; cerrar: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`er-opcion ${activo ? 'is-activo' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { onClick(); cerrar(); }}
    >
      {children}
    </button>
  );
}

const ESTILOS_PARRAFO = [
  { id: 'p', etiqueta: 'Normal', clase: 'er-op-normal' },
  { id: 'h1', etiqueta: 'Encabezado 1', clase: 'er-op-h1' },
  { id: 'h2', etiqueta: 'Encabezado 2', clase: 'er-op-h2' },
  { id: 'h3', etiqueta: 'Encabezado 3', clase: 'er-op-h3' },
  { id: 'code', etiqueta: 'Código', clase: 'er-op-code' },
] as const;

/** Símbolos frecuentes en exámenes (el PDF los imprime como texto). */
const SIMBOLOS = [
  { c: '°', t: 'Grado' }, { c: '≈', t: 'Aproximadamente' }, { c: '±', t: 'Más o menos' }, { c: '×', t: 'Por' },
  { c: '÷', t: 'Entre' }, { c: '≠', t: 'Diferente' }, { c: '≤', t: 'Menor o igual' }, { c: '≥', t: 'Mayor o igual' },
  { c: '∞', t: 'Infinito' }, { c: '√', t: 'Raíz' }, { c: 'π', t: 'Pi' }, { c: '∠', t: 'Ángulo' },
  { c: '∡', t: 'Ángulo medido' }, { c: '△', t: 'Triángulo' }, { c: '⊥', t: 'Perpendicular' }, { c: '∥', t: 'Paralelo' },
  { c: '≅', t: 'Congruente' }, { c: '∼', t: 'Semejante' }, { c: 'α', t: 'Alfa' }, { c: 'β', t: 'Beta' },
  { c: 'γ', t: 'Gamma' }, { c: 'θ', t: 'Theta' }, { c: 'φ', t: 'Phi' }, { c: 'λ', t: 'Lambda' },
  { c: 'μ', t: 'Mu' }, { c: 'ω', t: 'Omega' }, { c: 'Δ', t: 'Delta' }, { c: 'Ω', t: 'Omega mayúscula' },
  { c: '→', t: 'Flecha / reacción' }, { c: '⇌', t: 'Equilibrio químico' }, { c: '∴', t: 'Por lo tanto' }, { c: '∈', t: 'Pertenece' },
];

const ALINEACIONES = [
  { id: 'left', icono: 'format_align_left', etiqueta: 'Alinear a la izquierda' },
  { id: 'center', icono: 'format_align_center', etiqueta: 'Centrar' },
  { id: 'right', icono: 'format_align_right', etiqueta: 'Alinear a la derecha' },
  { id: 'justify', icono: 'format_align_justify', etiqueta: 'Justificar' },
] as const;

/**
 * Editor de texto enriquecido para enunciados y alternativas:
 * formato de párrafo, negrita, cursiva, subrayado, alineación, listas, cita, imágenes,
 * tablas y ecuaciones (editor visual con teclado matemático). Deshacer / rehacer.
 */
export function EditorRico({ value, onChange, placeholder = 'Escribe aquí…', alturaMinima = 110, autoFocus, pedirImagen, etiqueta }: Props) {
  const [ecuacion, setEcuacion] = useState<EstadoEcuacion | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const ultimoEmitido = useRef<string>(value ?? '');
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // No se imprimen en el examen o no tienen sentido en una pregunta.
        link: false,
        strike: false,
        code: false,
        horizontalRule: false,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Subscript,
      Superscript,
      TableKit.configure({ table: { resizable: false } }),
      ImagenConBotonQuitar,
      Placeholder.configure({ placeholder }),
      Mathematics.configure({
        katexOptions: { throwOnError: false },
        inlineOptions: { onClick: (node, pos) => setEcuacion({ latex: node.attrs.latex ?? '', pos }) },
        blockOptions: { onClick: (node, pos) => setEcuacion({ latex: node.attrs.latex ?? '', pos, bloque: true }) },
      }),
    ],
    content: bloquesADocumento(value),
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'er-contenido', ...(etiqueta ? { 'aria-label': etiqueta } : {}) } },
    onUpdate: ({ editor: e }) => {
      const contenido = documentoABloques(e.getJSON());
      ultimoEmitido.current = contenido;
      onChangeRef.current(contenido);
    },
  });

  // Si el contenido cambia desde fuera (p. ej. se agregó una imagen recortada), se recarga.
  useEffect(() => {
    if (!editor || (value ?? '') === ultimoEmitido.current) return;
    ultimoEmitido.current = value ?? '';
    editor.commands.setContent(bloquesADocumento(value), { emitUpdate: false });
  }, [value, editor]);

  const estado = useEditorState({
    editor,
    selector: ({ editor: e }: { editor: Editor | null }) => ({
      negrita: !!e?.isActive('bold'),
      cursiva: !!e?.isActive('italic'),
      subrayado: !!e?.isActive('underline'),
      subindice: !!e?.isActive('subscript'),
      superindice: !!e?.isActive('superscript'),
      h1: !!e?.isActive('heading', { level: 1 }),
      h2: !!e?.isActive('heading', { level: 2 }),
      h3: !!e?.isActive('heading', { level: 3 }),
      codigo: !!e?.isActive('codeBlock'),
      numerada: !!e?.isActive('orderedList'),
      vinetas: !!e?.isActive('bulletList'),
      cita: !!e?.isActive('blockquote'),
      tabla: !!e?.isActive('table'),
      alineacion: (['center', 'right', 'justify'] as const).find((a) => e?.isActive({ textAlign: a })) ?? 'left',
      puedeDeshacer: !!e?.can().undo(),
      puedeRehacer: !!e?.can().redo(),
    }),
  });

  if (!editor || !estado) return null;
  const cadena = () => editor.chain().focus();

  const estiloActual = estado.h1 ? 'h1' : estado.h2 ? 'h2' : estado.h3 ? 'h3' : estado.codigo ? 'code' : 'p';
  const aplicarEstilo = (id: typeof ESTILOS_PARRAFO[number]['id']) => {
    if (id === 'p') cadena().setParagraph().run();
    else if (id === 'code') cadena().toggleCodeBlock().run();
    else cadena().setHeading({ level: Number(id.slice(1)) as 1 | 2 | 3 }).run();
  };

  const insertarImagen = (url: string) => cadena().setImage({ src: url }).run();

  const subirArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (archivoRef.current) archivoRef.current.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) { toast.error('Selecciona un archivo de imagen.'); return; }
    if (archivo.size > TAM_MAX_IMAGEN) { toast.error('La imagen pesa más de 5 MB.'); return; }
    setSubiendo(true);
    try {
      insertarImagen(await uploadRecorte(archivo));
    } catch {
      toast.error('No se pudo subir la imagen.');
    } finally {
      setSubiendo(false);
    }
  };

  const elegirImagen = async () => {
    if (!pedirImagen) { archivoRef.current?.click(); return; }
    const url = await pedirImagen();
    if (url) insertarImagen(url);
  };

  const guardarEcuacion = (latex: string) => {
    const actual = ecuacion;
    setEcuacion(null);
    if (!actual) return;
    if (actual.pos === undefined) {
      if (latex) cadena().insertInlineMath({ latex }).run();
      return;
    }
    if (actual.bloque) {
      if (latex) cadena().updateBlockMath({ latex, pos: actual.pos }).run();
      else cadena().deleteBlockMath({ pos: actual.pos }).run();
    } else if (latex) cadena().updateInlineMath({ latex, pos: actual.pos }).run();
    else cadena().deleteInlineMath({ pos: actual.pos }).run();
  };

  const iconoAlineacion = ALINEACIONES.find((a) => a.id === estado.alineacion)?.icono ?? 'format_align_left';

  return (
    <div className="er">
      <div className="er-barra" role="toolbar" aria-label="Herramientas de texto">
        <Menu titulo="Formato de párrafo" boton={<span className="er-parrafo">¶</span>} activo={estiloActual !== 'p'}>
          {(cerrar) => ESTILOS_PARRAFO.map((e) => (
            <OpcionMenu key={e.id} cerrar={cerrar} activo={estiloActual === e.id} onClick={() => aplicarEstilo(e.id)}>
              <span className={e.clase}>{e.etiqueta}</span>
            </OpcionMenu>
          ))}
        </Menu>
        <span className="er-sep" />
        <Boton icono="format_bold" titulo="Negrita (Ctrl+B)" activo={estado.negrita} onClick={() => cadena().toggleBold().run()} />
        <Boton icono="format_italic" titulo="Cursiva (Ctrl+I)" activo={estado.cursiva} onClick={() => cadena().toggleItalic().run()} />
        <Boton icono="format_underlined" titulo="Subrayado (Ctrl+U)" activo={estado.subrayado} onClick={() => cadena().toggleUnderline().run()} />
        <Boton titulo="Subíndice (H₂O, x₁)" activo={estado.subindice} onClick={() => cadena().toggleSubscript().run()}>
          <span className="er-indice">x<sub>2</sub></span>
        </Boton>
        <Boton titulo="Superíndice (x², 10³)" activo={estado.superindice} onClick={() => cadena().toggleSuperscript().run()}>
          <span className="er-indice">x<sup>2</sup></span>
        </Boton>
        <Boton titulo="Símbolo de grado (°)" onClick={() => cadena().insertContent('°').run()}>
          <span className="er-simbolo">°</span>
        </Boton>
        <Boton titulo="Aproximadamente (≈)" onClick={() => cadena().insertContent('≈').run()}>
          <span className="er-simbolo">≈</span>
        </Boton>
        <Menu titulo="Más símbolos" boton={<span className="er-simbolo">Ω</span>}>
          {(cerrar) => (
            <div className="er-simbolos">
              {SIMBOLOS.map((s) => (
                <button
                  key={s.c}
                  type="button"
                  className="er-simbolo-btn"
                  title={s.t}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { cadena().insertContent(s.c).run(); cerrar(); }}
                >
                  {s.c}
                </button>
              ))}
            </div>
          )}
        </Menu>
        <span className="er-sep" />
        <Menu titulo="Alineación" boton={<span className="material-icons-outlined">{iconoAlineacion}</span>}>
          {(cerrar) => ALINEACIONES.map((a) => (
            <OpcionMenu key={a.id} cerrar={cerrar} activo={estado.alineacion === a.id} onClick={() => cadena().setTextAlign(a.id).run()}>
              <span className="material-icons-outlined">{a.icono}</span> {a.etiqueta}
            </OpcionMenu>
          ))}
        </Menu>
        <Boton icono="format_list_numbered" titulo="Lista numerada" activo={estado.numerada} onClick={() => cadena().toggleOrderedList().run()} />
        <Boton icono="format_list_bulleted" titulo="Lista con viñetas" activo={estado.vinetas} onClick={() => cadena().toggleBulletList().run()} />
        <Boton icono="format_quote" titulo="Cita" activo={estado.cita} onClick={() => cadena().toggleBlockquote().run()} />
        <span className="er-sep" />
        <Boton
          icono="image"
          titulo={pedirImagen ? 'Insertar imagen (recortar del documento o subir)' : 'Insertar imagen'}
          deshabilitado={subiendo}
          onClick={() => void elegirImagen()}
        />
        <Boton icono="upload" titulo="Subir imagen desde el equipo" deshabilitado={subiendo} onClick={() => archivoRef.current?.click()} />
        <Boton titulo="Insertar ecuación (LaTeX)" onClick={() => setEcuacion({ latex: '' })}>
          <span className="er-pi">π</span>
        </Boton>
        <Menu titulo="Más elementos" boton={<span className="material-icons-outlined">add</span>}>
          {(cerrar) => (
            <>
              <OpcionMenu cerrar={cerrar} onClick={() => cadena().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                <span className="material-icons-outlined">grid_on</span> Insertar tabla
              </OpcionMenu>
              <OpcionMenu cerrar={cerrar} onClick={() => setEcuacion({ latex: '' })}>
                <span className="er-pi">π</span> Insertar LaTeX
              </OpcionMenu>
            </>
          )}
        </Menu>

        <span className="er-espacio" />
        {subiendo && <span className="er-subiendo">Subiendo…</span>}
        <Boton icono="undo" titulo="Deshacer (Ctrl+Z)" deshabilitado={!estado.puedeDeshacer} onClick={() => cadena().undo().run()} />
        <Boton icono="redo" titulo="Rehacer (Ctrl+Y)" deshabilitado={!estado.puedeRehacer} onClick={() => cadena().redo().run()} />
        <Menu titulo="Más opciones" boton={<span className="material-icons-outlined">more_vert</span>} alinearDerecha>
          {(cerrar) => (
            <OpcionMenu cerrar={cerrar} onClick={() => cadena().unsetAllMarks().clearNodes().run()}>
              <span className="material-icons-outlined">format_clear</span> Quitar formato
            </OpcionMenu>
          )}
        </Menu>
      </div>

      {estado.tabla && (
        <div className="er-barra-tabla" role="toolbar" aria-label="Herramientas de tabla">
          <span className="er-barra-tabla-titulo">Tabla:</span>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cadena().addRowAfter().run()}>+ Fila</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cadena().addColumnAfter().run()}>+ Columna</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cadena().deleteRow().run()}>− Fila</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cadena().deleteColumn().run()}>− Columna</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => cadena().toggleHeaderRow().run()}>Encabezado</button>
          <button type="button" className="er-peligro" onMouseDown={(e) => e.preventDefault()} onClick={() => cadena().deleteTable().run()}>Eliminar tabla</button>
        </div>
      )}

      <EditorContent editor={editor} style={{ minHeight: alturaMinima }} className="er-area" />
      <input ref={archivoRef} type="file" accept="image/*" hidden onChange={(e) => void subirArchivo(e)} />

      {ecuacion && (
        <Suspense fallback={null}>
          <EcuacionModal
            latexInicial={ecuacion.latex}
            onCancelar={() => setEcuacion(null)}
            onInsertar={guardarEcuacion}
          />
        </Suspense>
      )}
    </div>
  );
}

export default EditorRico;
