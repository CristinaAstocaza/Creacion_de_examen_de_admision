import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export interface ContentBlock {
  tipo: 'texto' | 'latex' | 'imagen';
  valor?: string;
  contenido?: string;
  url?: string | null;
}

interface Props {
  contentStr: string | null | undefined;
  className?: string;
  onImageClick?: (url: string) => void;
  onCropClick?: (blockIndex: number) => void;
  inline?: boolean;
}

export const ContentRenderer: React.FC<Props> = ({ contentStr, className, onImageClick, onCropClick, inline = false }) => {
  const blocks = useMemo(() => {
    if (!contentStr) return [];
    try {
      const parsed = JSON.parse(contentStr);
      if (Array.isArray(parsed)) {
        return parsed as ContentBlock[];
      }
    } catch (e) {
      // not a json string, fallback to plain text
    }
    return [{ tipo: 'texto', valor: contentStr }] as ContentBlock[];
  }, [contentStr]);

  if (blocks.length === 0) return null;

  const wrapperStyle: React.CSSProperties = inline 
    ? { display: 'inline', gap: '4px' }
    : { display: 'block', width: '100%' };

  return (
    <div className={`content-renderer ${className || ''}`} style={wrapperStyle}>
      {blocks.map((b, i) => {
        const value = b.valor ?? b.contenido ?? '';

        if (b.tipo === 'texto') {
          return (
            <span key={i} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {value}
            </span>
          );
        }
        if (b.tipo === 'latex') {
          try {
            const hasDisplayMarker = value.includes('$$') || value.includes('\\begin{');
            const isDisplay = !inline && hasDisplayMarker;
            const cleanValor = value.replace(/\$\$/g, '');
            const html = katex.renderToString(cleanValor, { throwOnError: true, displayMode: isDisplay });
            
            return isDisplay ? (
              <div 
                key={i} 
                className="latex-block" 
                dangerouslySetInnerHTML={{ __html: html }} 
                style={{ overflowX: 'auto', padding: '8px 0', textAlign: 'center' }}
              />
            ) : (
              <span 
                key={i} 
                className="latex-inline" 
                dangerouslySetInnerHTML={{ __html: html }} 
                style={{ padding: '0 4px', display: 'inline-block', verticalAlign: 'middle' }}
              />
            );
          } catch (e) {
            console.warn(`[ContentRenderer] Error de sintaxis KaTeX en expresión: ${value}`, e);
            return (
              <span key={i} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {value}
              </span>
            );
          }
        }
        if (b.tipo === 'imagen') {
          if (!b.url) {
             return (
               <div key={i} style={{ padding: 14, border: '2px dashed #60a5fa', borderRadius: 10, color: '#1e3a8a', textAlign: 'center', background: '#eff6ff', display: inline ? 'inline-block' : 'block' }}>
                 <div style={{ fontWeight: 700 }}>🖼️ Figura detectada</div>
                 <div style={{ fontSize: 12, marginTop: 4, color: '#475569' }}>Recorta esta parte desde la imagen original.</div>
                 {onCropClick && (
                   <div style={{ marginTop: 10 }}>
                     <button
                       className="btn-small"
                       onClick={() => onCropClick(i)}
                       style={{ background: '#2563eb', color: '#fff', borderColor: '#2563eb', fontWeight: 700, padding: '7px 12px' }}
                     >
                       ✂️ Recortar figura
                     </button>
                   </div>
                 )}
               </div>
             );
          }
          return (
             <div 
               key={i} 
               className="q-image-container" 
               onClick={() => onImageClick && onImageClick(b.url!)} 
               style={{ 
                 cursor: onImageClick ? 'pointer' : 'default', 
                 margin: inline ? '4px 0' : '8px 0',
                 display: 'flex',
                 justifyContent: 'center'
               }}
             >
               <img src={b.url} alt="Bloque de imagen" style={{ maxWidth: '100%', borderRadius: 8, display: 'block', margin: '0 auto' }} />
             </div>
          );
        }
        return null;
      })}
    </div>
  );
};
