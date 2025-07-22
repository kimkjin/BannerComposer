// frontend/src/components/BriefingPanel.jsx

import React from 'react';
import ImageUploader from './ImageUploader';
import SearchableDropdown from './SearchableDropdown';
import './BriefingPanel.css'; // Vamos adicionar os novos estilos aqui depois

function BriefingPanel({ 
    onFileSelect,
    onFolderSearch,
    onFolderSelect,
    logos, 
    selectedLogo, 
    onLogoSelect,
    // --- NOVOS PROPS PARA A TAGLINE ---
    taglineState,
    onTaglineStateChange,
    onFontSearch
}) {

  // Função para lidar com mudanças nos inputs da tagline de forma genérica
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
                className={`logo-thumbnail ${selectedLogo === logo.filename ? 'selected' : ''}`}
                onClick={() => onLogoSelect(logo.filename)}
                title={`Selecionar: ${logo.filename}`}
              >
                <img src={logo.data} alt={logo.filename} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- SEÇÃO DA TAGLINE (SUBSTITUINDO O TESTE DE IA) --- */}
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
            <p>A tagline será adicionada abaixo do logo em todos os formatos aplicáveis.</p>
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
                <input 
                  type="number"
                  value={taglineState.font_size}
                  onChange={(e) => handleTaglineChange('font_size', Number(e.target.value))}
                />
                <label>Cor:</label>
                <input 
                  type="color"
                  value={taglineState.color}
                  onChange={(e) => handleTaglineChange('color', e.target.value)}
                />
                <label>Y:</label>
                <input 
                  type="number"
                  title="Deslocamento Vertical (Y)"
                  value={taglineState.offset_y}
                  onChange={(e) => handleTaglineChange('offset_y', Number(e.target.value))}
                />
            </div>
          </div>
        )}
      </div>

    </aside>
  );
}

export default BriefingPanel;