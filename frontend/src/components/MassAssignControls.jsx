import React from 'react';
import { IMAGE_A_ID, IMAGE_B_ID } from '../constants';

function MassAssignControls({ onAssignAll, files }) {
  return (
    <div className="mass-assign-controls">
      <span>Atribuir todos os formatos para:</span>
      <button
        className="mass-assign-btn a-btn"
        onClick={() => onAssignAll(IMAGE_A_ID)}
        disabled={!files[IMAGE_A_ID]}
      >
        Imagem A
      </button>
      <button
        className="mass-assign-btn b-btn"
        onClick={() => onAssignAll(IMAGE_B_ID)}
        disabled={!files[IMAGE_B_ID]}
      >
        Imagem B
      </button>
    </div>
  );
}

export default MassAssignControls;
