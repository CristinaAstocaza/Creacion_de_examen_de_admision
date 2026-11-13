import { ReactNodeViewRenderer } from '@tiptap/react';
import ImagenExt from '@tiptap/extension-image';
import { ImagenNodo } from './ImagenNodo';

/** Extensión de imagen del editor: cada imagen muestra un botón "Quitar". */
export const ImagenConBotonQuitar = ImagenExt.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImagenNodo);
  },
}).configure({ inline: false });
