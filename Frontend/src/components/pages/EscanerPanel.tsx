import React, { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { listarEscaneres, escanearPagina, extraerPreguntasEscaneadas } from '../../services/escanerService';

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
}

/**
 * Escanea hojas desde una impresora multifunción / escáner conectado a la PC
 * (o recibe PDFs y fotos ya escaneadas) y extrae todas sus preguntas con el agente IA.
 */
export const EscanerPanel: React.FC<Props> = ({ cursoId, onPreguntasExtraidas }) => {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [dispositivoId, setDispositivoId] = useState<string>('');
  const [buscando, setBuscando] = useState(false);
  const [busquedaHecha, setBusquedaHecha] = useState(false);
  const [dpi, setDpi] = useState<string>('300');
  const [modo, setModo] = useState<string>('gris');
  const [escaneando, setEscaneando] = useState(false);
  const [extrayendo, setExtrayendo] = useState(false);
  const [paginas, setPaginas] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  // Miniaturas de las páginas (se liberan al cambiar la lista).
  const miniaturas = useMemo(
    () => paginas.map(p => (p.type.startsWith('image/') ? URL.createObjectURL(p) : null)),
    [paginas],
  );
  useEffect(() => () => miniaturas.forEach(url => url && URL.revokeObjectURL(url)), [miniaturas]);

  const buscarEscaneres = async () => {
    setBuscando(true);
    setError(null);
    try {
      const lista: Dispositivo[] = await listarEscaneres();
      setDispositivos(lista);
      setDispositivoId(lista[0]?.id ?? '');
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo buscar escáneres.'));
      setDispositivos([]);
    } finally {
      setBuscando(false);
      setBusquedaHecha(true);
    }
  };

  const escanear = async () => {
    if (!dispositivoId) return;
    setEscaneando(true);
    setError(null);
    try {
      const pagina = await escanearPagina({ dispositivoId, dpi: Number(dpi), modo });
      setPaginas(prev => [...prev, pagina]);
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo escanear la página.'));
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
    if (!cursoId) { setError('Selecciona el curso destino arriba.'); return; }
    if (paginas.length === 0) return;
    setExtrayendo(true);
    setError(null);
    try {
      const resultado = await extraerPreguntasEscaneadas(paginas, cursoId);
      const preguntas = resultado?.preguntas ?? [];
      if (preguntas.length === 0) {
        setError('No se encontraron preguntas en las hojas. Revisa que el escaneo sea legible.');
        return;
      }
      onPreguntasExtraidas(preguntas);
      setPaginas([]);
    } catch (err) {
      setError(mensajeDe(err, 'Tu agente IA no pudo leer las hojas escaneadas.'));
    } finally {
      setExtrayendo(false);
    }
  };

  const ocupado = escaneando || extrayendo;

  return (
    <div className="import-card scanner-card">
      <div className="scanner-card-header">
        <div className="card-icon">🖨️</div>
        <div>
          <h3>Escanear desde impresora</h3>
          <p>
            Conecta tu impresora multifunción o escáner, escanea las hojas del examen y tu agente IA extraerá
            todas las preguntas, con sus fórmulas y figuras.
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
            {busquedaHecha && !buscando && dispositivos.length === 0 && !error && (
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
                  <div className="scanner-page-pdf">📄<span>{pagina.name}</span></div>
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

        {error && <div className="card-recommendation-warning">⚠️ {error}</div>}
      </div>

      <div className="import-card-footer">
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={extraer}
          disabled={paginas.length === 0 || !cursoId || ocupado}
        >
          {extrayendo
            ? `Tu agente IA está leyendo ${paginas.length} hoja(s)…`
            : `Extraer preguntas${paginas.length ? ` (${paginas.length} hoja${paginas.length > 1 ? 's' : ''})` : ''}`}
        </button>
      </div>
    </div>
  );
};
