import React from 'react';
import ReactDOM from 'react-dom/client';
import ComposerPage from './pages/ComposerPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ComposerPage /> {/* <-- Renderiza a página correta */}
  </React.StrictMode>
);