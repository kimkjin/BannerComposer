import React from 'react';
import './EditorGrid.css';

function EditorGrid() {
  return (
    <div className="editor-grid-overlay" aria-hidden="true">
      <div className="grid-line-horizontal"></div>
      <div className="grid-line-vertical"></div>
    </div>
  );
}

export default EditorGrid;