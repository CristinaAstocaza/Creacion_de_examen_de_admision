import React, { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import './ImportarPreguntas.css';
import { importarImagenes, guardarLotePreguntas, uploadRecorte } from '../../../services/preguntaService';
import { listarCursos } from '../../../services/cursoService';
import { ImageCropperModal } from './ImageCropperModal';
import { ContentRenderer } from '../ui/ContentRenderer';

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

interface ParsedAlternativa {
  letra: string;
  tipo: 'TEXTO' | 'IMAGEN';
  contenidoTexto: string | null;
  esCorrecta: false;
  imagenUrl?: string;
  ordenVisualizacion?: number;
  needsImage?: boolean;
}

interface AnalyzedQuestion {
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
  alternativas: GeminiAlternativa[];
  parsedAlternativas?: ParsedAlternativa[];
  tipo_bloque?: 'pregunta' | 'contexto' | 'encabezado' | 'otro';
  posible_incompleta?: boolean;
  confianza_extraccion?: number;
  needsReview: boolean;
}

interface Curso { id: number; nombre: string; }

interface ImageTask {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: AnalyzedQuestion;
  errorMsg?: string;
}

interface CropperState {
  isOpen: boolean;
  imageUrl: string;
  questionId: string;
  targetType: 'enunciado' | 'alternativa';
  alternativaIndex?: number;
  blockIndex?: number;
}

// ─────────────────────────────────────────────
// Funciones Auxiliares Locales (Sin Gemini)
// ─────────────────────────────────────────────
const loadPdfJS = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      resolve((window as any).pdfjsLib);
    };
    script.onerror = () => {
      reject(new Error('No se pudo cargar la librería PDF.js desde CDN.'));
    };
    document.head.appendChild(script);
  });
};

const extractTextFromPdf = async (file: File): Promise<string> => {
  const pdfjs = await loadPdfJS();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    text += `\n--- PÁGINA ${i} ---\n` + pageText;
  }
  return text;
};

const isPdfScanned = (text: string): boolean => {
  return text.replace(/\s+/g, '').length < 100;
};

import { parseQuestionsHeuristically, type ParserResult } from '../../../utils/preguntaParser';

// Componente
// ─────────────────────────────────────────────
export const ImportarPreguntas: React.FC = () => {
  const [mode, setMode] = useState<'home' | 'paste_text' | 'pdf_analyzing' | 'preview'>('home');
  
  const [questions, setQuestions] = useState<AnalyzedQuestion[]>([]);
  const [imageTasks, setImageTasks] = useState<ImageTask[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<number | ''>('');
  
  const [filterMode, setFilterMode] = useState<'ALL' | 'REVIEW'>('ALL');
  const [modalImage, setModalImage] = useState<string | null>(null);

  const [cropper, setCropper] = useState<CropperState>({ isOpen: false, imageUrl: '', questionId: '', targetType: 'enunciado' });

  // Refs para inputs ocultos
  const docInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  // ── Estados para el rediseño multicard ──
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentText, setDocumentText] = useState<string>('');
  const [isDocumentExtracting, setIsDocumentExtracting] = useState(false);
  const [isDocumentScanned, setIsDocumentScanned] = useState(false);

  const [pastedText, setPastedText] = useState<string>('');
  const [pastedTextPreview, setPastedTextPreview] = useState<ParserResult | null>(null);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [geminiCount, setGeminiCount] = useState<number>(() => {
    const stored = localStorage.getItem('gemini_queries_count');
    return stored ? parseInt(stored) : 4;
  });

  const incrementGeminiCount = () => {
    setGeminiCount(prev => {
      const newVal = prev + 1;
      localStorage.setItem('gemini_queries_count', newVal.toString());
      return newVal;
    });
  };

  useEffect(() => {
    listarCursos().then(data => {
      setCursos(data);
      if (data.length > 0) setSelectedCursoId(data[0].id);
    }).catch(e => console.error('Error al cargar cursos:', e));
  }, []);

  // ── Mapear respuesta de Gemini ──
  const mapGeminiToQuestions = (preguntas: GeminiPregunta[], originalUrl?: string): AnalyzedQuestion[] => {
    return preguntas.map((q, idx) => {
      const alts = q.alternativas ?? [];
      const LETRAS = ['A', 'B', 'C', 'D', 'E'];
      const letrasPresentes = alts.map(a => a.letra?.toUpperCase() || '');
      const faltantes = LETRAS.filter(l => !letrasPresentes.includes(l));

      let isValid = true;
      let needsReview = false;
      let errorMessage: string | undefined;

      const tipo_bloque = q.tipo_bloque || 'pregunta';
      
      if (tipo_bloque === 'pregunta') {
        if (alts.length < 5) {
          isValid = false;
          needsReview = true;
          errorMessage = `Faltan alternativas: ${faltantes.join(', ')}.`;
        }
        if (!q.enunciado || q.enunciado.trim() === '') {
          isValid = false;
          needsReview = true;
          errorMessage = errorMessage ? errorMessage + ' No se encontró enunciado.' : 'No se encontró enunciado.';
        }
      } else {
        needsReview = true;
      }

      if (q.confianza_extraccion !== undefined && q.confianza_extraccion < 80) needsReview = true;
      if (q.posible_incompleta) needsReview = true;

      // Parsear bloques de alternativas para detectar si necesitan imagen
      const parsedAlternativas: ParsedAlternativa[] = alts.map((a, i) => {
        let altNeedsImage = false;
        if (a.contenido_texto) {
          try {
            const blocks = JSON.parse(a.contenido_texto);
            if (Array.isArray(blocks)) {
               altNeedsImage = blocks.some((b: any) => b.tipo === 'imagen' && !b.url);
            }
          } catch(e) {}
        }
        if (altNeedsImage) needsReview = true; 
        
        return {
          letra: (a.letra || '?').toUpperCase(),
          tipo: 'TEXTO', // mantenemos texto base porque la imagen va en el bloque
          contenidoTexto: a.contenido_texto ?? null,
          esCorrecta: false as const,
          imagenUrl: a.imagen_url,
          ordenVisualizacion: i + 1,
          needsImage: altNeedsImage
        };
      });

      // Parsear bloques del enunciado para detectar si necesita imagen
      let enunciadoNeedsImage = false;
      if (q.enunciado) {
        try {
          const blocks = JSON.parse(q.enunciado);
          if (Array.isArray(blocks)) {
             enunciadoNeedsImage = blocks.some((b: any) => b.tipo === 'imagen' && !b.url);
          }
        } catch(e) {}
      }
      if (enunciadoNeedsImage) needsReview = true;

      return {
        id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        numero: q.numero ?? idx + 1,
        enunciado: q.enunciado ?? '',
        isValid,
        needsReview,
        errorMessage,
        dificultad: q.dificultad ?? 'MEDIO',
        tiene_imagen_enunciado: q.tiene_imagen_enunciado,
        descripcion_imagen: q.descripcion_imagen,
        imagenUrl: q.imagen_url,
        originalImageUrl: originalUrl || q.imagen_url,
        alternativas: alts,
        parsedAlternativas: isValid ? parsedAlternativas : undefined,
        tipo_bloque,
        posible_incompleta: q.posible_incompleta,
        confianza_extraccion: q.confianza_extraccion,
        enunciadoNeedsImage
      };
    });
  };

  // ── Handlers de Documento (Tarjeta 1) ──
  const handleDocChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    setDocumentFile(file);
    setIsDocumentExtracting(true);
    setIsDocumentScanned(false);
    setDocumentText('');

    try {
      if (file.type === 'text/plain') {
        const text = await file.text();
        setDocumentText(text);
      } else if (file.type === 'application/pdf') {
        const text = await extractTextFromPdf(file);
        setDocumentText(text);
        if (isPdfScanned(text)) {
          setIsDocumentScanned(true);
        }
      } else {
        alert('Formato no soportado. Por favor sube un archivo PDF o TXT.');
        setDocumentFile(null);
      }
    } catch (err) {
      console.error(err);
      alert('Error al leer el archivo.');
      setDocumentFile(null);
    } finally {
      setIsDocumentExtracting(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleProcessDoc = () => {
    if (!selectedCursoId) { alert('Selecciona un curso primero.'); return; }
    if (!documentText) { alert('Carga un documento primero.'); return; }
    if (isDocumentScanned) { alert('No se puede procesar localmente un PDF escaneado.'); return; }

    const parsedResult = parseQuestionsHeuristically(documentText);
    if (parsedResult.questions.length === 0) {
      const errorMsg = parsedResult.diagnostics.errors.join('\n') || 'No se detectaron preguntas en el documento.';
      alert(errorMsg);
      return;
    }

    const mappedPreguntas: GeminiPregunta[] = parsedResult.questions.map((q: any) => ({
      numero: q.numero ?? 0,
      enunciado: q.enunciado,
      alternativas: q.alternativas.map((alt: any) => ({
        letra: alt.letra,
        contenido_texto: alt.contenido,
        tipo: 'texto'
      })),
      tipo_bloque: 'pregunta',
      tiene_imagen_enunciado: false
    }));

    const mapped = mapGeminiToQuestions(mappedPreguntas);
    setQuestions(mapped);
    setMode('preview');
  };

  // ── Handlers de Pegar Texto (Tarjeta 2) ──
  const handlePasteTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPastedText(val);
    if (val.trim()) {
      const result = parseQuestionsHeuristically(val);
      setPastedTextPreview(result);
    } else {
      setPastedTextPreview(null);
    }
  };

  const handleProcessPastedText = () => {
    if (!selectedCursoId) { alert('Selecciona un curso primero.'); return; }
    if (!pastedText.trim()) { alert('Pega algo de texto primero.'); return; }

    const result = pastedTextPreview || parseQuestionsHeuristically(pastedText);
    if (result.questions.length === 0) {
      const errorMsg = result.diagnostics.errors.join('\n') || 'No se detectaron preguntas.';
      alert(errorMsg);
      return;
    }

    const mappedPreguntas: GeminiPregunta[] = result.questions.map((q: any) => ({
      numero: q.numero ?? 0,
      enunciado: q.enunciado,
      alternativas: q.alternativas.map((alt: any) => ({
        letra: alt.letra,
        contenido_texto: alt.contenido,
        tipo: 'texto'
      })),
      tipo_bloque: 'pregunta',
      tiene_imagen_enunciado: false
    }));

    const mapped = mapGeminiToQuestions(mappedPreguntas);
    setQuestions(mapped);
    setMode('preview');
  };

  // ── Handlers de Imágenes (Tarjeta 3) ──
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
    if (files.length > 0) {
      setImageFiles(prev => [...prev, ...files]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcessImages = () => {
    if (!selectedCursoId) { alert('Selecciona un curso primero.'); return; }
    if (imageFiles.length === 0) { alert('Carga al menos una imagen primero.'); return; }

    const newTasks: ImageTask[] = imageFiles.map((file, idx) => ({
      id: `task-${Date.now()}-${idx}-${Math.random()}`,
      file,
      status: 'pending'
    }));

    setImageTasks(newTasks);
    incrementGeminiCount();
    setMode('pdf_analyzing');
  };

  // ── BATCH PROCESSING LOOPER ──
  useEffect(() => {
    const processNextBatch = async () => {
      if (isProcessingBatch) return;
      
      const pendingTasks = imageTasks.filter(t => t.status === 'pending');
      if (pendingTasks.length === 0) {
        if (imageTasks.length > 0 && imageTasks.every(t => t.status !== 'processing')) {
           const successfulResults = imageTasks.filter(t => t.status === 'success' && t.result).map(t => t.result!);
           if (successfulResults.length > 0 && mode !== 'preview') {
              setQuestions(prev => {
                 const newQuestions = successfulResults.filter(sr => !prev.some(p => p.id === sr.id));
                 return [...prev, ...newQuestions];
              });
              setMode('preview');
           }
        }
        return;
      }

      setIsProcessingBatch(true);
      const batch = pendingTasks.slice(0, 5);
      setImageTasks(prev => prev.map(t => batch.some(b => b.id === t.id) ? { ...t, status: 'processing' } : t));

      try {
        const files = batch.map(t => t.file);
        const resp = await importarImagenes(files, selectedCursoId);
        
        setImageTasks(prev => prev.map(t => {
          const indexInBatch = batch.findIndex(b => b.id === t.id);
          if (indexInBatch !== -1) {
            const rawQ = resp.preguntas?.find((m: GeminiPregunta) => m.numero === indexInBatch + 1);
            if (rawQ) {
              const mappedArr = mapGeminiToQuestions([rawQ], rawQ.imagen_url);
              return { ...t, status: 'success', result: mappedArr[0] };
            } else {
              return { ...t, status: 'error', errorMsg: 'Fallo al procesar o imagen ilegible.' };
            }
          }
          return t;
        }));

      } catch (err) {
        console.error("Error en batch", err);
        setImageTasks(prev => prev.map(t => batch.some(b => b.id === t.id) ? { ...t, status: 'error', errorMsg: 'Error de red o de IA.' } : t));
      } finally {
        setIsProcessingBatch(false);
      }
    };

    processNextBatch();
  }, [imageTasks, isProcessingBatch, selectedCursoId, mode]);

  // ── Recorte de Imágenes ──
  const openCropper = (questionId: string, originalUrl: string, targetType: 'enunciado' | 'alternativa', alternativaIndex?: number, blockIndex?: number) => {
    setCropper({ isOpen: true, imageUrl: originalUrl, questionId, targetType, alternativaIndex, blockIndex });
  };

  const handleCropperSave = async (blob: Blob) => {
    try {
      const url = await uploadRecorte(blob);
      setQuestions(prev => prev.map(q => {
        if (q.id !== cropper.questionId) return q;
        
        if (cropper.targetType === 'enunciado') {
          // Update the specific block in enunciado
          let newEnunciado = q.enunciado;
          try {
            const blocks = JSON.parse(q.enunciado);
            if (Array.isArray(blocks) && cropper.blockIndex !== undefined) {
               blocks[cropper.blockIndex].url = url;
               newEnunciado = JSON.stringify(blocks);
            }
          } catch(e) {}
          
          let stillNeedsReviewEnunciado = false;
          try {
            const b = JSON.parse(newEnunciado);
            stillNeedsReviewEnunciado = b.some((x: any) => x.tipo === 'imagen' && !x.url);
          } catch(e){}

          const stillNeedsReview = stillNeedsReviewEnunciado || (q.parsedAlternativas || []).some(a => a.needsImage) || !q.isValid || (q.confianza_extraccion !== undefined && q.confianza_extraccion < 80);
          
          // Mantenemos null en q.imagenUrl (legacy) y solo actualizamos el bloque dentro del json string.
          return { ...q, enunciado: newEnunciado, needsReview: stillNeedsReview, enunciadoNeedsImage: stillNeedsReviewEnunciado };
        } else if (cropper.targetType === 'alternativa' && cropper.alternativaIndex !== undefined) {
          const newAlts = [...(q.parsedAlternativas || [])];
          let altContent = newAlts[cropper.alternativaIndex].contenidoTexto;
          if (altContent) {
            try {
              const blocks = JSON.parse(altContent);
              if (Array.isArray(blocks) && cropper.blockIndex !== undefined) {
                 blocks[cropper.blockIndex].url = url;
                 altContent = JSON.stringify(blocks);
              }
            } catch(e) {}
          }
          
          let altNeedsImage = false;
          if (altContent) {
            try {
              const blocks = JSON.parse(altContent);
              altNeedsImage = blocks.some((b: any) => b.tipo === 'imagen' && !b.url);
            } catch(e) {}
          }

          newAlts[cropper.alternativaIndex] = { 
            ...newAlts[cropper.alternativaIndex], 
            contenidoTexto: altContent,
            needsImage: altNeedsImage
          };
          
          const stillNeedsReview = (q as any).enunciadoNeedsImage || newAlts.some(a => a.needsImage) || !q.isValid || (q.confianza_extraccion !== undefined && q.confianza_extraccion < 80);
          
          return { ...q, parsedAlternativas: newAlts, needsReview: stillNeedsReview };
        }
        return q;
      }));
      setCropper(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
      console.error(err);
      alert('Error subiendo el recorte a Cloudinary.');
    }
  };

  // ── Guardar y Cancelar ──
  const handleGuardar = async () => {
    const valid = questions.filter(q => q.isValid && q.parsedAlternativas && !q.parsedAlternativas.some(a => a.needsImage));
    if (!valid.length) { alert('No hay preguntas válidas y completas para guardar.'); return; }
    if (!selectedCursoId) { alert('Selecciona un curso primero.'); return; }

    setIsImporting(true);
    try {
      const payload = valid.map(q => ({
        enunciado: q.enunciado,
        dificultad: q.dificultad || 'MEDIO',
        activo: true,
        cursoId: Number(selectedCursoId),
        imagenUrl: q.imagenUrl ?? null,
        tieneImagen: !!q.imagenUrl,
        alternativas: q.parsedAlternativas!.map(a => ({
          letra: a.letra,
          tipo: a.tipo,
          contenidoTexto: a.contenidoTexto,
          esCorrecta: false,
          imagenUrl: a.imagenUrl ?? null,
          ordenVisualizacion: a.ordenVisualizacion ?? null,
        }))
      }));

      const res = await guardarLotePreguntas(payload);
      alert(`Importación finalizada con éxito. Se guardaron ${res.length} preguntas.`);
      handleCancel();
    } catch (err) {
      console.error('Error al guardar lote de preguntas', err);
      alert('Hubo un error al guardar las preguntas. Revisa la consola.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setQuestions([]);
    setImageTasks([]);
    setMode('home');
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  // ── Cálculos ──
  const stats = {
    total: questions.length,
    success: questions.filter(q => q.isValid && !q.needsReview && !q.parsedAlternativas?.some(a=>a.needsImage) && !(q as any).enunciadoNeedsImage).length,
    review: questions.filter(q => q.needsReview || q.parsedAlternativas?.some(a=>a.needsImage) || (q as any).enunciadoNeedsImage).length,
    errors: questions.filter(q => !q.isValid).length
  };

  const visibleQuestions = filterMode === 'REVIEW' ? questions.filter(q => q.needsReview || !q.isValid || q.parsedAlternativas?.some(a=>a.needsImage) || (q as any).enunciadoNeedsImage) : questions;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="import-container">
      {modalImage && (
        <div className="modal-overlay" onClick={() => setModalImage(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setModalImage(null)}>&times;</button>
            <img src={modalImage} alt="Ampliación" />
          </div>
        </div>
      )}

      {cropper.isOpen && (
        <ImageCropperModal
          imageUrl={cropper.imageUrl}
          onClose={() => setCropper(prev => ({ ...prev, isOpen: false }))}
          onSave={handleCropperSave}
          title={cropper.targetType === 'enunciado' ? 'Recortar Enunciado' : 'Recortar Alternativa'}
        />
      )}

      <header className="page-header">
        <h1>Importar Preguntas</h1>
        <p>Priorizamos la precisión. Selecciona el método que coincida con tu formato.</p>
      </header>

      <div style={{ maxWidth: 400, margin: '0 auto 32px auto', textAlign: 'center' }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text-main)' }}>Curso Destino:</label>
        <select
          value={selectedCursoId}
          onChange={e => setSelectedCursoId(e.target.value ? Number(e.target.value) : '')}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: 15 }}
          disabled={mode === 'pdf_analyzing'}
        >
          <option value="" disabled>Selecciona un curso</option>
          {cursos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

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
                const file = e.dataTransfer.files[0];
                const fakeEvent = { target: { files: [file] } } as unknown as ChangeEvent<HTMLInputElement>;
                handleDocChange(fakeEvent);
              }
            }}
          >
            <div className="import-card-header">
              <div className="card-icon">📄</div>
              <h3>Importar Documento</h3>
              <p>Extrae preguntas de texto de archivos locales. Procesamiento 100% local, sin consumo de IA.</p>
            </div>
            
            <input 
              type="file" 
              ref={docInputRef} 
              onChange={handleDocChange} 
              accept=".pdf,.txt" 
              style={{ display: 'none' }} 
            />

            {!documentFile ? (
              <button 
                className="btn btn-secondary" 
                onClick={() => docInputRef.current?.click()}
                style={{ width: '100%', borderStyle: 'dashed' }}
              >
                Seleccionar PDF o TXT
              </button>
            ) : (
              <div className="doc-preview-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                    📎 {documentFile.name}
                  </span>
                  <button 
                    className="btn-small danger" 
                    onClick={() => { setDocumentFile(null); setDocumentText(''); setIsDocumentScanned(false); }}
                    style={{ padding: '2px 8px' }}
                  >
                    Quitar
                  </button>
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
                    {isDocumentScanned && (
                      <div className="card-recommendation-warning">
                        ⚠️ Este PDF parece estar escaneado (es una imagen). Para importar este archivo, por favor usa la <strong>Tarjeta 3 (Importar Imagen)</strong> para procesarlo con IA.
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
              <div className="card-icon">✍️</div>
              <h3>Pegar Texto</h3>
              <p>Pega preguntas directamente desde Word, PDF o páginas web. Permite revisión en tiempo real.</p>
            </div>

            <div className="import-card-footer" style={{ marginTop: 'auto' }}>
              <button 
                className="btn btn-primary" 
                onClick={(e) => { e.stopPropagation(); setMode('paste_text'); }}
                style={{ width: '100%' }}
              >
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
            <div className="gemini-badge">
              Consultas • {geminiCount}/20
            </div>

            <div className="import-card-header">
              <div className="card-icon">🖼️</div>
              <h3>Importar Imagen</h3>
              <p>Arrastra, selecciona o pega capturas de pantalla de tus preguntas. Usa Gemini IA para procesarlas.</p>
            </div>

            <input 
              type="file" 
              ref={imageInputRef} 
              onChange={handleImageSelect} 
              accept="image/*" 
              multiple 
              style={{ display: 'none' }} 
            />

            {imageFiles.length === 0 ? (
              <button 
                className="btn btn-secondary" 
                onClick={() => imageInputRef.current?.click()}
                style={{ width: '100%', borderStyle: 'dashed' }}
              >
                Seleccionar o pegar imágenes
              </button>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    🖼️ {imageFiles.length} imágenes cargadas
                  </span>
                  <button 
                    className="btn-small danger" 
                    onClick={() => setImageFiles([])}
                    style={{ padding: '2px 8px' }}
                  >
                    Quitar todas
                  </button>
                </div>

                <div className="image-previews-grid">
                  {imageFiles.map((file, i) => {
                    const url = URL.createObjectURL(file);
                    return (
                      <div key={i} className="image-preview-thumbnail">
                        <img src={url} alt={`Preview ${i}`} />
                        <button className="remove-thumb-btn" onClick={() => handleRemoveImage(i)}>&times;</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="import-card-footer">
              <button 
                className="btn btn-primary" 
                onClick={handleProcessImages} 
                disabled={imageFiles.length === 0 || !selectedCursoId}
                style={{ width: '100%' }}
              >
                Procesar imagen
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'paste_text' && (
        <div className="panel fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="panel-title">
            <span>✍️ Editor de Pegado de Texto</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {pastedText.length} caracteres
            </span>
          </div>

          <div className="editor-layout" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', marginTop: '16px' }}>
            {/* Editor de la izquierda */}
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

            {/* Vista previa de diagnóstico a la derecha */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8f9fa', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', maxHeight: '480px', overflowY: 'auto' }}>
              <h4 style={{ margin: 0, paddingBottom: '8px', borderBottom: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📋 Vista Previa e Interpretación</span>
                {pastedTextPreview && (
                  <span className={`badge ${pastedTextPreview.diagnostics.isValid ? 'badge-success' : 'badge-danger'}`}>
                    {pastedTextPreview.questions.length} detectadas
                  </span>
                )}
              </h4>

              {/* Si no hay texto */}
              {!pastedText.trim() && (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                  Escribe o pega texto en el editor de la izquierda para comenzar el análisis en tiempo real.
                </div>
              )}

              {/* Diagnósticos globales */}
              {pastedTextPreview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pastedTextPreview.diagnostics.errors.map((err: string, idx: number) => (
                    <div key={idx} style={{ color: 'var(--error-color)', background: 'var(--error-bg)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                      ❌ {err}
                    </div>
                  ))}
                  {pastedTextPreview.diagnostics.warnings.map((warn: string, idx: number) => (
                    <div key={idx} style={{ color: 'var(--warning-color)', background: 'var(--warning-bg)', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                      ⚠️ {warn}
                    </div>
                  ))}
                </div>
              )}

              {/* Lista detallada de preguntas interpretadas */}
              {pastedTextPreview && pastedTextPreview.questions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  {pastedTextPreview.questions.map((q: any, idx: number) => {
                    const enunciadoText = q.enunciado ? JSON.parse(q.enunciado)[0]?.valor : '';
                    const hasEnunciado = enunciadoText && enunciadoText.trim().length >= 10;
                    
                    const altsWithContent = q.alternativas.filter((alt: any) => {
                      try {
                        const val = JSON.parse(alt.contenido)[0]?.valor;
                        return val && val.trim().length > 0;
                      } catch(e) { return false; }
                    });
                    
                    const hasAllAlternatives = altsWithContent.length >= 5;
                    const alternativesCount = altsWithContent.length;

                    return (
                      <div key={idx} style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e8eaed', fontSize: '13px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Pregunta #{q.numero}</span>
                          <span style={{ fontSize: '11px', color: (hasEnunciado && hasAllAlternatives) ? 'var(--success-color)' : 'var(--warning-color)' }}>
                            {(hasEnunciado && hasAllAlternatives) ? '✓ Válida' : '⚠ Requiere revisión'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#5f6368', paddingLeft: '4px' }}>
                          <div>
                            {hasEnunciado ? '🟢' : '🔴'} Enunciado: {hasEnunciado ? `"${enunciadoText.substring(0, 50)}${enunciadoText.length > 50 ? '...' : ''}"` : (enunciadoText.trim().length > 0 ? 'Demasiado corto' : 'Faltante o vacío')}
                          </div>
                          <div>
                            {hasAllAlternatives ? '🟢' : '🟡'} Alternativas ({alternativesCount}): {altsWithContent.map((a: any) => a.letra).join(', ') || 'Ninguna'}
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
          <p>Extrayendo texto y procesando con Inteligencia Artificial…</p>
        </div>
      )}

      {mode === 'preview' && (
        <div className="panel fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 className="panel-title">
            Revisión Final
            <span style={{ fontSize: 14, fontWeight: 'normal', color: 'var(--text-muted)' }}>{questions.length} preguntas detectadas</span>
          </h2>

          <div className="summary-bar">
            <div className="summary-stat stat-total"><span>📋</span> Total: {stats.total}</div>
            <div className="summary-stat stat-success"><span>✅</span> Completas: {stats.success}</div>
            <div className="summary-stat stat-warning"><span>⚠️</span> Revisar: {stats.review}</div>
            <div className="summary-stat stat-error"><span>❌</span> Errores: {stats.errors}</div>
          </div>

          <div className="filter-controls">
            <button className={`btn-small ${filterMode === 'ALL' ? 'active' : ''}`} onClick={() => setFilterMode('ALL')} style={{ background: filterMode === 'ALL' ? '#e8f0fe' : 'white', borderColor: filterMode === 'ALL' ? '#1a73e8' : '#dadce0', color: filterMode === 'ALL' ? '#1a73e8' : '#5f6368' }}>Todas</button>
            <button className={`btn-small ${filterMode === 'REVIEW' ? 'active' : ''}`} onClick={() => setFilterMode('REVIEW')} style={{ background: filterMode === 'REVIEW' ? '#fef3c7' : 'white', borderColor: filterMode === 'REVIEW' ? '#f59e0b' : '#dadce0', color: filterMode === 'REVIEW' ? '#d97706' : '#5f6368' }}>Solo con advertencias</button>
          </div>

          <div className="preview-list">
            {visibleQuestions.map(q => (
              <div key={q.id} className={`preview-item ${!q.isValid ? 'error' : q.needsReview ? 'warning' : ''}`}>
                <div className={`status-icon`}>
                  {!q.isValid ? '❌' : q.needsReview ? '⚠️' : '✅'}
                </div>
                <div className="question-content">
                  
                  <div className="q-badges">
                    <span className={`badge ${q.tiene_imagen_enunciado || q.imagenUrl ? 'badge-image' : 'badge-text'}`}>
                       {q.tiene_imagen_enunciado || q.imagenUrl ? '🖼 Imagen' : '📄 Texto'}
                    </span>
                    {q.tipo_bloque !== 'pregunta' && (
                      <span className="badge badge-warning">📝 Bloque: {q.tipo_bloque}</span>
                    )}
                    {(q.confianza_extraccion !== undefined && q.confianza_extraccion < 80) && (
                      <span className="badge badge-purple">❓ Confianza baja ({q.confianza_extraccion}%)</span>
                    )}
                    {q.posible_incompleta && (
                      <span className="badge badge-danger">✂️ Incompleta</span>
                    )}
                  </div>

                  <div className="q-text">
                    <strong>Pregunta {q.numero}.</strong>
                    <ContentRenderer 
                      contentStr={q.enunciado} 
                      onImageClick={setModalImage}
                      onCropClick={q.originalImageUrl ? (blockIdx) => openCropper(q.id, q.originalImageUrl!, 'enunciado', undefined, blockIdx) : undefined} 
                    />
                  </div>

                  <div className="q-options" style={{ marginTop: 16 }}>
                    {q.parsedAlternativas?.map((alt, idx) => (
                      <div key={idx} style={{ marginBottom: 12, padding: '8px', border: '1px solid #e8eaed', borderRadius: 8, background: '#f8f9fa' }}>
                        <strong>{alt.letra})</strong>{' '}
                        {alt.contenidoTexto ? (
                           <ContentRenderer 
                             contentStr={alt.contenidoTexto} 
                             onImageClick={setModalImage}
                             onCropClick={q.originalImageUrl ? (blockIdx) => openCropper(q.id, q.originalImageUrl!, 'alternativa', idx, blockIdx) : undefined}
                           />
                        ) : (
                           <span style={{ color: '#d93025', fontStyle: 'italic' }}>Vacío</span>
                        )}
                        
                        {/* Render fallback de la imagen si era imagen vieja (por compatibilidad en ImportarPreguntas) */}
                        {alt.imagenUrl && (
                          <div className="q-image-container" onClick={() => setModalImage(alt.imagenUrl!)} style={{ marginTop: 8 }}>
                            <img src={alt.imagenUrl} alt={`Alternativa ${alt.letra}`} style={{ maxHeight: 100 }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {!q.isValid && q.errorMessage && (
                    <div className="q-error-msg">{q.errorMessage}</div>
                  )}

                  <div className="q-actions">
                    <button className="btn-small danger" onClick={() => removeQuestion(q.id)}>🗑️ Eliminar</button>
                    {/* Botón obsoleto de recorte global, se mantiene sólo si la pregunta falla totalmente y necesita recorte manual extra. */}
                  </div>

                </div>
              </div>
            ))}
            
            {visibleQuestions.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#5f6368' }}>No hay preguntas que coincidan con el filtro.</div>
            )}
          </div>

          <div className="action-footer">
            <button className="btn btn-secondary" onClick={handleCancel} disabled={isImporting}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleGuardar} disabled={isImporting || stats.success === 0}>
              {isImporting ? 'Guardando...' : `Guardar ${questions.filter(q => q.isValid).length} preguntas válidas`}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};