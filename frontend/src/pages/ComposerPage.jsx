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
        const newOverrides = { ...manualOverrides, [formatName]: saveData };
        setManualOverrides(newOverrides);
        
        setStatusMessage(`Atualizando ${formatName}...`);
        setIsLoading(true);
        handleCloseEditor();

        try {
            const assignedImageId = assignments[formatName];
            const imageFile = files[assignedImageId];
            const logosInfoForApi = selectedLogos.map(l => ({ folder: l.folder, filename: l.filename }));
            
            // 1. Gera o preview do formato que foi editado
            const imageBlob = await getSinglePreview(formatName, imageFile, logosInfoForApi, saveData);
            const reader = new FileReader();
            reader.readAsDataURL(imageBlob);
            reader.onloadend = () => {
                const base64data = reader.result.split(',')[1];
                
                // Cria um objeto com o estado atualizado dos previews
                const nextPreviewsState = {
                    ...previews,
                    [formatName]: { ...previews[formatName], data: base64data, composition_data: saveData }
                };

                // Atualiza o estado com o preview que acabou de ser editado
                setPreviews(nextPreviewsState);
                
                // 2. Verifica se o formato editado é um componente do ENTREGA
                const entregaDependencies = ['SLOT1_WEB.jpg', 'SHOWROOM_MOBILE.jpg', 'HOME_PRIVATE.jpg'];
                if (entregaDependencies.includes(formatName)) {
                    // Garante que todos os componentes necessários existem antes de prosseguir
                    if (entregaDependencies.every(dep => nextPreviewsState[dep]?.data)) {
                        setStatusMessage("Atualizando o formato de Entrega...");
                        
                        // 3. Pede ao backend para gerar o novo ENTREGA
                        getEntregaPreview(nextPreviewsState).then(entregaBlob => {
                            const entregaReader = new FileReader();
                            entregaReader.readAsDataURL(entregaBlob);
                            entregaReader.onloadend = () => {
                                const entregaBase64 = entregaReader.result.split(',')[1];
                                // 4. Atualiza o estado do preview do ENTREGA
                                setPreviews(prev => ({
                                    ...prev,
                                    'ENTREGA.jpg': { ...prev['ENTREGA.jpg'], data: entregaBase64 }
                                }));
                                setStatusMessage("Pré-visualizações atualizadas!");
                            };
                        }).catch(error => {
                            console.error("Falha ao atualizar o preview de Entrega.", error);
                            setStatusMessage("Pré-visualização atualizada, mas falhou ao gerar 'Entrega'.");
                        });
                    } else {
                         setStatusMessage("Pré-visualização atualizada!");
                    }
                } else {
                    setStatusMessage("Pré-visualização atualizada!");
                }
            };
        } catch (error) {
            console.error(`Erro ao atualizar preview:`, error);
            setStatusMessage("Erro ao atualizar preview.");
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
        alert("Função de Download ainda não implementada.");
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