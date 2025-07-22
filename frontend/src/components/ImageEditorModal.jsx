// frontend/src/components/ImageEditorModal.jsx

import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Rnd } from 'react-rnd';
import ColorPicker, { useColorPicker } from 'react-best-gradient-color-picker';
import EditorGrid from './EditorGrid'; 
import './ImageEditorModal.css';

const EditorPlaceholder = () => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        backgroundColor: '#f0f0f0'
    }}>
        <p>Carregando Editor...</p>
    </div>
);

function ImageEditorModal({ format, preview, onClose, onSave, globalTaglineState }) {
    const { rules, override } = preview;
    const initialBgType = override?.background?.type || 'image';

    // Estados do editor
    const exceptionFormats = ['SLOT1_NEXT_WEB.jpg', 'SLOT1_NEXT_WEB_PRE.jpg'];
    const [backgroundType, setBackgroundType] = useState(initialBgType);
    const [solidColor, setSolidColor] = useState(override?.background?.color || 'rgba(255,255,255,1)');
    const [isReady, setIsReady] = useState(false);

    // Estados do Cropper
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Estados do Logo
    const [logoPos, setLogoPos] = useState({ x: override?.logo?.x ?? 20, y: override?.logo?.y ?? 20 });
    const [logoWidth, setLogoWidth] = useState(override?.logo?.width || rules?.logo_area?.width || 150);
    const [logoAspectRatio, setLogoAspectRatio] = useState(null);
    const [logoColorFilter, setLogoColorFilter] = useState(override?.logo?.color_filter || 'none');
    
    // Estados locais para a Tagline dentro do editor
    const [isLocalTaglineEnabled, setIsLocalTaglineEnabled] = useState(false);
    const [taglinePos, setTaglinePos] = useState({ x: 0, y: 0 });

    const { setGradient } = useColorPicker(override?.background?.color || 'linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(0,0,0,1) 100%)', setSolidColor);
    const logoHeight = logoAspectRatio ? Math.round(logoWidth / logoAspectRatio) : 0;
    
    useEffect(() => {
        // Inicializa a imagem de fundo
        if (backgroundType === 'image') {
            const img = new Image();
            img.src = preview.originalImageB64;
            img.onload = () => {
                const fitZoom = Math.max(preview.width / img.naturalWidth, preview.height / img.naturalHeight);
                setZoom(override?.image?.zoom || fitZoom);
                setCrop(override?.image?.crop || { x: 0, y: 0 });
                setIsReady(true);
            };
        } else {
            setIsReady(true);
        }

        // Inicializa o aspect ratio do logo
        if (preview.logoData) {
            const logoImg = new Image();
            logoImg.src = preview.logoData;
            logoImg.onload = () => setLogoAspectRatio(logoImg.naturalWidth / logoImg.naturalHeight);
        }
        
        // Inicializa a visibilidade da tagline (usa override local ou o global como fallback)
        const initialVisibility = override?.tagline?.enabled ?? globalTaglineState.enabled;
        setIsLocalTaglineEnabled(initialVisibility);
        
        // Inicializa a posição da tagline (usa a posição salva ou calcula uma nova)
        if (override?.tagline?.x !== undefined && override?.tagline?.y !== undefined) {
            setTaglinePos({ x: override.tagline.x, y: override.tagline.y });
        } else {
            const exceptionFormats = ['SLOT1_NEXT_WEB.jpg', 'SLOT1_NEXT_WEB_PRE.jpg'];
            let defaultX;

            if (exceptionFormats.includes(format)) {
                const estimatedTaglineWidth = 200;
                defaultX = logoPos.x + (logoWidth - estimatedTaglineWidth) / 2;
            } else {
                defaultX = logoPos.x;
            }

            const defaultY = logoPos.y + logoHeight + (globalTaglineState?.offset_y || 5);
            setTaglinePos({ x: defaultX, y: defaultY });
        }
    }, [override, preview, logoPos.x, logoPos.y, logoWidth, logoHeight, globalTaglineState, format]);

    const onCropComplete = useCallback((_, areaPixels) => setCroppedAreaPixels(areaPixels), []);

    const handleSave = () => {
        if (backgroundType === 'image' && !croppedAreaPixels) return;

        const saveData = {
            image: backgroundType === 'image' ? { x: Math.round(croppedAreaPixels.x), y: Math.round(croppedAreaPixels.y), width: Math.round(croppedAreaPixels.width), height: Math.round(croppedAreaPixels.height), crop, zoom } : null,
            background: backgroundType !== 'image' ? { type: backgroundType, color: solidColor } : null,
            logo: { x: Math.round(logoPos.x), y: Math.round(logoPos.y), width: Math.round(logoWidth), height: logoHeight, color_filter: logoColorFilter },

            tagline: isLocalTaglineEnabled ? {
                ...globalTaglineState,
                enabled: true, 
                x: Math.round(taglinePos.x),
                y: Math.round(taglinePos.y),
            } : null,
        };
        onSave(format, saveData);
    };

    const handleColorChange = (color) => {
        if (backgroundType === 'gradient') {
            setGradient(color);
        }
        setSolidColor(color);
    };

    const taglinePreviewStyle = {
        fontFamily: `'${globalTaglineState.font_filename.split('.')[0]}'`,
        fontSize: `${globalTaglineState.font_size}px`,
        color: globalTaglineState.color,
        whiteSpace: 'nowrap',
        padding: '2px 5px',
        pointerEvents: 'none',
        textAlign: exceptionFormats.includes(format) ? 'center' : 'left',
    };

    return (
        <div className="image-editor-overlay" onClick={onClose}>
            <div className="image-editor-content" onClick={e => e.stopPropagation()}>
                <h3>Editando: {format.replace('.jpg', '')}</h3>
                <div className="editor-main-area">
                    <div className="editor-viewport-container">
                        <div className="editor-viewport" style={{ width: `${preview.width}px`, height: `${preview.height}px`, background: backgroundType !== 'image' ? solidColor : '#e0e0e0', position: 'relative', overflow: 'hidden' }}>
                            {isReady && backgroundType === 'image' && <Cropper image={preview.originalImageB64} crop={crop} onCropChange={setCrop} zoom={zoom} onZoomChange={setZoom} aspect={preview.width / preview.height} objectFit="cover" onCropComplete={onCropComplete} />}
                            
                            {isReady && logoAspectRatio && (
                                <Rnd className="logo-rnd" style={{ position: 'absolute', zIndex: 10 }} size={{ width: logoWidth, height: logoHeight }} position={{ x: logoPos.x, y: logoPos.y }} onDragStop={(_, d) => setLogoPos({ x: d.x, y: d.y })} onResizeStop={(_, __, ref, ___, pos) => { setLogoWidth(parseInt(ref.style.width, 10)); setLogoPos(pos); }} bounds="parent" lockAspectRatio={logoAspectRatio}>
                                    <img src={preview.logoData} alt="Logo" className={`logo-image logo-filter-${logoColorFilter}`} />
                                </Rnd>
                            )}

                            {isLocalTaglineEnabled && globalTaglineState.text && (
                                <Rnd
                                    className="tagline-rnd"
                                    position={taglinePos}
                                    onDragStop={(_, d) => setTaglinePos({ x: d.x, y: d.y })}
                                    bounds="parent"
                                    enableResizing={false}
                                    style={{ transform: 'translateX(-50%)' }}
                                >
                                    <div style={taglinePreviewStyle}>{globalTaglineState.text}</div>
                                </Rnd>
                            )}
                            
                            {format.startsWith('BANNER') && <EditorGrid />}
                        </div>
                    </div>
                    <div className="right-panel">
                        <div className="background-controls">
                            <h4>Fundo</h4>
                            <div className="bg-type-selector">
                                <button className={backgroundType === 'image' ? 'active' : ''} onClick={() => setBackgroundType('image')}>Imagem</button>
                                <button className={backgroundType === 'solid' ? 'active' : ''} onClick={() => setBackgroundType('solid')}>Cor</button>
                                <button className={backgroundType === 'gradient' ? 'active' : ''} onClick={() => setBackgroundType('gradient')}>Gradiente</button>
                            </div>
                            {backgroundType !== 'image' && <ColorPicker value={solidColor} onChange={handleColorChange} hidePresets={backgroundType === 'solid'} />}
                        </div>
                        
                        <div className="control-section">
                            <h4>Logo</h4>
                            <div className="control-group">
                                <label>Largura (px):</label>
                                <input type="number" className="size-input" value={Math.round(logoWidth)} onChange={e => setLogoWidth(parseInt(e.target.value, 10) || 0)} disabled={!logoAspectRatio} />
                            </div>
                            <div className="logo-filter-buttons">
                                <button className={logoColorFilter === 'none' ? 'active' : ''} onClick={() => setLogoColorFilter('none')}>Original</button>
                                <button className={logoColorFilter === 'white' ? 'active' : ''} onClick={() => setLogoColorFilter('white')}>Branco</button>
                                <button className={logoColorFilter === 'black' ? 'active' : ''} onClick={() => setLogoColorFilter('black')}>Preto</button>
                            </div>
                        </div>

                        <div className="control-section">
                            <h4>Tagline</h4>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={isLocalTaglineEnabled}
                                    onChange={(e) => setIsLocalTaglineEnabled(e.target.checked)}
                                    disabled={!globalTaglineState.enabled || !globalTaglineState.text}
                                />
                                Exibir Tagline neste formato
                            </label>
                        </div>

                        {backgroundType === 'image' && (
                            <div className="control-section">
                                <h4>Imagem</h4>
                                <div className="control-group"><label>Zoom Imagem:</label><input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} /></div>
                            </div>
                        )}
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

export default ImageEditorModal;