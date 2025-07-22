import React from 'react';
import './CenteringGrid.css';

function CenteringGrid() {
  return (
    <div className="centering-grid-overlay" aria-hidden="true">
      <div className="grid-line-h"></div>
      <div className="grid-line-v"></div>
    </div>
  );
}

export default CenteringGrid;