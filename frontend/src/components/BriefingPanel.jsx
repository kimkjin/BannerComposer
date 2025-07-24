// frontend/src/components/BriefingPanel.jsx

import React from 'react';
import ImageUploader from './ImageUploader';
import SearchableDropdown from './SearchableDropdown';
import './BriefingPanel.css'; 

function BriefingPanel({ 
    onFileSelect,
    onFolderSearch,
    onFolderSelect,
    logos, 
    selectedLogos, 
    onAddLogo,
    onRemoveLogo,
    taglineState,
    onTaglineStateChange,
    onFontSearch
}) {

  const handleTaglineChange = (field, value) => {
    onTaglineStateChange({ ...taglineState, [field]: value });
  };

  return (
    <aside className="briefing-panel">
      
      <div className="panel-section">
        <h3>1. Imagens da Campanha</h3>
        <ImageUploader
          title="Selecionar Imagem Principal (A)"
          onFileSelect={onFileSelect}
          imageId="imageA"
        />
        <ImageUploader
          title="Selecionar Imagem Secundária (B)"
          onFileSelect={onFileSelect}
          imageId="imageB"
        />
      </div>

      <div className="panel-section">
        <h3>2. Marca e Logo</h3>
        <SearchableDropdown
          onSearch={onFolderSearch}
          onSelect={onFolderSelect}
          placeholder="Digite o nome da marca..."
        />
        
        {logos.length > 0 && (
          <div className="logo-gallery">
            {logos.map(logo => (
              <div 
                key={logo.filename}
                className={`logo-thumbnail ${selectedLogos.some(l => l.filename === logo.filename) ? 'added' : ''}`}
                onClick={() => onAddLogo(logo.filename)}
                title={`Adicionar: ${logo.filename}`}
              >
                <img src={logo.data} alt={logo.filename} />
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedLogos.length > 0 && (
        <div className="panel-section selected-logos-area">
            <h4>Logos da Campanha</h4>
            <div className="selected-logos-list">
                {selectedLogos.map((logo) => (
                    <div key={`${logo.folder}-${logo.filename}`} className="selected-logo-item">
                        <img src={logo.data} alt={logo.filename} />
                        <div className="selected-logo-info">
                            <span className="logo-filename">{logo.filename}</span>
                            <span className="logo-folder">{logo.folder}</span>
                        </div>
                        <button 
                            className="remove-logo-btn" 
                            onClick={() => onRemoveLogo({filename: logo.filename, folder: logo.folder})}
                            title="Remover logo"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </div>
      )}

      <div className="panel-section tagline-section">
        <h3>
          <label className="tagline-main-label">
            <input 
              type="checkbox"
              checked={taglineState.enabled}
              onChange={(e) => handleTaglineChange('enabled', e.target.checked)}
            />
            3. Adicionar Tagline (Opcional)
          </label>
        </h3>
        
        {taglineState.enabled && (
          <div className="tagline-controls-wrapper">
            <p>A tagline será adicionada abaixo do primeiro logo.</p>
            <input 
              type="text"
              className="tagline-input"
              placeholder="Digite o texto da tagline..."
              value={taglineState.text}
              onChange={(e) => handleTaglineChange('text', e.target.value)}
            />
            <SearchableDropdown
              onSearch={onFontSearch}
              onSelect={(font) => handleTaglineChange('font_filename', font)}
              placeholder={taglineState.font_filename || "Buscar fonte..."}
            />
            <div className="inline-controls">
                <label>Tam:</label>
                <input type="number" value={taglineState.font_size} onChange={(e) => handleTaglineChange('font_size', Number(e.target.value))} />
                <label>Cor:</label>
                <input type="color" value={taglineState.color} onChange={(e) => handleTaglineChange('color', e.target.value)} />
                <label>Y:</label>
                <input type="number" title="Deslocamento Vertical (Y)" value={taglineState.offset_y} onChange={(e) => handleTaglineChange('offset_y', Number(e.target.value))} />
            </div>
          </div>
        )}
      </div>

    </aside>
  );
}

export default BriefingPanel;