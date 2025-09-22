import React, { useState } from 'react';
import { getPreviews } from './api/composerApi';
import PreviewGrid from './components/PreviewGrid';
import './App.css'; 

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previews, setPreviews] = useState({}); 
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setPreviews({}); 
    setErrorMessage('');
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      setErrorMessage('Por favor, selecione uma imagem primeiro.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setPreviews({});

    try {
      const previewData = await getPreviews(selectedFile);
      setPreviews(previewData);
    } catch (error) {
      console.error("Erro ao gerar pré-visualizações:", error);
      setErrorMessage('Ocorreu um erro ao processar. Verifique o console do navegador para mais detalhes.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Banner Composer</h1>
        <p>Faça o upload de uma imagem para gerar todas as pré-visualizações dos formatos.</p>
      </header>
      
      <main className="composer-main">
        <div className="controls">
          <input type="file" accept="image/jpeg, image/png" onChange={handleFileChange} />
          <button onClick={handleProcess} disabled={isLoading || !selectedFile}>
            {isLoading ? 'Processando...' : 'Gerar Pré-visualizações'}
          </button>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
        </div>

        <PreviewGrid previews={previews} isLoading={isLoading} />
      </main>
    </div>
  );
}

export default App;
