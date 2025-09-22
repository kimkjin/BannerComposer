import React, { useRef, useState, useEffect } from 'react';

function ImageUploader({ title, onFileSelect, imageId }) {
    const [preview, setPreview] = useState(null);
    const inputRef = useRef(null);
    useEffect(() => {
        return () => {
            if (preview) {
                URL.revokeObjectURL(preview);
            }
        };
    }, [preview]);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            // Limpa a URL antiga antes de criar uma nova
            if (preview) {
                URL.revokeObjectURL(preview);
            }
            const newPreviewUrl = URL.createObjectURL(file);
            setPreview(newPreviewUrl);
            onFileSelect(file, imageId);
        }
    };

    const handleClick = () => {
        inputRef.current.click();
    };

    return (
        <div className="image-uploader">
            <input
                type="file"
                ref={inputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept="image/jpeg,image/png,image/webp"
            />
            <button onClick={handleClick} className="select-image-btn">
                {title}
            </button>
            <div className="image-preview-box">
                {preview ? (
                    <img src={preview} alt="Pré-visualização do upload" />
                ) : (
                    <span>PREVISUALIZAÇÃO DE IMAGEM</span>
                )}
            </div>
        </div>
    );
}

export default ImageUploader;