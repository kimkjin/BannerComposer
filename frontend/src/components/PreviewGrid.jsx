import React from 'react';
import SlotCard from './SlotCard';
import './PreviewGrid.css';

function PreviewGrid({ previews, isLoading, assignments, onAssignmentChange, onTestRecognition, formatOrder, onStartEdit }) {
  
  if (!formatOrder || formatOrder.length === 0) {
    return <p className="grid-placeholder">Aguardando configuração de formatos...</p>;
  }

  return (
    <div className="preview-grid">
      {formatOrder.map(formatName => {
        const imageData = previews[formatName];
        const assignment = assignments[formatName];

        return (
          <SlotCard
            key={formatName}
            name={formatName}
            imageData={imageData}
            isLoading={isLoading && !imageData}
            assignment={assignment}
            onAssignmentChange={onAssignmentChange}
            onTestRecognition={onTestRecognition}
            onStartEdit={onStartEdit} // <-- E passe a função para o SlotCard
          />
        );
      })}
    </div>
  );
}

export default PreviewGrid;