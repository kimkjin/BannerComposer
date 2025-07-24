import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Rnd } from 'react-rnd';
import ColorPicker, { useColorPicker } from 'react-best-gradient-color-picker';
import EditorGrid from './EditorGrid'; 
import './ImageEditorModal.css';

const EditorPlaceholder = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#f0f0f0' }}>
        <p>Carregando Editor...</p>
    </div>
);

function ImageEditorModal({ preview, onClose, onSave, globalTaglineState }) {
    const { 
        name: formatName,
        rules,
        selectedLogos = [],
        logoOverrides = [],
        imageOverride,
        backgroundOverride,
        taglineOverride
    } = preview;

    const exceptionFormats = ['SLOT1_NEXT_WEB.jpg', 'SLOT1_NEXT_WEB_PRE.jpg'];
    
    // Estados de imagem e fundo
    const [backgroundType, setBackgroundType] = useState('image');
    const [solidColor, setSolidColor] = useState('rgba(255,255,255,1)');
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    
    // Estado para gerenciar os múltiplos logos
    const [logoStates, setLogoStates] = useState([]);
    
    // Estados da tagline
    const [isLocalTaglineEnabled, setIsLocalTaglineEnabled] = useState(false);
    const [taglinePos, setTaglinePos] = useState({ x: 0, y: 0 });
    const [localTaglineFontSize, setLocalTaglineFontSize] = useState(globalTaglineState.font_size);

    const { setGradient } = useColorPicker(backgroundOverride?.color || 'linear-gradient(90deg, #fff 0%, #000 100%)', setSolidColor);
    
    // --- CORREÇÃO AQUI: EFEITO DE INICIALIZAÇÃO REFEITO ---
    useEffect(() => {
        setBackgroundType(backgroundOverride?.type || 'image');
        setSolidColor(backgroundOverride?.color || 'rgba(255,255,255,1)');
        setCrop(imageOverride?.crop || { x: 0, y: 0 });
        if (preview.originalImageB64) {
            const img = new Image();
            img.src = preview.originalImageB64;
            img.onload = () => {
                const fitZoom = Math.max(preview.width / img.naturalWidth, preview.height / img.naturalHeight);
                setZoom(imageOverride?.zoom || fitZoom);
            };
        }

        const logoPromises = selectedLogos.map((logo, index) => new Promise(resolve => {
            const override = logoOverrides[index] || {};
            const img = new Image();
            img.onload = () => {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                const defaultY = (rules?.margin?.y ?? 20) + (index * 70);
                resolve({
                    id: `${logo.folder}-${logo.filename}`, data: logo.data, aspectRatio,
                    x: override.x ?? (rules?.margin?.x ?? 20), y: override.y ?? defaultY,
                    width: override.width ?? (rules?.logo_area?.width ?? 150),
                    colorFilter: override.color_filter ?? 'none',
                });
            };
            img.src = logo.data;
        }));

        Promise.all(logoPromises).then(setLogoStates);
        
        setIsLocalTaglineEnabled(taglineOverride?.enabled ?? globalTaglineState.enabled);
        setLocalTaglineFontSize(taglineOverride?.font_size ?? globalTaglineState.font_size);
        if (taglineOverride?.x !== undefined) {
            setTaglinePos({ x: taglineOverride.x, y: taglineOverride.y });
        }
    }, [preview]); 

    useEffect(() => {
        if (logoStates.length === 0 || taglineOverride?.x !== undefined) {
            return; // Não faz nada se não houver logos ou se a posição for manual
        }
        
        // Pega a referência do último logo da lista
        const lastLogo = logoStates[logoStates.length - 1];

        const logoHeight = lastLogo.width / lastLogo.aspectRatio;
        const defaultX = exceptionFormats.includes(formatName) 
            ? lastLogo.x + (lastLogo.width - 200) / 2 // Centralizado para formatos especiais
            : lastLogo.x; // Alinhado à esquerda para os demais
        const defaultY = lastLogo.y + logoHeight + (globalTaglineState?.offset_y || 5);

        setTaglinePos({ x: defaultX, y: defaultY });

    }, [logoStates]); 

    const onCropComplete = useCallback((_, areaPixels) => setCroppedAreaPixels(areaPixels), []);

    const handleSave = () => {
        if (backgroundType === 'image' && !croppedAreaPixels) return;
        
        const finalLogoOverrides = logoStates.map(state => ({
            x: Math.round(state.x), y: Math.round(state.y),
            width: Math.round(state.width), height: Math.round(state.width / state.aspectRatio),
            color_filter: state.colorFilter,
        }));

        const saveData = {
            image: backgroundType === 'image' ? { x: Math.round(croppedAreaPixels?.x || 0), y: Math.round(croppedAreaPixels?.y || 0), width: Math.round(croppedAreaPixels?.width || 0), height: Math.round(croppedAreaPixels?.height || 0), crop, zoom } : null,
            background: backgroundType !== 'image' ? { type: backgroundType, color: solidColor } : null,
            logo: finalLogoOverrides, // AQUI: Envia um array de objetos de logo
            tagline: isLocalTaglineEnabled ? { ...globalTaglineState, enabled: true, x: Math.round(taglinePos.x), y: Math.round(taglinePos.y), font_size: localTaglineFontSize } : null,
        };
        onSave(formatName, saveData);
    };
    
    const handleColorChange = (color) => {
        if (backgroundType === 'gradient') setGradient(color);
        setSolidColor(color);
    };
    
    const handleLogoChange = (index, newProps) => {
        setLogoStates(currentStates => currentStates.map((state, i) => i === index ? { ...state, ...newProps } : state));
    };

    const taglinePreviewStyle = {
        fontFamily: `'${globalTaglineState.font_filename.split('.')[0]}'`,
        fontSize: `${localTaglineFontSize}px`,
        color: globalTaglineState.color,
        whiteSpace: 'nowrap',
        padding: '2px 5px',
        pointerEvents: 'none',
        textAlign: exceptionFormats.includes(formatName) ? 'center' : 'left',
    };

    return (
        <div className="image-editor-overlay" onClick={onClose}>
            <div className="image-editor-content" onClick={e => e.stopPropagation()}>
                <h3>Editando: {formatName.replace('.jpg', '')}</h3>
                <div className="editor-main-area">
                    <div className="editor-viewport-container">
                        <div className="editor-viewport" style={{ width: `${preview.width}px`, height: `${preview.height}px`, background: backgroundType !== 'image' ? solidColor : '#e0e0e0', position: 'relative', overflow: 'hidden' }}>
                            {backgroundType === 'image' && <Cropper image={preview.originalImageB64} crop={crop} onCropChange={setCrop} zoom={zoom} onZoomChange={setZoom} aspect={preview.width / preview.height} objectFit="cover" onCropComplete={onCropComplete} />}
                            
                            {/* --- RENDERIZAÇÃO DE MÚLTIPLOS LOGOS --- */}
                            {logoStates.map((state, index) => (
                                <Rnd
                                    key={state.id}
                                    className="logo-rnd"
                                    style={{ position: 'absolute', zIndex: 10 + index }}
                                    // A altura agora é calculada com a proporção correta
                                    size={{ width: state.width, height: state.aspectRatio ? state.width / state.aspectRatio : state.width }}
                                    position={{ x: state.x, y: state.y }}
                                    onDragStop={(_, d) => handleLogoChange(index, { x: d.x, y: d.y })}
                                    onResizeStop={(_, __, ref, ___, pos) => { handleLogoChange(index, { width: parseInt(ref.style.width, 10), x: pos.x, y: pos.y }); }}
                                    bounds="parent"
                                    lockAspectRatio={state.aspectRatio || 1}
                                >
                                    <img src={state.data} alt="Logo" className={`logo-image logo-filter-${state.colorFilter}`} />
                                </Rnd>
                            ))}

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
                            {formatName.startsWith('BANNER') && <EditorGrid />}
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
                        {logoStates.map((state, index) => (
                            <div className="control-section" key={state.id} style={{ borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '1rem' }}>
                                <h4>Logo {index + 1}</h4>
                                <div className="control-group">
                                    <label>Largura (px):</label>
                                    <input
                                        type="number"
                                        className="size-input"
                                        value={Math.round(state.width)}
                                        onChange={e => handleLogoChange(index, { width: parseInt(e.target.value, 10) || 0 })}
                                        disabled={!state.aspectRatio}
                                    />
                                </div>
                                <div className="logo-filter-buttons">
                                    <button className={state.colorFilter === 'none' ? 'active' : ''} onClick={() => handleLogoChange(index, { colorFilter: 'none' })}>Original</button>
                                    <button className={state.colorFilter === 'white' ? 'active' : ''} onClick={() => handleLogoChange(index, { colorFilter: 'white' })}>Branco</button>
                                    <button className={state.colorFilter === 'black' ? 'active' : ''} onClick={() => handleLogoChange(index, { colorFilter: 'black' })}>Preto</button>
                                </div>
                            </div>
                        ))}
                        
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
                            <div className="control-group">
                                <label>Tamanho (px):</label>
                                <input
                                    type="number"
                                    className="size-input"
                                    value={localTaglineFontSize}
                                    onChange={(e) => setLocalTaglineFontSize(Number(e.target.value))}
                                    disabled={!isLocalTaglineEnabled || !globalTaglineState.text}
                                />
                            </div>
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