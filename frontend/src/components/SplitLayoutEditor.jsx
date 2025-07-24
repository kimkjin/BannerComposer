import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Rnd } from 'react-rnd';
import CenteringGrid from './CenteringGrid';
import './SplitLayoutEditor.css';

function SplitLayoutEditor({ preview, onClose, onSave }) {
    const { 
        name: formatName,
        rules, 
        selectedLogos = [], 
        logoOverrides = [],
        imageOverride
    } = preview;

    const leftPanelWidth = rules.split_width || 300;
    const rightPanelWidth = preview.width - leftPanelWidth;
    const rightPanelHeight = preview.height;

    const [crop, setCrop] = useState(imageOverride?.crop || { x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [logoStates, setLogoStates] = useState([]);

    useEffect(() => {
        const img = new Image();
        img.src = preview.originalImageB64;
        img.onload = () => {
            const fitZoom = Math.max(rightPanelWidth / img.naturalWidth, rightPanelHeight / img.naturalHeight);
            setZoom(imageOverride?.zoom || fitZoom);
        };

        // --- CORREÇÃO: Carrega imagens dos logos de forma assíncrona para obter as dimensões corretas ---
        const logoPromises = selectedLogos.map((logo, index) => new Promise(resolve => {
            const override = logoOverrides[index] || {};
            const logoImg = new Image();
            
            logoImg.onload = () => {
                const aspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
                const defaultY = (rules.margin?.y ?? 40) + (index * 80);

                resolve({
                    id: `${logo.folder}-${logo.filename}`,
                    data: logo.data,
                    aspectRatio: aspectRatio,
                    x: override.x ?? (rules.margin?.x ?? 20),
                    y: override.y ?? defaultY,
                    width: override.width ?? (rules.logo_area?.width ?? 260),
                    colorFilter: override.color_filter ?? 'none',
                });
            };
            
            logoImg.onerror = () => { // Fallback para o caso de erro no carregamento da imagem
                resolve({ id: `${logo.folder}-${logo.filename}`, data: logo.data, aspectRatio: 1 });
            };

            logoImg.src = logo.data;
        }));

        Promise.all(logoPromises).then(initialStates => {
            setLogoStates(initialStates);
        });

    }, [preview]); // A dependência de 'preview' é suficiente

    const onCropComplete = useCallback((_, areaPixels) => {
        setCroppedAreaPixels(areaPixels);
    }, []);

    const handleLogoChange = (index, newProps) => {
        setLogoStates(currentStates =>
            currentStates.map((state, i) => (i === index ? { ...state, ...newProps } : state))
        );
    };

    const handleSave = () => {
        // (Esta função está correta e não precisa de alterações)
        if (!croppedAreaPixels) { alert('Mova a imagem para registrar a posição.'); return; }
        const finalLogoOverrides = logoStates.map(state => ({
            x: Math.round(state.x), y: Math.round(state.y),
            width: Math.round(state.width),
            height: state.aspectRatio ? Math.round(state.width / state.aspectRatio) : 0,
            color_filter: state.colorFilter,
        }));
        const saveData = {
            image: { x: Math.round(croppedAreaPixels.x), y: Math.round(croppedAreaPixels.y), width: Math.round(croppedAreaPixels.width), height: Math.round(croppedAreaPixels.height), crop, zoom, },
            logo: finalLogoOverrides,
            tagline: null,
        };
        onSave(formatName, saveData);
    };

    return (
        <div className="image-editor-overlay" onClick={onClose}>
            <div className="split-editor-content" onClick={e => e.stopPropagation()}>
                <h3>Editando Layout Especial: {formatName.replace('.jpg', '')}</h3>
                
                <div className="split-editor-main">
                    <div className="split-editor-left-panel" style={{ width: `${leftPanelWidth}px` }}>
                        <CenteringGrid />
                        {/* Renderiza um Rnd para cada logo */}
                        {logoStates.map((state, index) => (
                             <Rnd
                                key={state.id}
                                className="logo-rnd-split"
                                size={{ width: state.width, height: state.aspectRatio ? state.width / state.aspectRatio : 0 }}
                                position={{ x: state.x, y: state.y }}
                                onDragStop={(_, d) => handleLogoChange(index, { x: d.x, y: d.y })}
                                onResizeStop={(_, __, ref, ___, pos) => {
                                    handleLogoChange(index, { width: parseInt(ref.style.width, 10), x: pos.x, y: pos.y });
                                }}
                                bounds="parent"
                                lockAspectRatio={state.aspectRatio}
                            >
                                <img
                                    src={state.data}
                                    alt="Logo"
                                    className={`logo-image logo-filter-${state.colorFilter}`}
                                />
                            </Rnd>
                        ))}
                    </div>

                    <div className="split-editor-right-panel" style={{ width: `${rightPanelWidth}px`, height: `${rightPanelHeight}px` }}>
                        <Cropper
                            image={preview.originalImageB64}
                            crop={crop} onCropChange={setCrop}
                            zoom={zoom} onZoomChange={setZoom}
                            aspect={rightPanelWidth / rightPanelHeight}
                            onCropComplete={onCropComplete}
                        />
                    </div>
                </div>

                <div className="split-editor-controls">
                    <div className="control-section">
                        <h4>Imagem</h4>
                        <div className="control-group">
                            <label>Zoom Imagem:</label>
                            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
                        </div>
                    </div>
                    {/* Renderiza controles para cada logo */}
                    {logoStates.map((state, index) => (
                        <div className="control-section" key={state.id}>
                            <h4>Logo {index + 1}</h4>
                            <div className="control-group">
                                <label>Largura (px):</label>
                                <input
                                    type="number"
                                    className="size-input"
                                    value={Math.round(state.width)}
                                    onChange={e => handleLogoChange(index, { width: parseInt(e.target.value, 10) || 0 })}
                                />
                            </div>
                            <div className="logo-filter-buttons">
                                <button className={state.colorFilter === 'none' ? 'active' : ''} onClick={() => handleLogoChange(index, { colorFilter: 'none' })}>Original</button>
                                <button className={state.colorFilter === 'white' ? 'active' : ''} onClick={() => handleLogoChange(index, { colorFilter: 'white' })}>Branco</button>
                                <button className={state.colorFilter === 'black' ? 'active' : ''} onClick={() => handleLogoChange(index, { colorFilter: 'black' })}>Preto</button>
                            </div>
                        </div>
                    ))}
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