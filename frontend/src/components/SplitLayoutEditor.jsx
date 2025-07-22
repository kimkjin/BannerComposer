// frontend/src/components/SplitLayoutEditor.jsx

import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Rnd } from 'react-rnd';
import CenteringGrid from './CenteringGrid';
import './SplitLayoutEditor.css';

function SplitLayoutEditor({ format, preview, onClose, onSave }) {
    const { rules, override } = preview;

    const leftPanelWidth = rules.split_width || 300;
    const rightPanelWidth = preview.width - leftPanelWidth;
    const rightPanelHeight = preview.height;

    // Estados para o Cropper (imagem)
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    
    // Estados para o Logo
    const [logoPos, setLogoPos] = useState({ x: override?.logo?.x ?? 20, y: override?.logo?.y ?? 40 });
    const [logoWidth, setLogoWidth] = useState(override?.logo?.width || rules.logo_area?.width || 260);
    const [logoAspectRatio, setLogoAspectRatio] = useState(null);
    const [logoColorFilter, setLogoColorFilter] = useState(override?.logo?.color_filter || 'none');

    useEffect(() => {
        const img = new Image();
        img.src = preview.originalImageB64;
        img.onload = () => {
            const fitZoom = Math.max(rightPanelWidth / img.naturalWidth, rightPanelHeight / img.naturalHeight);
            setZoom(override?.image?.zoom || fitZoom);
            setCrop(override?.image?.crop || { x: 0, y: 0 });
        };
    }, [preview.originalImageB64, rightPanelWidth, rightPanelHeight, override]);

    useEffect(() => {
        setLogoAspectRatio(null);
        if (preview.logoData) {
            const img = new Image();
            img.src = preview.logoData;
            img.onload = () => setLogoAspectRatio(img.naturalWidth / img.naturalHeight);
        }
    }, [preview.logoData]);

    const onCropComplete = useCallback((_, areaPixels) => {
        setCroppedAreaPixels(areaPixels);
    }, []);

    const handleSave = () => {
        if (!croppedAreaPixels) {
            alert('Mova a imagem levemente para registrar a posição antes de salvar.');
            return;
        }
        const saveData = {
            image: {
                x: Math.round(croppedAreaPixels.x),
                y: Math.round(croppedAreaPixels.y),
                width: Math.round(croppedAreaPixels.width),
                height: Math.round(croppedAreaPixels.height),
                crop,
                zoom,
            },
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
            <div className="split-editor-content" onClick={e => e.stopPropagation()}>
                <h3>Editando Layout Especial: {format.replace('.jpg', '')}</h3>
                
                <div className="split-editor-main">
                    <div className="split-editor-left-panel" style={{ width: `${leftPanelWidth}px` }}>
                        <CenteringGrid />
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

                    <div className="split-editor-right-panel" style={{ width: `${rightPanelWidth}px`, height: `${rightPanelHeight}px` }}>
                        <Cropper
                            image={preview.originalImageB64}
                            crop={crop}
                            onCropChange={setCrop}
                            zoom={zoom}
                            onZoomChange={setZoom}
                            aspect={rightPanelWidth / rightPanelHeight}
                            onCropComplete={onCropComplete}
                        />
                    </div>
                </div>

                <div className="split-editor-controls">
                    <div className="control-section">
                        <h4>Logo</h4>
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
                    <div className="control-section">
                        <h4>Imagem</h4>
                        <div className="control-group">
                            <label>Zoom Imagem:</label>
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.01}
                                value={zoom}
                                onChange={e => setZoom(Number(e.target.value))}
                            />
                        </div>
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

export default SplitLayoutEditor;