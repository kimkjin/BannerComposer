import React from 'react';

function ActionControls({ onGenerate, onDownload, canGenerate, isLoading, previews }) {
  return (
    <div className="main-action-controls">
      <button
        className="action-button process"
        onClick={onGenerate}
        disabled={!canGenerate || isLoading}
        title={!canGenerate ? "Suba as imagens e selecione ao menos um logo" : "Gerar pré-visualizações"}
      >
        {isLoading ? 'Processando...' : 'Gerar Pré-visualizações'}
      </button>
      <button
        className="action-button download"
        onClick={onDownload}
        disabled={Object.keys(previews).length === 0 || isLoading}
        title={Object.keys(previews).length === 0 ? "Gere as pré-visualizações primeiro" : "Baixar .zip"}
      >
        Baixar .zip
      </button>
    </div>
  );
}

export default ActionControls;
