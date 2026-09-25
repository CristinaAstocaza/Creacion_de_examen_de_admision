import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './BancoPreguntas.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { listarCursos } from '../../services/cursoService';
import {
  actualizarPregunta,
  crearPregunta,
  listarPreguntas,
  eliminarPregunta,
  obtenerPregunta,
  uploadRecorte,
} from '../../services/preguntaService';
import { ContentRenderer } from '../ui/ContentRenderer';

interface Curso {
  id: number;
  nombre: string;
  codigo: string | null;
  activo: boolean;
}

interface AlternativaResponse {
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  tipo: 'TEXTO' | 'IMAGEN';
  contenidoTexto: string | null;
  imagenUrl: string | null;
  esCorrecta: boolean;
  ordenVisualizacion: number | null;
}

interface PreguntaResponse {
  id: number;
  codigo: string;
  enunciado: string;
  imagenUrl: string | null;
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL'; // kept for backend compatibility
  activo: boolean;
  cursoId: number;
  cursoNombre: string;
  alternativas: AlternativaResponse[];
}

interface AlternativaForm {
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  tipo: 'TEXTO' | 'IMAGEN'; // auto-computed on save, kept for compatibility
  contenidoTexto: string;
  imagenUrl: string;
  esCorrecta: boolean;
  ordenVisualizacion: number;
}

interface FormDataPregunta {
  codigo: string;
  cursoId: string;
  enunciado: string;
  imagenUrl: string;
  dificultad: 'FACIL' | 'MEDIO' | 'DIFICIL'; // hidden from UI, always sent as 'MEDIO'
  activo: boolean;
  alternativas: AlternativaForm[];
}

const letras = ['A', 'B', 'C', 'D', 'E'] as const;

const crearFormVacio = (): FormDataPregunta => ({
  codigo: '',
  cursoId: '',
  enunciado: '',
  imagenUrl: '',
  dificultad: 'MEDIO',
  activo: true,
  alternativas: letras.map((letra, index) => ({
    letra,
    tipo: 'TEXTO',
    contenidoTexto: '',
    imagenUrl: '',
    esCorrecta: false,
    ordenVisualizacion: index + 1,
  })),
});

const parseContentBlocks = (contentStr: string): any[] => {
  if (!contentStr) return [];
  let value: any = contentStr;
  for (let i = 0; i < 3; i += 1) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') break;
    try {
      value = JSON.parse(value);
    } catch {
      break;
    }
  }
  if (Array.isArray(value)) return value;
  return [{ tipo: 'texto', valor: String(value ?? contentStr) }];
};

const extractTextFromBlocks = (contentStr: string): string =>
  parseContentBlocks(contentStr)
    .filter((b: any) => b?.tipo === 'texto' || b?.tipo === 'latex')
    .map((b: any) => b?.valor ?? b?.contenido ?? b?.texto ?? '')
    .join('\n')
    .trim();

const extractImageUrlsFromBlocks = (contentStr: string): string[] =>
  [...new Set(
    parseContentBlocks(contentStr)
      .filter((b: any) => b?.tipo === 'imagen' && b?.url)
      .map((b: any) => String(b.url))
  )];

const normalizeBlocksString = (contentStr: string): string => {
  const blocks = parseContentBlocks(contentStr);
  return JSON.stringify(blocks.map((b: any) => {
    if (b?.tipo === 'texto' || b?.tipo === 'latex') {
      return { ...b, valor: b.valor ?? b.contenido ?? b.texto ?? '' };
    }
    return b;
  }));
};

const isBlockFormat = (contentStr: string): boolean => {
  if (!contentStr) return false;
  const blocks = parseContentBlocks(contentStr);
  return blocks.length > 0 && blocks.some((b: any) => ['texto', 'latex', 'imagen'].includes(b?.tipo));
};

export default function BancoPreguntas() {
  const [preguntas, setPreguntas] = useState<PreguntaResponse[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCursoId, setFilterCursoId] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState<PreguntaResponse | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormDataPregunta>(crearFormVacio());
  const [isSaving, setIsSaving] = useState(false);

  // ── Enunciado image state ──
  const [enunciadoImageFiles, setEnunciadoImageFiles] = useState<File[]>([]);
  const [enunciadoImagePreviews, setEnunciadoImagePreviews] = useState<string[]>([]);
  const [enunciadoUrlMode, setEnunciadoUrlMode] = useState(false);
  const [enunciadoUrlDraft, setEnunciadoUrlDraft] = useState('');
  const enunciadoFileRef = useRef<HTMLInputElement>(null);

  // ── Alternativas image state (5 slots A-E) ──
  const [altImageFiles, setAltImageFiles] = useState<(File | null)[]>([null, null, null, null, null]);
  const [altImagePreviews, setAltImagePreviews] = useState<string[]>(['', '', '', '', '']);
  const [altUrlModes, setAltUrlModes] = useState<boolean[]>([false, false, false, false, false]);
  const altFileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null]);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [preguntasData, cursosData] = await Promise.all([listarPreguntas(), listarCursos()]);
      setPreguntas(preguntasData);
      setCursos(cursosData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar preguntas y cursos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const filteredQuestions = useMemo(
    () =>
      preguntas.filter((q) => {
        const matchesSearch =
          q.enunciado.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.codigo.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCurso = filterCursoId ? q.cursoId === Number(filterCursoId) : true;
        return matchesSearch && matchesCurso;
      }),
    [filterCursoId, preguntas, searchTerm]
  );

  // ── Auto-generate PREG-XXXXX code ──
  const generarCodigoAutomatico = (lista: PreguntaResponse[]): string => {
    const nums = lista
      .map((p) => p.codigo)
      .filter((c) => /^PREG-\d+$/.test(c))
      .map((c) => parseInt(c.replace('PREG-', ''), 10))
      .filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `PREG-${String(max + 1).padStart(5, '0')}`;
  };

  const resetImageState = () => {
    setEnunciadoImageFiles([]);
    setEnunciadoImagePreviews([]);
    setEnunciadoUrlMode(false);
    setEnunciadoUrlDraft('');
    setAltImageFiles([null, null, null, null, null]);
    setAltImagePreviews(['', '', '', '', '']);
    setAltUrlModes([false, false, false, false, false]);
    if (enunciadoFileRef.current) enunciadoFileRef.current.value = '';
    altFileRefs.current.forEach((ref) => { if (ref) ref.value = ''; });
  };

  const handleOpenDetail = async (question: PreguntaResponse) => {
    try {
      const data = await obtenerPregunta(question.id);
      setSelectedQuestion(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al obtener detalle de la pregunta');
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!window.confirm('¿Está seguro de eliminar esta pregunta?')) return;
    try {
      await eliminarPregunta(id);
      await cargarDatos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar la pregunta');
    }
  };

  const handleOpenCreateForm = () => {
    setEditingId(null);
    const nuevo = crearFormVacio();
    nuevo.codigo = generarCodigoAutomatico(preguntas);
    setFormData(nuevo);
    resetImageState();
    setIsFormModalOpen(true);
  };

  const handleOpenEditForm = (question: PreguntaResponse) => {
    setEditingId(question.id);
    setFormData({
      codigo: question.codigo || '',
      cursoId: String(question.cursoId),
      enunciado: extractTextFromBlocks(question.enunciado),
      imagenUrl: question.imagenUrl || '',
      dificultad: question.dificultad || 'MEDIO',
      activo: question.activo,
      alternativas: letras.map((letra, index) => {
        const alt = question.alternativas.find((a) => a.letra === letra);
        return {
          letra,
          tipo: alt?.tipo || 'TEXTO',
          contenidoTexto: extractTextFromBlocks(alt?.contenidoTexto || ''),
          imagenUrl: alt?.imagenUrl || '',
          esCorrecta: alt?.esCorrecta || false,
          ordenVisualizacion: alt?.ordenVisualizacion || index + 1,
        };
      }),
    });
    resetImageState();
    const blockImages = extractImageUrlsFromBlocks(question.enunciado);
    const allImages = [...new Set([...blockImages, ...(question.imagenUrl ? [question.imagenUrl] : [])])];
    setEnunciadoImagePreviews(allImages);
    setFormData((prev) => ({ ...prev, imagenUrl: allImages[0] || '' }));
    const existingPreviews = letras.map((l) => {
      const a = question.alternativas.find((alt) => alt.letra === l);
      return a?.imagenUrl || '';
    });
    setAltImagePreviews(existingPreviews);
    setIsFormModalOpen(true);
  };

  const handleAlternativaChange = (index: number, field: keyof AlternativaForm, value: string | boolean) => {
    const alternativas = [...formData.alternativas];
    alternativas[index] = { ...alternativas[index], [field]: value };
    setFormData({ ...formData, alternativas });
  };

  // ── Enunciado image handlers ──
  const handleEnunciadoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const previews = files.map(file => URL.createObjectURL(file));
    setEnunciadoImageFiles(prev => [...prev, ...files]);
    setEnunciadoImagePreviews(prev => [...prev, ...previews]);
    setEnunciadoUrlMode(false);
    if (enunciadoFileRef.current) enunciadoFileRef.current.value = '';
  };

  const handleAddEnunciadoUrl = () => {
    const url = enunciadoUrlDraft.trim();
    if (!url) return;
    setEnunciadoImagePreviews(prev => [...prev, url]);
    setEnunciadoUrlDraft('');
    setEnunciadoUrlMode(false);
  };

  const handleRemoveEnunciadoImage = (index: number) => {
    setEnunciadoImagePreviews(prev => prev.filter((_, i) => i !== index));
    setEnunciadoImageFiles(prev => {
      // Newly selected files are appended to the end; remove matching file slot when applicable.
      const existingCount = Math.max(0, enunciadoImagePreviews.length - prev.length);
      const fileIndex = index - existingCount;
      return fileIndex >= 0 ? prev.filter((_, i) => i !== fileIndex) : prev;
    });
  };


  // ── Alternativa image handlers ──
  const handleAltFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    const newFiles = [...altImageFiles];
    const newPreviews = [...altImagePreviews];
    newFiles[index] = file;
    newPreviews[index] = preview;
    setAltImageFiles(newFiles);
    setAltImagePreviews(newPreviews);
    handleAlternativaChange(index, 'imagenUrl', '');
    const newModes = [...altUrlModes];
    newModes[index] = false;
    setAltUrlModes(newModes);
  };

  const handleAltUrlChange = (index: number, url: string) => {
    handleAlternativaChange(index, 'imagenUrl', url);
    const newPreviews = [...altImagePreviews];
    newPreviews[index] = url;
    setAltImagePreviews(newPreviews);
    const newFiles = [...altImageFiles];
    newFiles[index] = null;
    setAltImageFiles(newFiles);
  };

  const handleClearAltImage = (index: number) => {
    const newFiles = [...altImageFiles];
    const newPreviews = [...altImagePreviews];
    const newModes = [...altUrlModes];
    newFiles[index] = null;
    newPreviews[index] = '';
    newModes[index] = false;
    setAltImageFiles(newFiles);
    setAltImagePreviews(newPreviews);
    setAltUrlModes(newModes);
    handleAlternativaChange(index, 'imagenUrl', '');
    if (altFileRefs.current[index]) altFileRefs.current[index]!.value = '';
  };

  const toggleAltUrlMode = (index: number) => {
    const newModes = [...altUrlModes];
    newModes[index] = !newModes[index];
    setAltUrlModes(newModes);
  };

  const validarFormulario = (): boolean => {
    if (!formData.cursoId || !formData.enunciado.trim()) {
      alert('Selecciona un curso y escribe el enunciado.');
      return false;
    }
    const invalidas = formData.alternativas.some((alt, idx) => {
      const hasText = alt.contenidoTexto.trim().length > 0;
      const hasUrl = alt.imagenUrl.trim().length > 0;
      const hasFile = altImageFiles[idx] !== null;
      return !hasText && !hasUrl && !hasFile;
    });
    if (invalidas) {
      alert('Cada alternativa debe tener al menos texto o imagen.');
      return false;
    }
    return true;
  };

  const handleSaveQuestion = async () => {
    if (!validarFormulario()) return;
    setIsSaving(true);
    try {
      // 1. Conservar recortes existentes y subir nuevos recortes del enunciado
      const existingUrls = enunciadoImagePreviews.filter((url) => !url.startsWith('blob:'));
      const uploadedUrls = await Promise.all(enunciadoImageFiles.map(file => uploadRecorte(file)));
      const enunciadoFinalUrls = [...new Set([...existingUrls, ...uploadedUrls])];

      // 2. Upload alternativa image files if present, auto-compute tipo
      const alternativasFinales = await Promise.all(
        formData.alternativas.map(async (alt, idx) => {
          let finalAltUrl = alt.imagenUrl;
          if (altImageFiles[idx]) {
            finalAltUrl = await uploadRecorte(altImageFiles[idx]!);
          }
          const hasText = alt.contenidoTexto.trim().length > 0;
          const hasImage = finalAltUrl.trim().length > 0;
          // Auto-compute tipo: only IMAGEN when no text, else TEXTO (contenidoTexto carries content)
          const tipo: 'TEXTO' | 'IMAGEN' = hasImage && !hasText ? 'IMAGEN' : 'TEXTO';
          return { ...alt, imagenUrl: finalAltUrl, tipo };
        })
      );

      const wrapInTextBlock = (text: string): string => {
        if (!text) return '';
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) return text;
        } catch (e) {}
        return JSON.stringify([{ tipo: 'texto', valor: text }]);
      };

      const enunciadoBlocks = [
        { tipo: 'texto', valor: formData.enunciado.trim() },
        ...enunciadoFinalUrls.map(url => ({ tipo: 'imagen', url }))
      ];

      const payload = {
        codigo: formData.codigo.trim() || null,
        enunciado: JSON.stringify(enunciadoBlocks),
        imagenUrl: enunciadoFinalUrls[0] || null,
        tieneImagen: enunciadoFinalUrls.length > 0,
        dificultad: formData.dificultad,
        activo: formData.activo,
        cursoId: Number(formData.cursoId),
        alternativas: alternativasFinales.map((alt) => ({
          letra: alt.letra,
          tipo: alt.tipo,
          contenidoTexto: alt.contenidoTexto.trim() ? wrapInTextBlock(alt.contenidoTexto.trim()) : null,
          imagenUrl: alt.imagenUrl.trim() || null,
          esCorrecta: alt.esCorrecta,
          ordenVisualizacion: alt.ordenVisualizacion,
        })),
      };

      if (editingId) {
        await actualizarPregunta(editingId, payload);
      } else {
        await crearPregunta(payload);
      }
      setIsFormModalOpen(false);
      await cargarDatos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar la pregunta');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="banco-container">
      <div className="page-header">
        <h2 className="page-title">Banco de Preguntas</h2>
        <div className="header-actions">
          <button className="btn-primary" id="btn-nueva-pregunta" onClick={handleOpenCreateForm}>
            <span className="material-icons-outlined">add</span>
            Nueva Pregunta
          </button>
        </div>
      </div>

      {error && <div className="table-card" style={{ padding: '16px', color: 'var(--danger)' }}>{error}</div>}

      <div className="filters-bar">
        <input
          type="text"
          className="filter-input"
          placeholder="Buscar por palabra clave..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {/* Filtro Curso */}
        <Select value={filterCursoId} onValueChange={setFilterCursoId}>
          <SelectTrigger className="w-full px-3 py-2 text-left">
            <SelectValue placeholder="Todos los Cursos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="px-3 py-2 cursor-pointer">Todos los Cursos</SelectItem>
            {cursos.map((curso) => (
              <SelectItem key={curso.id} value={String(curso.id)} className="px-3 py-2 cursor-pointer">
                {curso.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="table-card shadcn-table-wrapper">
        <Table className="shadcn-table">
          <TableHeader>
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Pregunta</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  Cargando preguntas...
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredQuestions.map((q) => (
              <TableRow key={q.id}>
                <TableCell>{q.cursoNombre}</TableCell>
                <TableCell className="truncate-text" title={extractTextFromBlocks(q.enunciado)}>
                  {extractTextFromBlocks(q.enunciado)}
                </TableCell>
                <TableCell>
                  <div className="action-buttons">
                    <button className="btn-icon" title="Ver Detalle" onClick={() => handleOpenDetail(q)}>
                      <span className="material-icons-outlined">visibility</span>
                    </button>
                    <button className="btn-icon" title="Editar" onClick={() => handleOpenEditForm(q)}>
                      <span className="material-icons-outlined">edit</span>
                    </button>
                    <button className="btn-icon delete" title="Eliminar" onClick={() => handleDeleteQuestion(q.id)} style={{ color: 'var(--danger)' }}>
                      <span className="material-icons-outlined">delete</span>
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredQuestions.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No hay preguntas registradas para los filtros seleccionados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Modal: Crear / Editar pregunta ── */}
      {isFormModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-wide">
            <div className="modal-header">
              <h3>{editingId ? 'Editar Pregunta' : 'Nueva Pregunta'}</h3>
              <button className="btn-icon" onClick={() => setIsFormModalOpen(false)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="modal-body">
              {/* Fila: Curso */}
              <div className="form-group mb-0">
                <label>Curso *</label>
                <Select
                  value={formData.cursoId}
                  onValueChange={(value) => setFormData({ ...formData, cursoId: value })}
                >
                  <SelectTrigger className="w-full px-3 py-2 text-left">
                    <SelectValue placeholder="Seleccione..." />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {cursos.map((curso) => (
                      <SelectItem key={curso.id} value={String(curso.id)} className="px-3 py-2 cursor-pointer">
                        {curso.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Enunciado */}
              <div className="form-group">
                <label>Enunciado *</label>
                <textarea
                  className="form-control"
                  placeholder="Escribe la pregunta aquí..."
                  value={formData.enunciado}
                  onChange={(e) => setFormData({ ...formData, enunciado: e.target.value })}
                />
              </div>

              {/* Imágenes del enunciado */}
              <div className="form-group">
                <label>
                  Imágenes / recortes del enunciado
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> (Opcional, permite varias)</span>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 10 }}>
                  {enunciadoImagePreviews.map((src, index) => (
                    <div key={src + index} style={{ border: '1px solid #d9e0ea', borderRadius: 10, padding: 8, background: '#f8fafc', position: 'relative' }}>
                      <img
                        src={src}
                        alt={`Recorte ${index + 1}`}
                        style={{ width: '100%', height: 150, objectFit: 'contain', borderRadius: 8, background: '#fff' }}
                      />
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Recorte {index + 1}</div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEnunciadoImage(index)}
                        style={{ position: 'absolute', top: 6, right: 6, border: 0, borderRadius: 999, width: 28, height: 28, background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 700 }}
                        title="Eliminar este recorte"
                      >×</button>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" className="btn-upload-action" onClick={() => enunciadoFileRef.current?.click()}>
                    <span className="material-icons-outlined" style={{ fontSize: 16 }}>add_photo_alternate</span>
                    Añadir imagen
                  </button>
                  <button type="button" className="btn-upload-action btn-upload-url" onClick={() => setEnunciadoUrlMode(v => !v)}>
                    <span className="material-icons-outlined" style={{ fontSize: 16 }}>link</span>
                    Añadir por URL
                  </button>
                  {enunciadoUrlMode && (
                    <>
                      <input
                        className="form-control"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="https://..."
                        value={enunciadoUrlDraft}
                        onChange={(e) => setEnunciadoUrlDraft(e.target.value)}
                      />
                      <button type="button" className="btn-primary" onClick={handleAddEnunciadoUrl}>Agregar</button>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={enunciadoFileRef}
                    style={{ display: 'none' }}
                    onChange={handleEnunciadoFileSelect}
                  />
                </div>
              </div>

              <div className="form-group mb-0">
                <label>Estado</label>
                <Select
                  value={formData.activo ? 'Activo' : 'Inactivo'}
                  onValueChange={(value) => setFormData({ ...formData, activo: value === 'Activo' })}
                >
                  <SelectTrigger className="w-full px-3 py-2 text-left">
                    <SelectValue placeholder="Seleccione estado" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="Activo" className="px-3 py-2 cursor-pointer">Activo</SelectItem>
                    <SelectItem value="Inactivo" className="px-3 py-2 cursor-pointer">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Alternativas */}
              <div className="form-group">
                <label>Alternativas *</label>
                <div className="options-container">
                  {formData.alternativas.map((alt, idx) => {
                    const hasPreview = altImagePreviews[idx];
                    return (
                      <div className="alt-mixed-group" key={alt.letra}>
                        <div className="alt-letter-badge">{alt.letra}</div>
                        <div className="alt-fields">
                          {/* Texto */}
                          <input
                            type="text"
                            className="form-control"
                            placeholder={`Texto de la alternativa ${alt.letra} (opcional)`}
                            value={alt.contenidoTexto}
                            onChange={(e) => handleAlternativaChange(idx, 'contenidoTexto', e.target.value)}
                          />

                          {/* Imagen */}
                          {!hasPreview ? (
                            <div className="alt-image-row">
                              <button
                                type="button"
                                className="btn-upload-sm"
                                onClick={() => altFileRefs.current[idx]?.click()}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>upload</span>
                                Imagen
                              </button>
                              <button
                                type="button"
                                className={`btn-upload-sm ${altUrlModes[idx] ? 'btn-upload-sm-active' : ''}`}
                                onClick={() => toggleAltUrlMode(idx)}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>link</span>
                                URL
                              </button>
                              {altUrlModes[idx] && (
                                <input
                                  type="text"
                                  className="form-control"
                                  placeholder="https://imagen..."
                                  value={alt.imagenUrl}
                                  onChange={(e) => handleAltUrlChange(idx, e.target.value)}
                                  style={{ flex: 1 }}
                                />
                              )}
                            </div>
                          ) : (
                            <div className="alt-image-preview-row">
                              <img
                                src={hasPreview}
                                alt={`Alt ${alt.letra}`}
                                className="alt-mini-preview"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                              <button
                                type="button"
                                className="btn-upload-sm btn-delete-action"
                                onClick={() => handleClearAltImage(idx)}
                              >
                                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>delete</span>
                                Eliminar imagen
                              </button>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            ref={(el) => { altFileRefs.current[idx] = el; }}
                            style={{ display: 'none' }}
                            onChange={(e) => handleAltFileSelect(idx, e)}
                          />

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setIsFormModalOpen(false)} disabled={isSaving}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSaveQuestion} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <span className="material-icons-outlined" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>sync</span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined">save</span>
                    Guardar Pregunta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Detalle de pregunta ── */}
      {selectedQuestion && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Detalle de la Pregunta</h3>
              <button className="btn-icon" onClick={() => setSelectedQuestion(null)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="question-meta" style={{ marginBottom: 12 }}>
                <span style={{ fontSize: '13px', color: '#5f6368', display: 'flex', alignItems: 'center' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>school</span>
                  {selectedQuestion.cursoNombre}
                </span>
              </div>
              <div className="question-text" style={{ marginBottom: 16 }}>
                <ContentRenderer contentStr={normalizeBlocksString(selectedQuestion.enunciado)} />
              </div>
              {/* Solo mostrar imagen legacy si no es formato de bloques */}
              {selectedQuestion.imagenUrl && !isBlockFormat(selectedQuestion.enunciado) && (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <img
                    src={selectedQuestion.imagenUrl}
                    alt="Imagen del enunciado"
                    className="question-image-detail"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}

              <ul className="options-list">
                {selectedQuestion.alternativas.map((opt) => {
                  return (
                    <li key={opt.letra} className="option-item">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span className="option-letter">{opt.letra})</span>
                        <div style={{ flex: 1 }}>
                           {/* Renderizar texto si existe */}
                           {opt.contenidoTexto && (
                             <ContentRenderer contentStr={opt.contenidoTexto} inline={true} />
                           )}
                           {/* Renderizar imagen si existe */}
                           {opt.imagenUrl && !isBlockFormat(opt.contenidoTexto || '') && (
                             <img
                               src={opt.imagenUrl}
                               alt={`Alternativa ${opt.letra}`}
                               className="option-image-detail"
                               onError={(e) => (e.currentTarget.style.display = 'none')}
                             />
                           )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}