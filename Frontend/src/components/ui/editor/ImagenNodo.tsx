import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

/** Imagen dentro del editor con botón para quitarla (antes solo se podía seleccionándola y pulsando Supr). */
export function ImagenNodo({ node, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper className={`er-imagen ${selected ? 'is-seleccionada' : ''}`} data-drag-handle>
      <img src={node.attrs.src as string} alt={(node.attrs.alt as string) || ''} draggable={false} />
      <button
        type="button"
        className="er-imagen-quitar"
        contentEditable={false}
        title="Quitar imagen"
        aria-label="Quitar imagen"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => deleteNode()}
      >
        <span className="material-icons-outlined">delete_outline</span>
        Quitar
      </button>
    </NodeViewWrapper>
  );
}

export default ImagenNodo;
