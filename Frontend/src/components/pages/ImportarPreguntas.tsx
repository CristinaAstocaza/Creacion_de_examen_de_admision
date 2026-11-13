import React, { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import './ImportarPreguntas.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { importarImagenes, guardarLotePreguntas, uploadRecorte } from '../../services/preguntaService';
import { listarCursos } from '../../services/cursoService';
import { EscanerPanel, type PreguntaEscaneada } from './EscanerPanel';
import { SelectorFiguraModal } from './SelectorFiguraModal';
import { RevisionPregunta, type DestinoImagen } from './RevisionPregunta';
import { esCapturaImportada, tieneBloquesImagen, bloquesATextoEditable } from '../../utils/contenidoBloques';
import { quitarFormato } from '../../utils/formatoTexto';
import { confirmar } from '../ui/confirm';
import { parseQuestionsHeuristically, type ParserResult } from '../../utils/preguntaParser';
import { abrirPdf, esPdfEscaneado, type DocumentoPdf } from '../../utils/documentoPdf';
import { leerTextoDeImagen } from '../../utils/ocr';
import { dominioPorCurso } from '../../utils/correccionCientifica';
import {
  type AnalyzedQuestion,
  type FuenteImagen,
  evaluarPregunta,
  imagenesAlFinal,
  listaParaGuardar,
  normalizarParaBuscar,
  ponerImagen,
  tieneContenido,
} from '../../utils/importacion';
import { toast } from '../ui/toast';

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────
interface GeminiAlternativa {
  letra: string;
  contenido_texto?: string;
  tipo?: 'texto' | 'imagen' | 'texto_imagen';
  tiene_imagen?: boolean;
  imagen_url?: string;
  descripcion_imagen?: string;
}

interface GeminiPregunta {
  numero: number;
  enunciado: string;
  dificultad?: string;
  tiene_imagen_enunciado?: boolean;
  imagen_url?: string;
  descripcion_imagen?: string;
  alternativas: GeminiAlternativa[];
  tipo_bloque?: 'pregunta' | 'contexto' | 'encabezado' | 'otro';
  posible_incompleta?: boolean;
  confianza_extraccion?: number;
  area_tematica?: string;
}

interface Curso { id: number; nombre: string; }

type FiltroRevision = 'TODAS' | 'COMPLETAS' | 'REVISAR' | 'INCOMPLETAS';

/** Texto plano corto del enunciado, para el índice lateral. */
const resumenEnunciado = (contenido: string) => {
  const t = quitarFormato(bloquesATextoEditable(contenido)).replace(/\$([^$]+)\$/g, '$1').replace(/\s+/g, ' ').trim();
  return t ? (t.length > 90 ? `${t.slice(0, 90)}…` : t) : '(Sin enunciado)';
};

interface ImageTask {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: AnalyzedQuestion;
  errorMsg?: string;
}

/** Página (o imagen) de origen, para saber de dónde viene cada pregunta. */
interface ReferenciaPagina {
  fuenteId: string;
  etiqueta: string;
  textoNorm: string;
  tieneGraficos: boolean;
}

/** Página a leer con OCR. */
interface EntradaOcr {
  etiqueta: string;
  obtenerUrl: () => Promise<string>;
}

// ─────────────────────────────────────────────
// Funciones auxiliares
// ─────────────────────────────────────────────
const nuevoId = () => `q-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/** Convierte la respuesta de la IA (o del parser local) al modelo de revisión. */
const mapGeminiToQuestions = (preguntas: GeminiPregunta[], originalUrl?: string): AnalyzedQuestion[] =>
  preguntas.map((q, idx) => evaluarPregunta({
    id: nuevoId(),
    numero: q.numero ?? idx + 1,
    // Las figuras siempre debajo del problema (la IA a veces las pone antes del texto).
    enunciado: imagenesAlFinal(q.enunciado ?? ''),
    dificultad: q.dificultad ?? 'MEDIO',
    tiene_imagen_enunciado: q.tiene_imagen_enunciado,
    descripcion_imagen: q.descripcion_imagen,
    imagenUrl: q.imagen_url,
    originalImageUrl: originalUrl || q.imagen_url,
    parsedAlternativas: (q.alternativas ?? []).map((a, i) => ({
      letra: (a.letra || '?').toUpperCase(),
      tipo: 'TEXTO' as const, // la imagen, si hay, va como bloque dentro del contenido
      contenidoTexto: a.contenido_texto ?? null,
      esCorrecta: false as const,
      imagenUrl: a.imagen_url,
      ordenVisualizacion: i + 1,
    })),
    tipo_bloque: q.tipo_bloque || 'pregunta',
    posible_incompleta: q.posible_incompleta,
    confianza_extraccion: q.confianza_extraccion,
    isValid: false,
    needsReview: false,
  }));

/** Resultado del parser local → formato común. */
const parserAPreguntas = (resultado: ParserResult): GeminiPregunta[] =>
  resultado.questions.map((q) => ({
    numero: q.numero ?? 0,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map((alt) => ({ letra: alt.letra, contenido_texto: alt.contenido, tipo: 'texto' as const })),
    tipo_bloque: 'pregunta' as const,
    tiene_imagen_enunciado: false,
  }));

/**
 * Ubica cada pregunta en su página (buscando el inicio del enunciado en el texto de cada página).
 * Si la página tiene imágenes o gráficos, deja un aviso para revisar y recortar.
 */
const asignarPaginas = (preguntas: AnalyzedQuestion[], refs: ReferenciaPagina[]): AnalyzedQuestion[] => {
  let ultima = refs[0];
  return preguntas.map((q) => {
    const clave = normalizarParaBuscar(bloquesATextoEditable(q.enunciado).replace(/\$/g, '')).slice(0, 30);
    const encontrada = clave.length >= 8 ? refs.find((r) => r.textoNorm.includes(clave)) : undefined;
    if (encontrada) ultima = encontrada;
    const ref = encontrada ?? ultima;
    if (!ref) return q;

    const faltanAlternativas = q.parsedAlternativas.some((a) => !tieneContenido(a.contenidoTexto) && !a.imagenUrl);
    const avisoGraficos = !ref.tieneGraficos
      ? undefined
      : faltanAlternativas
        ? `${ref.etiqueta} tiene imágenes o gráficos y a esta pregunta le faltan alternativas: probablemente están como imagen. Agrégalas con el botón de imagen de cada alternativa.`
        : `${ref.etiqueta} tiene imágenes o gráficos que no se importan como texto. Revisa si esta pregunta necesita alguno.`;
    return evaluarPregunta({ ...q, fuenteId: ref.fuenteId, avisoGraficos });
  });
};

const fuentesDePdf = (doc: DocumentoPdf, prefijo: string, nombre?: string): FuenteImagen[] =>
  doc.paginas.map((p) => ({
    id: `${prefijo}-${p.numero}`,
    etiqueta: `${nombre ? `${nombre} · ` : ''}Página ${p.numero}`,
    obtenerUrl: () => doc.renderizarPagina(p.numero),
    tieneGraficos: p.tieneImagenes || p.tieneDibujos,
  }));

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────
export const ImportarPreguntas: React.FC = () => {
  const [mode, setMode] = useState<'home' | 'paste_text' | 'pdf_analyzing' | 'preview'>('home');

  const [questions, setQuestions] = useState<AnalyzedQuestion[]>([]);
  const [imageTasks, setImageTasks] = useState<ImageTask[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  /** Preguntas que se están guardando ahora (una o todas). */
  const [guardandoIds, setGuardandoIds] = useState<Set<string>>(new Set());
  /** Cuántas se guardaron en esta revisión (las guardadas salen de la lista). */
  const [guardadasSesion, setGuardadasSesion] = useState(0);
  /** Pregunta resaltada en el índice lateral. */
  const [activaId, setActivaId] = useState<string | null>(null);
  const [progreso, setProgreso] = useState('');

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<number | ''>('');

  const [filterMode, setFilterMode] = useState<FiltroRevision>('TODAS');
  const [modalImage, setModalImage] = useState<string | null>(null);

  /** Páginas/imágenes de donde se pueden recortar figuras durante la revisión. */
  const [fuentes, setFuentes] = useState<FuenteImagen[]>([]);
  /**
   * Selector de figuras abierto: con `destino` la imagen se agrega a la pregunta;
   * con `resolver` se devuelve la URL al editor de texto que la pidió.
   */
  const [selector, setSelector] = useState<{
    preguntaId: string;
    destino?: DestinoImagen;
    resolver?: (url: string | null) => void;
  } | null>(null);

  const cerrarSelector = () => {
    selector?.resolver?.(null);
    setSelector(null);
  };

  const [enLinea, setEnLinea] = useState(() => navigator.onLine);

  // Refs para inputs ocultos
  const docInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  // ── Documento (Tarjeta 1) ──
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentText, setDocumentText] = useState<string>('');
  const [documentoPdf, setDocumentoPdf] = useState<DocumentoPdf | null>(null);
  const [isDocumentExtracting, setIsDocumentExtracting] = useState(false);
  const [isDocumentScanned, setIsDocumentScanned] = useState(false);

  const [pastedText, setPastedText] = useState<string>('');
  const [pastedTextPreview, setPastedTextPreview] = useState<ParserResult | null>(null);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [geminiCount, setGeminiCount] = useState<number>(() => {
    const stored = localStorage.getItem('gemini_queries_count');
    return stored ? parseInt(stored) : 0;
  });

  const incrementGeminiCount = () => {
    setGeminiCount(prev => {
      const newVal = prev + 1;
      localStorage.setItem('gemini_queries_count', newVal.toString());
      return newVal;
    });
  };

  const resetGeminiCount = () => {
    localStorage.removeItem('gemini_queries_count');
    setGeminiCount(0);
  };

  useEffect(() => {
    listarCursos().then(data => {
      setCursos(data);
      if (data.length > 0) setSelectedCursoId(data[0].id);
    }).catch(e => console.error('Error al cargar cursos:', e));
  }, []);

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    return () => {
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, []);

  // ── Documento PDF / TXT ──
  const quitarDocumento = () => {
    documentoPdf?.cerrar();
    setDocumentoPdf(null);
    setDocumentFile(null);
    setDocumentText('');
    setIsDocumentScanned(false);
  };

  const handleDocChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    quitarDocumento();
    setDocumentFile(file);
    setIsDocumentExtracting(true);

    try {
      if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
        setDocumentText(await file.text());
      } else if (file.type === 'application/pdf') {
        const doc = await abrirPdf(file);
        setDocumentoPdf(doc);
        setDocumentText(doc.texto);
        setIsDocumentScanned(esPdfEscaneado(doc));
      } else {
        toast.error('Formato no soportado. Por favor sube un archivo PDF o TXT.');
        setDocumentFile(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al leer el archivo.');
      setDocumentFile(null);
    } finally {
      setIsDocumentExtracting(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleProcessDoc = () => {
    if (!selectedCursoId) { toast.error('Selecciona un curso primero.'); return; }
    if (!documentText) { toast.error('Carga un documento primero.'); return; }
    if (isDocumentScanned) { toast.error('Este PDF es un escaneo: súbelo en "Escanear desde impresora".'); return; }

    const parsedResult = parseQuestionsHeuristically(documentText);
    if (parsedResult.questions.length === 0) {
      toast.error(parsedResult.diagnostics.errors.join(' ') || 'No se detectaron preguntas en el documento.');
      return;
    }

    let mapped = mapGeminiToQuestions(parserAPreguntas(parsedResult));
    if (documentoPdf) {
      const refs: ReferenciaPagina[] = documentoPdf.paginas.map((p) => ({
        fuenteId: `pdf-${p.numero}`,
        etiqueta: `La página ${p.numero}`,
        textoNorm: normalizarParaBuscar(p.texto),
        tieneGraficos: p.tieneImagenes || p.tieneDibujos,
      }));
      mapped = asignarPaginas(mapped, refs);
      setFuentes(fuentesDePdf(documentoPdf, 'pdf'));
    } else {
      setFuentes([]);
    }
    setQuestions(mapped);
    setMode('preview');
  };

  // ── OCR: leer texto de imágenes/escaneos SIN IA ni internet ──
  const procesarConOcr = async (entradas: EntradaOcr[]): Promise<boolean> => {
    if (!selectedCursoId) { toast.error('Selecciona un curso primero.'); return false; }
    if (entradas.length === 0) return false;

    setMode('pdf_analyzing');
    setProgreso('Preparando el lector de texto…');
    // La materia del curso (Química, Física, Geometría…) activa correcciones específicas del OCR.
    const dominio = dominioPorCurso(cursos.find(c => c.id === selectedCursoId)?.nombre) ?? undefined;
    try {
      const textos: string[] = [];
      const refs: ReferenciaPagina[] = [];
      const nuevasFuentes: FuenteImagen[] = [];
      const base = Date.now();

      for (let i = 0; i < entradas.length; i++) {
        const { etiqueta, obtenerUrl } = entradas[i];
        const paso = `Leyendo ${etiqueta} (${i + 1} de ${entradas.length})`;
        setProgreso(`${paso}…`);
        const url = await obtenerUrl();
        const { texto, tieneGraficos } = await leerTextoDeImagen(url, (p) => setProgreso(`${paso}… ${Math.round(p * 100)}%`), dominio);
        textos.push(texto);
        const id = `ocr-${base}-${i}`;
        nuevasFuentes.push({ id, etiqueta, obtenerUrl: async () => url, tieneGraficos });
        // Si la hoja tiene figuras, la revisión avisa en sus preguntas para recortarlas.
        refs.push({ fuenteId: id, etiqueta, textoNorm: normalizarParaBuscar(texto), tieneGraficos });
      }

      const resultado = parseQuestionsHeuristically(textos.join('\n\n'));
      if (resultado.questions.length === 0) {
        toast.error('No se reconocieron preguntas. Verifica que la imagen sea nítida o usa la opción con IA.');
        setMode('home');
        return false;
      }

      setFuentes(nuevasFuentes);
      setQuestions(asignarPaginas(mapGeminiToQuestions(parserAPreguntas(resultado)), refs));
      setMode('preview');
      toast.success(`Se leyeron ${resultado.questions.length} pregunta(s) sin IA. Revisa el texto y agrega los gráficos.`);
      return true;
    } catch (err) {
      console.error('Error de OCR', err);
      toast.error('No se pudo leer el texto de las imágenes.');
      setMode('home');
      return false;
    } finally {
      setProgreso('');
    }
  };

  /** Convierte archivos (imágenes o PDF escaneados) en páginas para el OCR. */
  const entradasDeArchivos = async (archivos: File[]): Promise<EntradaOcr[]> => {
    const entradas: EntradaOcr[] = [];
    for (const archivo of archivos) {
      if (archivo.type === 'application/pdf') {
        const doc = await abrirPdf(archivo);
        doc.paginas.forEach((p) => entradas.push({
          etiqueta: `${archivo.name} · página ${p.numero}`,
          obtenerUrl: () => doc.renderizarPagina(p.numero),
        }));
      } else if (archivo.type.startsWith('image/')) {
        const url = URL.createObjectURL(archivo);
        entradas.push({ etiqueta: `Hoja ${entradas.length + 1}`, obtenerUrl: async () => url });
      }
    }
    return entradas;
  };

  const extraerEscaneoSinIA = async (paginas: File[]) => procesarConOcr(await entradasDeArchivos(paginas));

  // ── Pegar texto (Tarjeta 2) ──
  const handlePasteTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPastedText(val);
    setPastedTextPreview(val.trim() ? parseQuestionsHeuristically(val) : null);
  };

  const handleProcessPastedText = () => {
    if (!selectedCursoId) { toast.error('Selecciona un curso primero.'); return; }
    if (!pastedText.trim()) { toast.error('Pega algo de texto primero.'); return; }

    const result = pastedTextPreview || parseQuestionsHeuristically(pastedText);
    if (result.questions.length === 0) {
      toast.error(result.diagnostics.errors.join(' ') || 'No se detectaron preguntas.');
      return;
    }
    setFuentes([]);
    setQuestions(mapGeminiToQuestions(parserAPreguntas(result)));
    setMode('preview');
  };

  // ── Imágenes (Tarjeta 3) ──
  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      setImageFiles(prev => [...prev, ...files]);
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleImageDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      setImageFiles(prev => [...prev, ...files]);
    }
  };

  const handleImagePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) setImageFiles(prev => [...prev, ...files]);
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcessImagesSinIA = async () => {
    if (!selectedCursoId) { toast.error('Selecciona el curso destino arriba.'); return; }
    if (imageFiles.length === 0) { toast.error('Carga al menos una imagen primero.'); return; }
    const entradas = await entradasDeArchivos(imageFiles);
    const ok = await procesarConOcr(entradas);
    if (ok) setImageFiles([]);
  };

  const handleProcessImages = () => {
    if (!selectedCursoId) { toast.error('Selecciona un curso primero.'); return; }
    if (imageFiles.length === 0) { toast.error('Carga al menos una imagen primero.'); return; }
    if (!enLinea) { toast.error('Sin internet la IA no está disponible.'); return; }

    setFuentes([]);
    setImageTasks(imageFiles.map((file, idx) => ({
      id: `task-${Date.now()}-${idx}-${Math.random()}`,
      file,
      status: 'pending',
    })));
    incrementGeminiCount();
    setMode('pdf_analyzing');
  };

  // ── Procesamiento por lotes con IA ──
  useEffect(() => {
    const processNextBatch = async () => {
      if (isProcessingBatch) return;

      const pendingTasks = imageTasks.filter(t => t.status === 'pending');
      if (pendingTasks.length === 0) {
        if (imageTasks.length > 0 && imageTasks.every(t => t.status !== 'processing')) {
          const successfulResults = imageTasks.filter(t => t.status === 'success' && t.result).map(t => t.result!);
          if (successfulResults.length > 0 && mode !== 'preview') {
            setQuestions(prev => [...prev, ...successfulResults.filter(sr => !prev.some(p => p.id === sr.id))]);
            setMode('preview');
          } else if (successfulResults.length === 0 && mode === 'pdf_analyzing') {
            toast.error('La IA no pudo leer las imágenes. Intenta con capturas más nítidas.');
            setImageTasks([]);
            setMode('home');
          }
        }
        return;
      }

      setIsProcessingBatch(true);
      const batch = pendingTasks.slice(0, 5);
      setImageTasks(prev => prev.map(t => batch.some(b => b.id === t.id) ? { ...t, status: 'processing' } : t));

      try {
        const resp = await importarImagenes(batch.map(t => t.file), selectedCursoId);
        setImageTasks(prev => prev.map(t => {
          const indexInBatch = batch.findIndex(b => b.id === t.id);
          if (indexInBatch === -1) return t;
          const rawQ = resp.preguntas?.find((m: GeminiPregunta) => m.numero === indexInBatch + 1);
          return rawQ
            ? { ...t, status: 'success', result: mapGeminiToQuestions([rawQ], rawQ.imagen_url)[0] }
            : { ...t, status: 'error', errorMsg: 'Fallo al procesar o imagen ilegible.' };
        }));
      } catch (err) {
        console.error('Error en batch', err);
        setImageTasks(prev => prev.map(t => batch.some(b => b.id === t.id) ? { ...t, status: 'error', errorMsg: 'Error de red o de IA.' } : t));
      } finally {
        setIsProcessingBatch(false);
      }
    };

    processNextBatch();
  }, [imageTasks, isProcessingBatch, selectedCursoId, mode]);

  // ── Escáner con IA: cada pregunta conserva la página de origen para recortes manuales ──
  const handlePreguntasEscaneadas = (preguntas: PreguntaEscaneada[]) => {
    setFuentes([]);
    setQuestions(preguntas.flatMap(q => mapGeminiToQuestions([q as unknown as GeminiPregunta], q.imagen_pagina_url)));
    setMode('preview');
  };

  // ── Edición en la revisión ──
  const actualizarPregunta = (q: AnalyzedQuestion) => {
    setQuestions(prev => prev.map(p => (p.id === q.id ? evaluarPregunta(q) : p)));
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  /** Fuentes para recortar: la imagen original de la pregunta (si vino de IA) + páginas del documento. */
  const fuentesDe = (q: AnalyzedQuestion): FuenteImagen[] => {
    const original = q.originalImageUrl && !fuentes.some(f => f.id === q.fuenteId)
      ? [{ id: `orig-${q.id}`, etiqueta: 'Imagen original', obtenerUrl: async () => q.originalImageUrl! }]
      : [];
    return [...original, ...fuentes];
  };

  const preguntaSelector = selector ? questions.find(q => q.id === selector.preguntaId) : undefined;

  const handleImagenElegida = async (blob: Blob) => {
    if (!selector) return;
    let url: string;
    try {
      url = await uploadRecorte(blob);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo guardar la imagen en el servidor.');
      return;
    }
    const { preguntaId, destino, resolver } = selector;
    // Pedido desde el editor de texto: la imagen la inserta el propio editor.
    if (resolver || !destino) {
      resolver?.(url);
      setSelector(null);
      return;
    }
    setQuestions(prev => prev.map(q => {
      if (q.id !== preguntaId) return q;
      if (destino.tipo === 'enunciado') {
        return evaluarPregunta({ ...q, enunciado: ponerImagen(q.enunciado, url, destino.indiceBloque), avisoRevisado: true });
      }
      const alts = q.parsedAlternativas.map((a, i) => (
        i === destino.indiceAlternativa ? { ...a, contenidoTexto: ponerImagen(a.contenidoTexto, url, destino.indiceBloque) } : a
      ));
      return evaluarPregunta({ ...q, parsedAlternativas: alts, avisoRevisado: true });
    }));
    setSelector(null);
    toast.success('Imagen agregada.');
  };

  // ── Guardar y cancelar ──
  /**
   * Guarda en el banco las preguntas indicadas y las quita de la revisión.
   * Se usa para guardar una sola (botón de la tarjeta) o todas las completas.
   */
  const guardarPreguntas = async (lista: AnalyzedQuestion[]) => {
    const valid = lista.filter(listaParaGuardar);
    if (!valid.length) { toast.error('No hay preguntas completas para guardar.'); return; }
    if (!selectedCursoId) { toast.error('Selecciona el curso destino primero.'); return; }

    const ids = new Set(valid.map(q => q.id));
    setGuardandoIds(prev => new Set([...prev, ...ids]));
    try {
      const payload = valid.map(q => ({
        enunciado: q.enunciado,
        dificultad: q.dificultad || 'MEDIO',
        activo: true,
        cursoId: Number(selectedCursoId),
        // La captura completa solo sirve para recortar; la figura real va como bloque dentro del enunciado.
        imagenUrl: esCapturaImportada(q.imagenUrl) ? null : q.imagenUrl ?? null,
        tieneImagen: tieneBloquesImagen(q.enunciado) || (!!q.imagenUrl && !esCapturaImportada(q.imagenUrl)),
        alternativas: q.parsedAlternativas.map(a => ({
          letra: a.letra,
          tipo: a.tipo,
          contenidoTexto: a.contenidoTexto,
          esCorrecta: false,
          imagenUrl: a.imagenUrl ?? null,
          ordenVisualizacion: a.ordenVisualizacion ?? null,
        })),
      }));

      const res = await guardarLotePreguntas(payload);
      const restantes = questions.filter(q => !ids.has(q.id));
      setQuestions(restantes);
      setGuardadasSesion(n => n + res.length);
      if (restantes.length === 0) {
        toast.success(res.length === 1 ? 'Pregunta guardada. Ya no quedan preguntas por revisar.' : `Se guardaron ${res.length} preguntas. Ya no quedan preguntas por revisar.`);
        handleCancel();
      } else {
        toast.success(res.length === 1 ? 'Pregunta guardada en el banco.' : `Se guardaron ${res.length} preguntas en el banco.`);
      }
    } catch (err) {
      console.error('Error al guardar preguntas', err);
      toast.error('No se pudieron guardar las preguntas.');
    } finally {
      setGuardandoIds(prev => new Set([...prev].filter(id => !ids.has(id))));
    }
  };

  const handleGuardar = () => guardarPreguntas(questions);

  const handleCancel = () => {
    setQuestions([]);
    setImageTasks([]);
    cerrarSelector();
    setFilterMode('TODAS');
    setActivaId(null);
    setGuardadasSesion(0);
    setMode('home');
  };

  /** Salir de la revisión: si quedan preguntas sin guardar, se pide confirmación. */
  const salirDeRevision = async () => {
    if (questions.length && !(await confirmar({
      titulo: '¿Salir de la revisión?',
      mensaje: `Hay ${questions.length} pregunta(s) sin guardar que se descartarán.`,
      textoConfirmar: 'Salir y descartar',
      peligro: true,
    }))) return;
    handleCancel();
  };

  // ── Cálculos ──
  const listas = questions.filter(listaParaGuardar);
  /** completa: lista y sin avisos · revisar: tiene avisos o figuras pendientes · incompleta: le falta texto o alternativas. */
  const estadoDe = (q: AnalyzedQuestion): Exclude<FiltroRevision, 'TODAS'> =>
    !q.isValid ? 'INCOMPLETAS' : listaParaGuardar(q) && !q.needsReview ? 'COMPLETAS' : 'REVISAR';
  const conteo = {
    TODAS: questions.length,
    COMPLETAS: questions.filter(q => estadoDe(q) === 'COMPLETAS').length,
    REVISAR: questions.filter(q => estadoDe(q) === 'REVISAR').length,
    INCOMPLETAS: questions.filter(q => estadoDe(q) === 'INCOMPLETAS').length,
  };
  const visibleQuestions = filterMode === 'TODAS' ? questions : questions.filter(q => estadoDe(q) === filterMode);
  const guardandoTodo = guardandoIds.size > 0 && listas.every(q => guardandoIds.has(q.id));

  const irAPregunta = (id: string) => {
    setActivaId(id);
    document.getElementById(`rv-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const paginasConGraficos = documentoPdf?.paginas.filter(p => p.tieneImagenes || p.tieneDibujos).length ?? 0;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  const selectorCurso = (
    <Select
      value={selectedCursoId === '' ? '' : String(selectedCursoId)}
      onValueChange={(value) => setSelectedCursoId(value ? Number(value) : '')}
      disabled={mode === 'pdf_analyzing'}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Selecciona un curso" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Selecciona un curso</SelectItem>
        {cursos.map(c => (
          <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className={`import-container ${mode === 'preview' ? 'import-container--revision' : ''}`}>
      {modalImage && (
        <div className="modal-overlay" onClick={() => setModalImage(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalImage(null)}>&times;</button>
            <img src={modalImage} alt="Ampliación" />
          </div>
        </div>
      )}

      {selector && preguntaSelector && (
        <SelectorFiguraModal
          titulo={!selector.destino
            ? 'Insertar imagen'
            : selector.destino.tipo === 'enunciado'
              ? 'Imagen del enunciado'
              : `Imagen de la alternativa ${preguntaSelector.parsedAlternativas[selector.destino.indiceAlternativa ?? 0]?.letra}`}
          fuentes={fuentesDe(preguntaSelector)}
          fuenteInicialId={preguntaSelector.fuenteId ?? (preguntaSelector.originalImageUrl ? `orig-${preguntaSelector.id}` : undefined)}
          onClose={cerrarSelector}
          onSave={handleImagenElegida}
          onAgregarFuente={(f) => setFuentes(prev => [...prev, f])}
        />
      )}

      {mode !== 'preview' && (
        <>
          <header className="page-header">
            <h1>Importar Preguntas</h1>
            <p>Priorizamos la precisión. Selecciona el método que coincida con tu formato.</p>
          </header>

          {!enLinea && (
            <div className="import-sin-red">
              <span className="material-icons-outlined">wifi_off</span>
              Sin internet: puedes importar documentos, pegar texto y procesar imágenes de forma local (sin IA).
            </div>
          )}

          <div style={{ maxWidth: 400, margin: '0 auto 32px auto', textAlign: 'center' }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text-main)' }}>Curso Destino:</label>
            {selectorCurso}
          </div>
        </>
      )}

      {mode === 'home' && (
        <div className="import-grid layout-cards">
          {/* Tarjeta 1 - Importar Documento */}
          <div
            className="import-card"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.length) {
                const fakeEvent = { target: { files: [e.dataTransfer.files[0]] } } as unknown as ChangeEvent<HTMLInputElement>;
                handleDocChange(fakeEvent);
              }
            }}
          >
            <div className="import-card-header">
              <div className="card-icon"><span className="material-icons-outlined">description</span></div>
              <h3>Importar Documento</h3>
              <p>Extrae preguntas de archivos PDF o TXT, 100% local y sin IA. Los gráficos del PDF se recortan en la revisión.</p>
            </div>

            <input type="file" ref={docInputRef} onChange={handleDocChange} accept=".pdf,.txt" style={{ display: 'none' }} />

            {!documentFile ? (
              <button className="btn btn-secondary" onClick={() => docInputRef.current?.click()} style={{ width: '100%', borderStyle: 'dashed' }}>
                Seleccionar PDF o TXT
              </button>
            ) : (
              <div className="doc-preview-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                    <span className="material-icons-outlined mi">attach_file</span> {documentFile.name}
                  </span>
                  <button className="btn-small danger" onClick={quitarDocumento} style={{ padding: '2px 8px' }}>Quitar</button>
                </div>

                {isDocumentExtracting ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div className="spinner-small" style={{ marginRight: 8 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Leyendo archivo...</span>
                  </div>
                ) : (
                  <>
                    <div className="doc-preview-box">
                      {documentText ? documentText.substring(0, 1000) + (documentText.length > 1000 ? '...' : '') : 'Archivo vacío.'}
                    </div>
                    {isDocumentScanned ? (
                      <div className="card-recommendation-warning">
                        <span className="material-icons-outlined mi">warning_amber</span> Este PDF es un escaneo (imagen), no tiene texto seleccionable. Súbelo en
                        <strong> Escanear desde impresora → Subir PDF o fotos de las hojas</strong> y elige con IA o sin IA.
                      </div>
                    ) : paginasConGraficos > 0 && (
                      <div className="card-recommendation-info">
                        <span className="material-icons-outlined mi">image</span> {paginasConGraficos} página(s) con imágenes o gráficos. Te avisaremos en qué preguntas revisar para recortarlos.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="import-card-footer">
              <button
                className="btn btn-primary"
                onClick={handleProcessDoc}
                disabled={!documentText || isDocumentExtracting || isDocumentScanned || !selectedCursoId}
                style={{ width: '100%' }}
              >
                Procesar documento
              </button>
            </div>
          </div>

          {/* Tarjeta 2 - Pegar Texto */}
          <div className="import-card" onClick={() => setMode('paste_text')} style={{ cursor: 'pointer' }}>
            <div className="import-card-header">
              <div className="card-icon"><span className="material-icons-outlined">edit_note</span></div>
              <h3>Pegar Texto</h3>
              <p>Pega preguntas directamente desde Word, PDF o páginas web. Permite revisión en tiempo real.</p>
            </div>
            <div className="import-card-footer" style={{ marginTop: 'auto' }}>
              <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); setMode('paste_text'); }} style={{ width: '100%' }}>
                Comenzar editor
              </button>
            </div>
          </div>

          {/* Tarjeta 3 - Importar Imagen */}
          <div
            className={`import-card ${isDragging ? 'drag-active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleImageDrop}
            onPaste={handleImagePaste}
          >
            <div
              className="gemini-badge"
              onClick={resetGeminiCount}
              title="Haz clic para reiniciar el contador (usa esto al cambiar la API Key)"
              style={{ cursor: 'pointer' }}
            >
              Consultas IA · {Math.max(0, 20 - geminiCount)}/20 <span className="material-icons-outlined mi">refresh</span>
            </div>

            <div className="import-card-header">
              <div className="card-icon"><span className="material-icons-outlined">image</span></div>
              <h3>Importar Imagen</h3>
              <p>Arrastra, selecciona o pega capturas o imágenes de tus preguntas. Puedes procesarlas Con IA o Sin IA (de forma local).</p>
            </div>

            <input type="file" ref={imageInputRef} onChange={handleImageSelect} accept="image/*" multiple style={{ display: 'none' }} />

            {imageFiles.length === 0 ? (
              <button className="btn btn-secondary" onClick={() => imageInputRef.current?.click()} style={{ width: '100%', borderStyle: 'dashed' }}>
                Seleccionar o pegar imágenes
              </button>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}><span className="material-icons-outlined mi">photo_library</span> {imageFiles.length} imágenes cargadas</span>
                  <button className="btn-small danger" onClick={() => setImageFiles([])} style={{ padding: '2px 8px' }}>Quitar todas</button>
                </div>
                <div className="image-previews-grid">
                  {imageFiles.map((file, i) => (
                    <div key={i} className="image-preview-thumbnail">
                      <img src={URL.createObjectURL(file)} alt={`Preview ${i}`} />
                      <button className="remove-thumb-btn" onClick={() => handleRemoveImage(i)}>&times;</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="import-card-footer import-footer-doble">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleProcessImagesSinIA}
                disabled={imageFiles.length === 0 || !selectedCursoId}
                title="Lee el texto de las imágenes en esta computadora de forma local, sin IA ni internet"
              >
                Sin IA
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleProcessImages}
                disabled={imageFiles.length === 0 || !selectedCursoId || !enLinea}
                title={enLinea ? 'Tu agente IA lee texto, fórmulas y gráficos' : 'Sin internet: usa "Sin IA"'}
              >
                Con IA
              </button>
            </div>
          </div>

          {/* Tarjeta 4 - Escanear desde impresora */}
          <EscanerPanel
            cursoId={selectedCursoId}
            onPreguntasExtraidas={handlePreguntasEscaneadas}
            onExtraerSinIA={extraerEscaneoSinIA}
            enLinea={enLinea}
          />
        </div>
      )}

      {mode === 'paste_text' && (
        <div className="panel fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="panel-title">
            <span><span className="material-icons-outlined mi">edit_note</span> Editor de Pegado de Texto</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{pastedText.length} caracteres</span>
          </div>

          <div className="editor-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', marginTop: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-main)' }}>Contenido del Examen / Preguntas:</label>
              <textarea
                className="pasted-textarea"
                style={{ minHeight: '380px', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }}
                placeholder="Pega tus preguntas aquí. Ejemplo:&#10;&#10;¿Cuál es el elemento químico con símbolo H?&#10;A) Helio&#10;B) Hidrógeno&#10;C) Oxígeno&#10;D) Nitrógeno&#10;E) Carbono&#10;&#10;Pregunta 2. Si un móvil viaja a...&#10;a. 10 m/s&#10;b. 20 m/s..."
                value={pastedText}
                onChange={handlePasteTextChange}
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-secondary" onClick={() => { setPastedText(''); setPastedTextPreview(null); }} style={{ flex: 1 }}>
                  Limpiar Texto
                </button>
                <button className="btn btn-secondary" onClick={() => setMode('home')} style={{ flex: 1 }}>
                  Volver al inicio
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8f9fa', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', maxHeight: '480px', overflowY: 'auto' }}>
              <h4 style={{ margin: 0, paddingBottom: '8px', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><span className="material-icons-outlined mi">fact_check</span> Vista Previa e Interpretación</span>
                {pastedTextPreview && (
                  <span className={`badge ${pastedTextPreview.diagnostics.isValid ? 'badge-success' : 'badge-danger'}`}>
                    {pastedTextPreview.questions.length} detectadas
                  </span>
                )}
              </h4>

              {!pastedText.trim() && (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                  Escribe o pega texto en el editor de la izquierda para comenzar el análisis en tiempo real.
                </div>
              )}

              {pastedTextPreview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pastedTextPreview.diagnostics.errors.map((err: string, idx: number) => (
                    <div key={idx} style={{ color: 'var(--error-color)', background: 'var(--error-bg)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                      <span className="material-icons-outlined mi">error_outline</span> {err}
                    </div>
                  ))}
                  {pastedTextPreview.diagnostics.warnings.map((warn: string, idx: number) => (
                    <div key={idx} style={{ color: 'var(--warning-color)', background: 'var(--warning-bg)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                      <span className="material-icons-outlined mi">warning_amber</span> {warn}
                    </div>
                  ))}
                </div>
              )}

              {pastedTextPreview && pastedTextPreview.questions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  {pastedTextPreview.questions.map((q, idx) => {
                    const enunciadoText = bloquesATextoEditable(q.enunciado);
                    const hasEnunciado = enunciadoText.trim().length >= 10;
                    const altsWithContent = q.alternativas.filter((alt) => tieneContenido(alt.contenido));
                    const hasAllAlternatives = altsWithContent.length >= 5;

                    return (
                      <div key={idx} style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e8eaed', fontSize: '13px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Pregunta detectada {idx + 1}</span>
                          <span style={{ fontSize: '11px', color: (hasEnunciado && hasAllAlternatives) ? 'var(--success-color)' : 'var(--warning-color)' }}>
                            {(hasEnunciado && hasAllAlternatives)
                              ? <><span className="material-icons-outlined mi">check_circle</span> Válida</>
                              : <><span className="material-icons-outlined mi">warning_amber</span> Requiere revisión</>}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#5f6368', paddingLeft: '4px' }}>
                          <div>
                            <span className={`material-icons-outlined mi ${hasEnunciado ? 'mi-ok' : 'mi-error'}`}>{hasEnunciado ? 'check_circle' : 'cancel'}</span> Enunciado: {hasEnunciado ? `"${enunciadoText.substring(0, 50)}${enunciadoText.length > 50 ? '...' : ''}"` : (enunciadoText.trim().length > 0 ? 'Demasiado corto' : 'Faltante o vacío')}
                          </div>
                          <div>
                            <span className={`material-icons-outlined mi ${hasAllAlternatives ? 'mi-ok' : 'mi-aviso'}`}>{hasAllAlternatives ? 'check_circle' : 'error_outline'}</span> Alternativas ({altsWithContent.length}): {altsWithContent.map((a) => a.letra).join(', ') || 'Ninguna'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="action-footer" style={{ marginTop: '24px' }}>
            <button
              className="btn btn-primary"
              onClick={handleProcessPastedText}
              disabled={!pastedText.trim() || !selectedCursoId || pastedTextPreview?.questions.length === 0}
              style={{ padding: '12px 32px' }}
            >
              Procesar texto
            </button>
          </div>
        </div>
      )}

      {mode === 'pdf_analyzing' && (
        <div className="analyzing-state fade-in">
          <div className="spinner" />
          <p>{progreso || 'Extrayendo texto y procesando con Inteligencia Artificial…'}</p>
        </div>
      )}

      {mode === 'preview' && (
        <div className="rv fade-in">
          {/* Barra superior fija: curso, filtros y acciones generales */}
          <header className="rv-barra">
            <div className="rv-titulo">
              <h1>Revisión de preguntas</h1>
              <p>
                {questions.length} por revisar
                {guardadasSesion > 0 && <> · <strong className="rv-guardadas">{guardadasSesion} guardada(s)</strong></>}
              </p>
            </div>

            <div className="rv-curso">
              <span className="rv-curso-label">Curso destino</span>
              {selectorCurso}
            </div>

            <nav className="rv-filtros" aria-label="Filtrar preguntas">
              {([
                ['TODAS', 'Todas', 'list_alt'],
                ['COMPLETAS', 'Completas', 'check_circle'],
                ['REVISAR', 'Por revisar', 'warning_amber'],
                ['INCOMPLETAS', 'Incompletas', 'cancel'],
              ] as const).map(([id, etiqueta, icono]) => (
                <button
                  key={id}
                  type="button"
                  className={`rv-filtro rv-filtro--${id.toLowerCase()} ${filterMode === id ? 'is-activo' : ''}`}
                  onClick={() => setFilterMode(id)}
                  aria-pressed={filterMode === id}
                >
                  <span className="material-icons-outlined mi">{icono}</span>
                  {etiqueta}
                  <span className="rv-contador">{conteo[id]}</span>
                </button>
              ))}
            </nav>

            <div className="rv-acciones">
              <button type="button" className="btn btn-secondary" onClick={() => void salirDeRevision()} disabled={guardandoIds.size > 0}>
                Salir
              </button>
              <button
                type="button"
                className="btn btn-primary rv-guardar-todas"
                onClick={() => void handleGuardar()}
                disabled={guardandoIds.size > 0 || listas.length === 0}
                title={listas.length ? 'Guarda todas las preguntas completas' : 'No hay preguntas completas'}
              >
                <span className="material-icons-outlined mi">{guardandoTodo ? 'hourglass_empty' : 'library_add_check'}</span>
                {guardandoTodo ? 'Guardando…' : `Guardar completas (${listas.length})`}
              </button>
            </div>
          </header>

          <div className="rv-cuerpo">
            {/* Índice: todas las preguntas de un vistazo */}
            <aside className="rv-indice" aria-label="Índice de preguntas">
              <p className="rv-indice-ayuda">Haz clic para ir a la pregunta</p>
              <ol>
                {questions.map(q => {
                  const estado = estadoDe(q);
                  return (
                    <li key={q.id}>
                      <button
                        type="button"
                        className={`rv-item rv-item--${estado.toLowerCase()} ${activaId === q.id ? 'is-activo' : ''}`}
                        onClick={() => irAPregunta(q.id)}
                      >
                        <span className="material-icons-outlined rv-item-icono">
                          {estado === 'COMPLETAS' ? 'check_circle' : estado === 'REVISAR' ? 'warning_amber' : 'cancel'}
                        </span>
                        <span className="rv-item-texto">{resumenEnunciado(q.enunciado)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>

            <main className="rv-lista">
              <p className="rv-ayuda">
                Corrige con <span className="material-icons-outlined mi">edit</span>, agrega gráficos o alternativas en imagen con{' '}
                <span className="material-icons-outlined mi">add_photo_alternate</span> y guarda cada pregunta cuando esté lista: pasa al banco y sale de esta lista.
              </p>

              {visibleQuestions.map(q => (
                <div key={q.id} id={`rv-${q.id}`} className={`rv-tarjeta ${activaId === q.id ? 'is-activa' : ''}`} onFocusCapture={() => setActivaId(q.id)}>
                  <RevisionPregunta
                    pregunta={q}
                    onChange={actualizarPregunta}
                    onEliminar={() => removeQuestion(q.id)}
                    onElegirImagen={(destino) => setSelector({ preguntaId: q.id, destino })}
                    onPedirImagen={() => new Promise<string | null>((resolver) => setSelector({ preguntaId: q.id, resolver }))}
                    onVerImagen={setModalImage}
                    onGuardar={() => void guardarPreguntas([q])}
                    guardando={guardandoIds.has(q.id)}
                  />
                </div>
              ))}

              {visibleQuestions.length === 0 && (
                <div className="rv-vacio">
                  <span className="material-icons-outlined">filter_alt_off</span>
                  No hay preguntas en este filtro.
                </div>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
};
