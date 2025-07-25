// frontend/src/components/SlotCard.jsx

import React from 'react';
import './SlotCard.css';

function SlotCard({ 
  name, 
  imageData, 
  isLoading, 
  assignment, 
  onAssignmentChange, 
  onTestRecognition, 
  onStartEdit
}) {
  const displayName = name.replace('.jpg', '').replace(/_/g, ' ');
  const b64Data = imageData?.data;

  // Identifica o formato especial
  const isSpecialComposite = name === 'ENTREGA.jpg';

  const handleTestClick = () => {
    if (!assignment) return;
    onTestRecognition(name, assignment); 
  };

  const handleEditClick = () => {
    if (imageData && assignment) {
      onStartEdit(name, assignment);
    }
  };

  return (
    <div className={`slot-card ${assignment ? `assigned-${assignment}` : ''} ${isSpecialComposite ? 'special-composite' : ''}`}>
      <div className="slot-card-header">
        <h4>{displayName}</h4>
        
        {/* --- MUDANÇA: Renderiza os botões A/B apenas se NÃO for o formato especial --- */}
        {!isSpecialComposite && (
          <div className="assignment-buttons">
            <button
              onClick={() => onAssignmentChange(name, 'imageA')}
              className={`assign-btn a-btn ${assignment === 'imageA' ? 'active' : ''}`}
              aria-label="Atribuir à Imagem A"
              disabled={isLoading}
            >A</button>
            <button
              onClick={() => onAssignmentChange(name, 'imageB')}
              className={`assign-btn b-btn ${assignment === 'imageB' ? 'active' : ''}`}
              aria-label="Atribuir à Imagem B"
              disabled={isLoading}
            >B</button>
          </div>
        )}
      </div>

      <div className="slot-preview-container">
        {b64Data && !isLoading && !isSpecialComposite && (
          <button className="edit-button" onClick={handleEditClick} title="Editar posicionamento e logo">
            Editar
          </button>
        )}
        
        {isLoading ? (
          <div className="spinner"></div>
        ) : b64Data ? (
          <img src={`data:image/jpeg;base64,${b64Data}`} alt={displayName} />
        ) : (
          <div className="preview-placeholder-text"></div>
        )}
      </div>

      {/* --- MUDANÇA: Renderiza o botão de teste apenas se NÃO for o formato especial --- */}
      {!isSpecialComposite && (
        <button 
          className="slot-test-btn" 
          onClick={handleTestClick}
          disabled={isLoading || !assignment}
          title={!assignment ? "Atribua uma imagem primeiro" : "Testar reconhecimento e layout"}
        >
          Testar Layout
        </button>
      )}
    </div>
  );
}

export default SlotCard;