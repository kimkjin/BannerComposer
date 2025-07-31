// frontend/src/components/BriefingPanel.jsx

import React, { useRef } from 'react';
import ImageUploader from './ImageUploader';
import SearchableDropdown from './SearchableDropdown';
import { uploadLogos } from '../api/composerApi'; // Importação que você já tinha
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

  // Sua lógica existente, que está correta
  const fileInputRef = useRef(null);

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileSelected = async (event) => {
    const files = event.target.files;
    if (!files.length) {
      return;
    }

    const brandName = window.prompt("Digite o nome da marca para criar a pasta:", "");
    if (!brandName || brandName.trim() === "") {
      alert("Upload cancelado. O nome da marca é obrigatório.");
      return;
    }
    
    try {
      const response = await uploadLogos(brandName.trim(), files);
      alert(response.message);
      
      onFolderSelect(brandName.trim()); 
      
    } catch (error) {
      alert("Ocorreu um erro durante o upload. Verifique o console.");
    }

    event.target.value = null; 
  };

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
        {/* --- MUDANÇA: Adicionado o header para alinhar o título e o botão --- */}
        <div className="panel-section-header">
          <h3>2. Marca e Logo</h3>
          {/* Input de arquivo escondido */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelected}
            multiple 
            accept=".png,.svg"
            style={{ display: 'none' }} 
          />
          {/* Botão de upload que aciona o input */}
          <button className="upload-logo-btn" onClick={handleUploadClick} title="Fazer upload de novos logos">
            <img src="/upload.png" alt="Upload Logo" />
          </button>
        </div>
        
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

      {/* O resto do seu JSX permanece exatamente o mesmo */}
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