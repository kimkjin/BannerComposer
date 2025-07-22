import React from 'react';
import './SlotCard.css';

function SlotCard({ 
  name, 
  imageData, 
  isLoading, 
  assignment, 
  onAssignmentChange, 
  onTestRecognition, 
  onStartEdit // <-- Novo prop para iniciar a edição
}) {
  const displayName = name.replace('.jpg', '').replace(/_/g, ' ');

  const b64Data = imageData?.data;

  const handleTestClick = () => {
    if (!assignment) {
      alert(`Por favor, atribua a imagem A ou B a este formato antes de testar.`);
      return;
    }
    onTestRecognition(name, assignment); 
  };

  // Nova função para acionar o modal de edição no componente pai
  const handleEditClick = () => {
    // Só permite editar se a imagem já foi gerada e um 'assignment' existe
    if (imageData && assignment) {
      onStartEdit(name, assignment);
    } else {
      alert("Atribua e gere a preview antes de editar.");
    }
  };

  return (
    <div className={`slot-card ${assignment ? `assigned-${assignment}` : ''}`}>
      <div className="slot-card-header">
        <h4>{displayName}</h4>
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
      </div>

      <div className="slot-preview-container">
        {/* Adiciona o botão de edição que aparece no hover */}
        {b64Data && !isLoading && (
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

      <button 
        className="slot-test-btn" 
        onClick={handleTestClick}
        disabled={isLoading || !assignment}
        title={!assignment ? "Atribua uma imagem primeiro" : "Testar reconhecimento e layout"}
      >
        Testar Layout
      </button>
    </div>
  );
}

export default SlotCard;