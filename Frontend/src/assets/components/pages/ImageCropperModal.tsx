import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './ImageCropperModal.css';

interface ImageCropperModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (blob: Blob) => void;
  title?: string;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ imageUrl, onClose, onSave, title }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Intentar inicializar el crop en el centro si se desea, pero dejaremos libre
  
  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) {
      alert('Debes realizar un recorte primero.');
      return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    setIsProcessing(true);
    canvas.toBlob((blob) => {
      setIsProcessing(false);
      if (blob) {
        onSave(blob);
      } else {
        alert('Error al generar el recorte.');
      }
    }, 'image/png');
  };

  return (
    <div className="cropper-overlay">
      <div className="cropper-modal">
        <div className="cropper-header">
          <h3>{title || 'Recortar Imagen'}</h3>
          <button className="cropper-close-btn" onClick={onClose} disabled={isProcessing}>&times;</button>
        </div>
        
        <div className="cropper-body">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
          >
            <img 
              ref={imgRef}
              src={imageUrl} 
              alt="Recorte" 
              style={{ maxHeight: '60vh', objectFit: 'contain' }}
              crossOrigin="anonymous" 
            />
          </ReactCrop>
        </div>

        <div className="cropper-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isProcessing}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isProcessing || !completedCrop?.width}>
            {isProcessing ? 'Guardando...' : 'Guardar Recorte'}
          </button>
        </div>
      </div>
    </div>
  );
};
