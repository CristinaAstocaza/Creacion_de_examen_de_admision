import React, { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { listarEscaneres, escanearPagina, extraerPreguntasEscaneadas } from '../../services/escanerService';
import { toast } from '../ui/toast';

interface Dispositivo {
  id: string;
  nombre: string;
  fabricante?: string;
}

/** Pregunta extraída por el backend (mismo formato que la importación por imagen). */
export interface PreguntaEscaneada {
  numero: number;
  enunciado: string;
  alternativas: { letra: string; contenido_texto?: string }[];
  imagen_pagina_url?: string;
  [extra: string]: unknown;
}

const mensajeDe = (err: unknown, porDefecto: string) =>
  err instanceof Error && err.message ? err.message : porDefecto;

interface Props {
  cursoId: number | '';
  /** Recibe las preguntas tal como las devuelve el backend (mismo formato que la importación por imagen). */
  onPreguntasExtraidas: (preguntas: PreguntaEscaneada[]) => void;
  /** Leer las hojas con OCR local (sin IA ni internet). Devuelve true si se procesaron. */
  onExtraerSinIA: (paginas: File[]) => Promise<boolean>;
  /** Hay conexión a internet (la IA la necesita). */
  enLinea: boolean;
}

/**
 * Escanea hojas desde una impresora multifunción / escáner conectado a la PC
 * (o recibe PDFs y fotos ya escaneadas) y extrae sus preguntas con el agente IA o con OCR local (sin internet).
 */
export const EscanerPanel: React.FC<Props> = ({ cursoId, onPreguntasExtraidas, onExtraerSinIA, enLinea }) => {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [dispositivoId, setDispositivoId] = useState<string>('');
  const [buscando, setBuscando] = useState(false);
  const [busquedaHecha, setBusquedaHecha] = useState(false);
  const [dpi, setDpi] = useState<string>('300');
  const [modo, setModo] = useState<string>('gris');
  const [escaneando, setEscaneando] = useState(false);
  const [extrayendo, setExtrayendo] = useState(false);
  const [paginas, setPaginas] = useState<File[]>([]);
  const archivoRef = useRef<HTMLInputElement>(null);

  // Miniaturas de las páginas (se liberan al cambiar la lista).
  const miniaturas = useMemo(
    () => paginas.map(p => (p.type.startsWith('image/') ? URL.createObjectURL(p) : null)),
    [paginas],
  );
  useEffect(() => () => miniaturas.forEach(url => url && URL.revokeObjectURL(url)), [miniaturas]);

  const buscarEscaneres = async () => {
    setBuscando(true);
    try {
      const lista: Dispositivo[] = await listarEscaneres();
      setDispositivos(lista);
      setDispositivoId(lista[0]?.id ?? '');
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo buscar escáneres.'));
      setDispositivos([]);
    } finally {
      setBuscando(false);
      setBusquedaHecha(true);
    }
  };

  const escanear = async () => {
    if (!dispositivoId) return;
    setEscaneando(true);
    try {
      const pagina = await escanearPagina({ dispositivoId, dpi: Number(dpi), modo });
      setPaginas(prev => [...prev, pagina]);
      toast.success('Página escaneada.');
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo escanear la página.'));
    } finally {
      setEscaneando(false);
    }
  };

  const agregarArchivos = (e: ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []).filter(
      f => f.type.startsWith('image/') || f.type === 'application/pdf',
    );
    setPaginas(prev => [...prev, ...archivos]);
    if (archivoRef.current) archivoRef.current.value = '';
  };

  const extraer = async () => {
    if (!cursoId) { toast.error('Selecciona el curso destino arriba.'); return; }
    if (paginas.length === 0) return;
    setExtrayendo(true);
    try {
      const resultado = await extraerPreguntasEscaneadas(paginas, cursoId);
      const preguntas = resultado?.preguntas ?? [];
      if (preguntas.length === 0) {
        toast.error('No se encontraron preguntas en las hojas. Revisa que el escaneo sea legible.');
        return;
      }
      onPreguntasExtraidas(preguntas);
      setPaginas([]);
      toast.success(`Se extrajeron ${preguntas.length} pregunta(s).`);
    } catch (err) {
      toast.error(mensajeDe(err, 'Tu agente IA no pudo leer las hojas escaneadas.'));
    } finally {
      setExtrayendo(false);
    }
  };

  const extraerSinIA = async () => {
    if (!cursoId) { toast.error('Selecciona el curso destino arriba.'); return; }
    if (paginas.length === 0) return;
    if (await onExtraerSinIA(paginas)) setPaginas([]);
  };

  const ocupado = escaneando || extrayendo;

  return (
    <div className="import-card scanner-card">
      <div className="scanner-card-header">
        <div className="card-icon"><span className="material-icons-outlined">print</span></div>
        <div>
          <h3>Escanear desde impresora</h3>
          <p>
            Escanea las hojas o sube PDF/fotos. <strong>Con IA</strong> se leen fórmulas y se recortan los gráficos;
            <strong> sin IA</strong> se lee el texto en esta computadora, sin internet, y los gráficos los recortas tú.
          </p>
        </div>
      </div>

      <div className="scanner-body">
        {/* Paso 1: escáner */}
        <div className="scanner-step">
          <span className="scanner-step-number">1</span>
          <div className="scanner-step-content">
            <label>Escáner conectado</label>
            <div className="scanner-controls">
              <button className="btn btn-secondary" onClick={buscarEscaneres} disabled={buscando || ocupado}>
                {buscando ? 'Buscando…' : busquedaHecha ? 'Volver a buscar' : 'Buscar escáneres'}
              </button>
              {dispositivos.length > 0 && (
                <>
                  <div className="scanner-select scanner-select-wide">
                    <Select value={dispositivoId} onValueChange={setDispositivoId} disabled={ocupado}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un escáner" /></SelectTrigger>
                      <SelectContent>
                        {dispositivos.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="scanner-select">
                    <Select value={dpi} onValueChange={setDpi} disabled={ocupado}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="200">200 ppp (rápido)</SelectItem>
                        <SelectItem value="300">300 ppp (recomendado)</SelectItem>
                        <SelectItem value="400">400 ppp (fórmulas pequeñas)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="scanner-select">
                    <Select value={modo} onValueChange={setModo} disabled={ocupado}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gris">Escala de grises</SelectItem>
                        <SelectItem value="color">Color</SelectItem>
                        <SelectItem value="texto">Blanco y negro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <button className="btn btn-primary" onClick={escanear} disabled={!dispositivoId || ocupado}>
                    {escaneando ? 'Escaneando…' : 'Escanear página'}
                  </button>
                </>
              )}
            </div>
            {busquedaHecha && !buscando && dispositivos.length === 0 && (
              <p className="scanner-hint">
                No se encontró ningún escáner. Revisa que la impresora esté encendida, conectada por USB o a la
                misma red, y que su driver esté instalado en Windows. También puedes subir las hojas ya escaneadas.
              </p>
            )}
          </div>
        </div>

        {/* Paso 1b: archivos ya escaneados */}
        <div className="scanner-step">
          <span className="scanner-step-number">o</span>
          <div className="scanner-step-content">
            <label>Hojas ya escaneadas</label>
            <input
              ref={archivoRef}
              type="file"
              accept="application/pdf,image/*"
              multiple
              onChange={agregarArchivos}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-secondary"
              style={{ borderStyle: 'dashed' }}
              onClick={() => archivoRef.current?.click()}
              disabled={ocupado}
            >
              Subir PDF o fotos de las hojas
            </button>
          </div>
        </div>

        {/* Paso 2: páginas */}
        {paginas.length > 0 && (
          <div className="scanner-pages">
            {paginas.map((pagina, i) => (
              <div key={`${pagina.name}-${i}`} className="scanner-page-thumb" title={pagina.name}>
                {miniaturas[i] ? (
                  <img src={miniaturas[i]!} alt={`Página ${i + 1}`} />
                ) : (
                  <div className="scanner-page-pdf"><span className="material-icons-outlined">picture_as_pdf</span><span>{pagina.name}</span></div>
                )}
                <span className="scanner-page-label">Hoja {i + 1}</span>
                {!ocupado && (
                  <button
                    className="remove-thumb-btn"
                    onClick={() => setPaginas(prev => prev.filter((_, j) => j !== i))}
                    aria-label={`Quitar hoja ${i + 1}`}
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      </div>

      <div className="import-card-footer import-footer-doble">
        <button
          className="btn btn-secondary"
          onClick={extraerSinIA}
          disabled={paginas.length === 0 || !cursoId || ocupado}
          title="Lee el texto de las hojas en esta computadora, sin IA ni internet"
        >
          Sin IA
        </button>
        <button
          className="btn btn-primary"
          onClick={extraer}
          disabled={paginas.length === 0 || !cursoId || ocupado || !enLinea}
          title={enLinea ? 'Tu agente IA lee texto, fórmulas y recorta los gráficos' : 'Sin internet: usa "Sin IA"'}
        >
          {extrayendo
            ? `Leyendo ${paginas.length} hoja(s)…`
            : `Con IA${paginas.length ? ` (${paginas.length} hoja${paginas.length > 1 ? 's' : ''})` : ''}`}
        </button>
      </div>
    </div>
  );
};
