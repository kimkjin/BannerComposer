// frontend/src/components/UploadArea.jsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import './UploadArea.css'; // Crie este arquivo para estilização

function UploadArea({ onFileSelect, title, imageId }) {
  const [preview, setPreview] = useState(null);

  const onDrop = useCallback(acceptedFiles => {
    const file = acceptedFiles[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      onFileSelect(file, imageId);
    }
  }, [onFileSelect, imageId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    multiple: false,
  });

  return (
    <div className="upload-area" {...getRootProps()}>
      <input {...getInputProps()} />
      {preview ? (
        <img src={preview} alt="Pré-visualização" className="upload-preview" />
      ) : (
        <div className="upload-placeholder">
          {isDragActive ? (
            <p>Solte a imagem aqui...</p>
          ) : (
            <p>{title}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadArea;