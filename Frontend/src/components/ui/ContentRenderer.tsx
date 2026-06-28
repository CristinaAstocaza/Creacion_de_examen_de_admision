import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export interface ContentBlock {
  tipo: 'texto' | 'latex' | 'imagen';
  valor?: string;
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
        if (b.tipo === 'texto') {
          return (
            <span key={i} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {b.valor}
            </span>
          );
        }
        if (b.tipo === 'latex') {
          try {
            // Un bloque LaTeX es de tipo display (bloque entero centrado) solo si contiene marcadores de display math
            const hasDisplayMarker = b.valor?.includes('$$') || b.valor?.includes('\\begin{');
            const isDisplay = !inline && hasDisplayMarker;
            const cleanValor = b.valor?.replace(/\$\$/g, '') || '';
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
            console.warn(`[ContentRenderer] Error de sintaxis KaTeX en expresión: ${b.valor}`, e);
            return (
              <span key={i} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {b.valor}
              </span>
            );
          }
        }
        if (b.tipo === 'imagen') {
          if (!b.url) {
             return (
               <div key={i} style={{ padding: 12, border: '1px dashed #ccc', borderRadius: 8, color: '#666', textAlign: 'center', background: '#fafafa', display: inline ? 'inline-block' : 'block' }}>
                 🖼 Imagen pendiente de recorte
                 {onCropClick && (
                   <div style={{ marginTop: 8 }}>
                     <button className="btn-small" onClick={() => onCropClick(i)}>
                       ✂️ Recortar Imagen
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
                 justifyContent: 'center' // Centrar la imagen en medio
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
