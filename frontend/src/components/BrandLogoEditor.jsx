// frontend/src/components/BrandLogoEditor.jsx

import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import './BrandLogoEditor.css';

function BrandLogoEditor({ format, preview, onClose, onSave }) {
    const { rules, override } = preview;

    // Estados do Logo
    const [logoPos, setLogoPos] = useState({ 
        x: override?.logo?.x ?? (preview.width - (rules.logo_area?.width || 150)) / 2, 
        y: override?.logo?.y ?? (preview.height - (rules.logo_area?.height || 55)) / 2
    });
    const [logoWidth, setLogoWidth] = useState(override?.logo?.width || rules.logo_area?.width || 150);
    const [logoAspectRatio, setLogoAspectRatio] = useState(null);
    const [logoColorFilter, setLogoColorFilter] = useState(override?.logo?.color_filter || 'none');

    useEffect(() => {
        if (preview.logoData) {
            const img = new Image();
            img.src = preview.logoData;
            img.onload = () => setLogoAspectRatio(img.naturalWidth / img.naturalHeight);
        }
    }, [preview.logoData]);

    const handleSave = () => {
        const saveData = {
            image: null,
            background: null,
            logo: {
                x: Math.round(logoPos.x),
                y: Math.round(logoPos.y),
                width: Math.round(logoWidth),
                height: logoAspectRatio ? Math.round(logoWidth / logoAspectRatio) : 0,
                color_filter: logoColorFilter,
            },
            tagline: null, // Garante que nenhuma tagline seja enviada
        };
        onSave(format, saveData);
    };

    const logoHeight = logoAspectRatio ? Math.round(logoWidth / logoAspectRatio) : 0;

    return (
        <div className="image-editor-overlay" onClick={onClose}>
            <div className="brand-logo-editor-content" onClick={e => e.stopPropagation()}>
                <h3>Editando: {format.replace('.jpg', '')}</h3>
                
                <div className="brand-logo-preview-panel" style={{ width: `${preview.width}px`, height: `${preview.height}px` }}>
                    <Rnd
                        className="logo-rnd-split"
                        size={{ width: logoWidth, height: logoHeight }}
                        position={{ x: logoPos.x, y: logoPos.y }}
                        onDragStop={(_, d) => setLogoPos({ x: d.x, y: d.y })}
                        onResizeStop={(_, __, ref, ___, pos) => {
                            setLogoWidth(parseInt(ref.style.width, 10));
                            setLogoPos(pos);
                        }}
                        bounds="parent"
                        lockAspectRatio={logoAspectRatio}
                    >
                        <img
                            src={preview.logoData}
                            alt="Logo"
                            className={`logo-image logo-filter-${logoColorFilter}`}
                        />
                    </Rnd>
                </div>

                <div className="brand-logo-controls">
                    <div className="control-group">
                        <label>Largura Logo (px):</label>
                        <input
                            type="number"
                            className="size-input"
                            value={Math.round(logoWidth)}
                            onChange={e => setLogoWidth(parseInt(e.target.value, 10) || 0)}
                        />
                    </div>
                    <div className="logo-filter-buttons">
                        <button className={logoColorFilter === 'none' ? 'active' : ''} onClick={() => setLogoColorFilter('none')}>Original</button>
                        <button className={logoColorFilter === 'white' ? 'active' : ''} onClick={() => setLogoColorFilter('white')}>Branco</button>
                        <button className={logoColorFilter === 'black' ? 'active' : ''} onClick={() => setLogoColorFilter('black')}>Preto</button>
                    </div>
                </div>

                <div className="editor-actions">
                    <button onClick={onClose} className="btn-cancel">Cancelar</button>
                    <button onClick={handleSave} className="btn-save">Salvar Alterações</button>
                </div>
            </div>
        </div>
    );
}

export default BrandLogoEditor;