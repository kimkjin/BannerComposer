import React, { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import './BrandLogoEditor.css';

function BrandLogoEditor({ preview, onClose, onSave }) {
    const { 
        name: formatName,
        rules, 
        selectedLogos = [], 
        logoOverrides = [] 
    } = preview;

    const [logoStates, setLogoStates] = useState([]);

    useEffect(() => {
        const logoPromises = selectedLogos.map((logo, index) => new Promise(resolve => {
            const override = logoOverrides[index] || {};
            const img = new Image();
            img.onload = () => {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                resolve({
                    id: `${logo.folder}-${logo.filename}`,
                    data: logo.data,
                    aspectRatio: aspectRatio,
                    x: override.x ?? (preview.width - (rules.logo_area?.width || 150)) / 2 + (index * 60), // Posição X inicial para visualização
                    y: override.y ?? (preview.height - (rules.logo_area?.height || 55)) / 2,
                    width: override.width ?? (rules.logo_area?.width || 150),
                    colorFilter: override.color_filter ?? 'none',
                });
            };
            img.src = logo.data;
        }));
        Promise.all(logoPromises).then(setLogoStates);
    }, [preview]);

    const handleLogoChange = (index, newProps) => {
        setLogoStates(currentStates =>
            currentStates.map((state, i) => (i === index ? { ...state, ...newProps } : state))
        );
    };

    const handleSave = () => {
        const finalLogoOverrides = logoStates.map(state => ({
            x: Math.round(state.x),
            y: Math.round(state.y),
            width: Math.round(state.width),
            height: Math.round(state.width / state.aspectRatio),
            color_filter: state.colorFilter,
        }));

        const saveData = {
            image: null,
            background: null,
            logo: finalLogoOverrides, 
            tagline: null,
        };
        onSave(formatName, saveData);
    };

    return (
        <div className="image-editor-overlay" onClick={onClose}>
            <div className="brand-logo-editor-content" onClick={e => e.stopPropagation()}>
                <h3>Editando: {formatName.replace('.jpg', '')}</h3>
                
                <div className="brand-logo-preview-panel" style={{ width: `${preview.width}px`, height: `${preview.height}px` }}>
                    {/* Renderiza um Rnd para cada logo */}
                    {logoStates.map((state, index) => (
                        <Rnd
                            key={state.id}
                            className="logo-rnd-split"
                            size={{ width: state.width, height: state.width / state.aspectRatio }}
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

                <div className="brand-logo-controls">
                    {/* Renderiza controles para cada logo */}
                    {logoStates.map((state, index) => (
                         <div className="control-section" key={state.id} style={{ borderBottom: '1px solid #eee', paddingBottom: '1rem', marginBottom: '1rem' }}>
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

export default BrandLogoEditor;