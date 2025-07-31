import React, { useState, useEffect } from 'react';
import {
    getFormatsConfig,
    getPreviews,
    getSinglePreview,
    listLogoFolders,
    listLogosInFolder,
    listFonts,
    getEntregaPreview
} from '../api/composerApi';
import BriefingPanel from '../components/BriefingPanel';
import PreviewGrid from '../components/PreviewGrid';
import ImageEditorModal from '../components/ImageEditorModal';
import SplitLayoutEditor from '../components/SplitLayoutEditor';
import BrandLogoEditor from '../components/BrandLogoEditor';
import { FORMAT_ORDER, IMAGE_A_ID, IMAGE_B_ID } from '../constants';
import './ComposerPage.css';
import {
    generateAndDownloadZip
} from '../api/composerApi';

const formatPairs = {
    'SLOT1_WEB.jpg': 'SLOT1_WEB_PRE.jpg',
    'SLOT1_WEB_PRE.jpg': 'SLOT1_WEB.jpg',
    'SLOT2_WEB.jpg': 'SLOT2_WEB_PRE.jpg',
    'SLOT2_WEB_PRE.jpg': 'SLOT2_WEB.jpg',
    'SLOT1_NEXT_WEB.jpg': 'SLOT1_NEXT_WEB_PRE.jpg',
    'SLOT1_NEXT_WEB_PRE.jpg': 'SLOT1_NEXT_WEB.jpg',
    'SLOT3_WEB.jpg': 'SLOT3_WEB_PRE.jpg',
    'SLOT3_WEB_PRE.jpg': 'SLOT3_WEB.jpg',
    'HOME_PRIVATE.jpg': 'HOME_PRIVATE_PUBLIC.jpg',
    'HOME_PRIVATE_PUBLIC.jpg': 'HOME_PRIVATE.jpg',
};

function ComposerPage() {
    const [formatsConfig, setFormatsConfig] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Aguardando o upload das imagens.");
    const [files, setFiles] = useState({ [IMAGE_A_ID]: null, [IMAGE_B_ID]: null });
    const [previews, setPreviews] = useState({});
    const [assignments, setAssignments] = useState({});
    const [selectedFolder, setSelectedFolder] = useState('');
    const [logos, setLogos] = useState([]);
    const [selectedLogos, setSelectedLogos] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editingFormat, setEditingFormat] = useState(null);
    const [manualOverrides, setManualOverrides] = useState({});
    const [taglineState, setTaglineState] = useState({
        enabled: false, text: '', font_filename: 'Montserrat-Regular.ttf', font_size: 24, color: '#000000', offset_y: 10,
    });

    useEffect(() => {
        const fetchFormatRules = async () => {
            try {
                const config = await getFormatsConfig();
                setFormatsConfig(config);
            } catch (error) {
                console.error("Não foi possível carregar as regras dos formatos do backend.", error);
                setStatusMessage("Erro: Falha ao carregar as regras dos formatos.");
            }
        };
        fetchFormatRules();
    }, []);

    useEffect(() => {
        const initialAssignments = {};
        FORMAT_ORDER.forEach(name => { initialAssignments[name] = IMAGE_A_ID; });
        setAssignments(initialAssignments);
    }, []);

    useEffect(() => {
        if (selectedFolder) {
            const fetchLogos = async () => {
                setIsLoading(true);
                setStatusMessage(`Carregando logos de ${selectedFolder}...`);
                try {
                    const logosData = await listLogosInFolder(selectedFolder);
                    setLogos(logosData.logos);
                    setStatusMessage("Logos carregados. Selecione para adicionar à campanha.");
                } catch (error) {
                    console.error(`Erro ao buscar logos de ${selectedFolder}:`, error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchLogos();
        } else {
            setLogos([]);
        }
    }, [selectedFolder]);

    const handleFileSelect = (file, imageId) => setFiles(prev => ({ ...prev, [imageId]: file }));
    const handleAssignmentChange = (formatName, imageId) => setAssignments(prev => ({ ...prev, [formatName]: imageId }));

    const handleAssignAll = (imageId) => {
        if (!files[imageId]) {
            alert(`Por favor, suba a Imagem ${imageId === IMAGE_A_ID ? 'A' : 'B'} primeiro.`);
            return;
        }
        const newAssignments = {};
        FORMAT_ORDER.forEach(name => { newAssignments[name] = imageId; });
        setAssignments(newAssignments);
    };

    const handleFolderSearch = async (query) => {
        try {
            const data = await listLogoFolders(query);
            return data.folders;
        } catch (error) {
            console.error("Erro na busca de pastas:", error);
            return [];
        }
    };
    
    const handleFontSearch = async (query) => {
        try {
            const data = await listFonts(query);
            return data.fonts;
        } catch (error) {
            console.error("Erro na busca de fontes:", error);
            return [];
        }
    };

    const handleAddLogo = (logoFilename) => {
        const logoDataFromGallery = logos.find(l => l.filename === logoFilename);
        const isAlreadyAdded = selectedLogos.some(
            l => l.filename === logoFilename && l.folder === selectedFolder
        );

        if (logoDataFromGallery && !isAlreadyAdded) {
            const newLogoToAdd = {
                folder: selectedFolder,
                filename: logoDataFromGallery.filename,
                data: logoDataFromGallery.data
            };
            setSelectedLogos(prev => [...prev, newLogoToAdd]);
        }
    };
    
    const handleRemoveLogo = (logoToRemove) => {
        setSelectedLogos(prev => prev.filter(l => !(l.filename === logoToRemove.filename && l.folder === logoToRemove.folder)));
    };
    
    const handleStartEditing = (formatName, assignedImageId) => {
        const previewData = previews[formatName];
        const originalImageFile = files[assignedImageId];
        const formatConfig = formatsConfig.find(f => `${f.name}.jpg` === formatName);
        const existingOverride = manualOverrides[formatName] || {};

        if (previewData && originalImageFile && formatConfig && selectedLogos.length > 0) {
            const reader = new FileReader();
            reader.readAsDataURL(originalImageFile);
            reader.onloadend = () => {
                const base64Image = reader.result;
                setEditingFormat({
                    name: formatName,
                    width: previewData.width,
                    height: previewData.height,
                    originalImageB64: base64Image,
                    selectedLogos: selectedLogos,
                    logoOverrides: existingOverride.logo || [],
                    imageOverride: existingOverride.image || null,
                    rules: formatConfig.rules
                });
                setIsEditing(true);
            };
        } else {
            alert("Gere a pré-visualização primeiro.");
        }
    };

    const handleCloseEditor = () => {
        setIsEditing(false);
        setEditingFormat(null);
    };

    const handleSaveEdit = async (formatName, saveData) => {
        setStatusMessage(`Salvando edições para ${formatName}...`);
        setIsLoading(true);
        handleCloseEditor();

        // 1. Identificar o formato irmão, se existir
        const siblingFormat = formatPairs[formatName];

        // 2. Atualizar o estado de overrides para ambos os formatos
        const newOverrides = { ...manualOverrides, [formatName]: saveData };
        if (siblingFormat) {
            newOverrides[siblingFormat] = saveData; // Espelha a configuração
        }
        setManualOverrides(newOverrides);

        try {
            // Função auxiliar para regenerar um único preview
            const regeneratePreview = async (name) => {
                const assignedImageId = assignments[name];
                if (!files[assignedImageId]) return null; // Pula se não houver imagem atribuída
                
                const imageFile = files[assignedImageId];
                const logosInfoForApi = selectedLogos.map(l => ({ folder: l.folder, filename: l.filename }));
                
                const imageBlob = await getSinglePreview(name, imageFile, logosInfoForApi, saveData);
                
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(imageBlob);
                    reader.onloadend = () => {
                        const base64data = reader.result.split(',')[1];
                        resolve({ name, data: base64data });
                    };
                });
            };

            // 3. Montar uma lista de promessas para regeneração
            const regenerationPromises = [regeneratePreview(formatName)];
            if (siblingFormat) {
                setStatusMessage(`Salvando edições para ${formatName} e ${siblingFormat}...`);
                regenerationPromises.push(regeneratePreview(siblingFormat));
            }

            // 4. Executar todas as regenerações em paralelo
            const results = await Promise.all(regenerationPromises);
            
            // 5. Atualizar o estado dos previews com todos os novos resultados
            const nextPreviewsState = { ...previews };
            results.forEach(result => {
                if (result) {
                    nextPreviewsState[result.name] = { 
                        ...previews[result.name], 
                        data: result.data, 
                        composition_data: saveData 
                    };
                }
            });
            setPreviews(nextPreviewsState);

            // 6. Verificar se precisa atualizar o formato ENTREGA (lógica existente)
            const entregaDependencies = ['SLOT1_WEB.jpg', 'SHOWROOM_MOBILE.jpg', 'HOME_PRIVATE.jpg'];
            if (entregaDependencies.some(dep => dep === formatName || dep === siblingFormat)) {
                if (entregaDependencies.every(dep => nextPreviewsState[dep]?.data)) {
                    setStatusMessage("Atualizando o formato de Entrega...");
                    const entregaBlob = await getEntregaPreview(nextPreviewsState);
                    const entregaReader = new FileReader();
                    entregaReader.readAsDataURL(entregaBlob);
                    entregaReader.onloadend = () => {
                        const entregaBase64 = entregaReader.result.split(',')[1];
                        setPreviews(prev => ({
                            ...prev,
                            'ENTREGA.jpg': { ...prev['ENTREGA.jpg'], data: entregaBase64 }
                        }));
                    };
                }
            }

            setStatusMessage("Pré-visualizações atualizadas com sucesso!");

        } catch (error) {
            console.error(`Erro ao salvar edições e espelhar previews:`, error);
            setStatusMessage("Ocorreu um erro ao salvar as edições.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGeneratePreviews = async () => {
        if (!files.imageA || !files.imageB || selectedLogos.length === 0) {
            alert("Por favor, suba ambas as imagens e selecione pelo menos um logo.");
            return;
        }
        
        const overridesForGeneration = {};
        if (taglineState.enabled && taglineState.text) {
            FORMAT_ORDER.forEach(formatName => {
                overridesForGeneration[formatName] = { tagline: { ...taglineState } };
            });
        }

        setIsLoading(true);
        setStatusMessage("Gerando pré-visualizações...");
        setPreviews({});

        try {
            const previewData = await getPreviews(
                files, 
                assignments, 
                selectedLogos, 
                overridesForGeneration
            );
            setPreviews(previewData);
            setManualOverrides(overridesForGeneration);
            setStatusMessage("Pré-visualizações geradas com sucesso!");
        } catch (error) {
            setStatusMessage("Erro ao gerar previews.");
            console.error("Falha ao gerar as pré-visualizações:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadZip = async () => {
        // 1. Pede o ID da campanha ao usuário
        const campaignId = window.prompt("Por favor, insira o ID da campanha:", "");

        // 2. Verifica se o usuário inseriu um ID ou cancelou
        if (!campaignId || campaignId.trim() === "") {
            setStatusMessage("Download cancelado. O ID da campanha é necessário.");
            return;
        }

        setIsLoading(true);
        setStatusMessage("Preparando e compactando arquivos...");

        try {
            // 3. Chama a API para gerar e receber o blob do ZIP
            const zipBlob = await generateAndDownloadZip(campaignId.trim(), previews);

            // 4. Cria um link temporário para acionar o download no navegador
            const url = window.URL.createObjectURL(new Blob([zipBlob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `images_${campaignId.trim()}.zip`);
            
            // 5. Simula o clique no link e depois o remove
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url); // Limpa a memória

            setStatusMessage("Download iniciado com sucesso!");

        } catch (error) {
            console.error("Falha ao gerar o ZIP:", error);
            setStatusMessage("Ocorreu um erro ao gerar o arquivo .zip. Verifique o console.");
        } finally {
            setIsLoading(false);
        }
    };

    const canGenerate = files.imageA && files.imageB && selectedLogos.length > 0;

    return (
        <div className="composer-page">
            <BriefingPanel
                onFileSelect={handleFileSelect}
                onFolderSearch={handleFolderSearch}
                onFolderSelect={setSelectedFolder}
                logos={logos}
                selectedLogos={selectedLogos}
                onAddLogo={handleAddLogo}
                onRemoveLogo={handleRemoveLogo}
                taglineState={taglineState}
                onTaglineStateChange={setTaglineState}
                onFontSearch={handleFontSearch}
            />

            {/* --- LÓGICA DE SELEÇÃO DE EDITOR RESTAURADA --- */}
            {isEditing && editingFormat && (() => {
                const formatsForSplitLayout = ['HOME_PRIVATE.jpg', 'HOME_PRIVATE_PUBLIC.jpg'];
                
                // Os props são definidos SEM a key
                const editorProps = {
                    preview: editingFormat,
                    onClose: handleCloseEditor,
                    onSave: handleSaveEdit,
                    globalTaglineState: taglineState,
                };

                // A key é passada DIRETAMENTE no componente JSX
                if (formatsForSplitLayout.includes(editingFormat.name)) {
                    return <SplitLayoutEditor key={editingFormat.name} {...editorProps} />;
                } 
                else if (editingFormat.name === 'BRAND_LOGO.jpg') {
                    return <BrandLogoEditor key={editingFormat.name} {...editorProps} />;
                } 
                else {
                    return <ImageEditorModal key={editingFormat.name} {...editorProps} />;
                }
            })()}
            
            <main className="preview-area">
                <div className="preview-header">
                    <h1>Privalia Composer</h1>
                    <p>{statusMessage}</p>
                </div>

                <div className="main-action-controls">
                    <button 
                        className={`action-button process`}
                        onClick={handleGeneratePreviews} 
                        disabled={!canGenerate || isLoading}
                        title={!canGenerate ? "Suba as imagens e selecione ao menos um logo" : "Gerar pré-visualizações"}
                    >
                        {isLoading ? 'Processando...' : 'Gerar Pré-visualizações'}
                    </button>
                    <button 
                        className={`action-button download`}
                        onClick={handleDownloadZip} 
                        disabled={Object.keys(previews).length === 0 || isLoading}
                        title={Object.keys(previews).length === 0 ? "Gere as pré-visualizações primeiro" : "Baixar .zip"}
                    >
                        Baixar .zip
                    </button>
                </div>
                
                <div className="mass-assign-controls">
                    <span>Atribuir todos os formatos para:</span>
                    <button 
                        className="mass-assign-btn a-btn"
                        onClick={() => handleAssignAll(IMAGE_A_ID)}
                        disabled={!files[IMAGE_A_ID]}
                    >
                        Imagem A
                    </button>
                    <button 
                        className="mass-assign-btn b-btn"
                        onClick={() => handleAssignAll(IMAGE_B_ID)}
                        disabled={!files[IMAGE_B_ID]}
                    >
                        Imagem B
                    </button>
                </div>
                
                <PreviewGrid
                    previews={previews}
                    isLoading={isLoading}
                    assignments={assignments}
                    onAssignmentChange={handleAssignmentChange}
                    onStartEdit={handleStartEditing}
                    formatOrder={FORMAT_ORDER}
                />
            </main>
        </div>
    );
}

export default ComposerPage;