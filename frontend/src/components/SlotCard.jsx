import React from 'react';
import './SlotCard.css';

function SlotCard({ 
  name, 
  imageData, 
  isLoading, 
  assignment, 
  onAssignmentChange, 
  onStartEdit,
  isLocked,
  onToggleLock
}) {
  const displayName = name.replace('.jpg', '').replace(/_/g, ' ');
  const b64Data = imageData?.data;
  const isSpecialComposite = name === 'ENTREGA.jpg';

  const handleEditClick = () => {
    if (imageData && assignment) {
      onStartEdit(name, assignment);
    }
  };

  return (
    <div className={`slot-card ${assignment ? `assigned-${assignment}` : ''} ${isLocked ? 'is-locked' : ''}`}>
      <div className="slot-card-header">
        <h4>{displayName}</h4>
        
        <div className="assignment-buttons">
          {!isSpecialComposite && (
            <>
              <button
                onClick={() => onAssignmentChange(name, 'imageA')}
                className={`assign-btn a-btn ${assignment === 'imageA' ? 'active' : ''}`}
                aria-label="Atribuir à Imagem A"
                disabled={isLoading || isLocked}
              >A</button>
              <button
                onClick={() => onAssignmentChange(name, 'imageB')}
                className={`assign-btn b-btn ${assignment === 'imageB' ? 'active' : ''}`}
                aria-label="Atribuir à Imagem B"
                disabled={isLoading || isLocked}
              >B</button>
            </>
          )}

          {b64Data && !isSpecialComposite && (
             <button 
                onClick={() => onToggleLock(name)}
                className={`lock-btn ${isLocked ? 'locked' : ''}`}
                title={isLocked ? "Destravar edição" : "Travar edição"}
                disabled={isLoading}
             >
                {/* + ALTERE A LINHA ABAIXO */}
                <img src={isLocked ? 'src/assets/lock.svg' : 'src/assets/unlock.svg'} alt="Lock Status" />
             </button>
          )}
        </div>
      </div>

      <div className="slot-preview-container">
        {b64Data && !isLoading && !isSpecialComposite && (
          <button 
            className="edit-button" 
            onClick={handleEditClick} 
            title="Editar posicionamento e logo"
            disabled={isLocked}
          >
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

      {!isSpecialComposite && (
        <button 
          className="slot-test-btn" 
          onClick={() => { /* sua função de teste aqui */ }}
          disabled={isLoading || !assignment || isLocked}
          title={!assignment ? "Atribua uma imagem primeiro" : isLocked ? "Slot travado" : "Testar reconhecimento e layout"}
        >
          Testar Layout
        </button>
      )}
    </div>
  );
}

export default SlotCard;