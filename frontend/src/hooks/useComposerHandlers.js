import { useEffect } from 'react';
import {
    getPreviews,
    getSinglePreview,
    listLogoFolders,
    listLogosInFolder,
    listFonts,
    getEntregaPreview,
    generateAndDownloadZip
} from '../api/composerApi';
import { FORMAT_ORDER, IMAGE_A_ID, IMAGE_B_ID } from '../constants';

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

export function useComposerHandlers(state, setState) {
    const {
        files,
        assignments,
        selectedLogos,
        manualOverrides,
        taglineState,
        lockedSlots,
        previews,
        formatsConfig,
        logos,
        selectedFolder
    } = state;

    const {
        setIsLoading,
        setStatusMessage,
        setPreviews,
        setLogos,
        setEditingFormat,
        setIsEditing,
        setManualOverrides
    } = setState;

    const handleFileSelect = (file, imageId) => setState.setFiles(prev => ({ ...prev, [imageId]: file }));
    const handleAssignmentChange = (formatName, imageId) => setState.setAssignments(prev => ({ ...prev, [formatName]: imageId }));

    const handleAssignAll = (imageId) => {
        if (!files[imageId]) {
            alert(`Por favor, suba a Imagem ${imageId === IMAGE_A_ID ? 'A' : 'B'} primeiro.`);
            return;
        }
        const newAssignments = {};
        FORMAT_ORDER.forEach(name => { newAssignments[name] = imageId; });
        setState.setAssignments(newAssignments);
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
            setState.setSelectedLogos(prev => [...prev, newLogoToAdd]);
        }
    };

    const handleRemoveLogo = (logoToRemove) => {
        setState.setSelectedLogos(prev => prev.filter(l => !(l.filename === logoToRemove.filename && l.folder === logoToRemove.folder)));
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

        const siblingFormat = formatPairs[formatName];
        const newOverrides = { ...manualOverrides, [formatName]: saveData };
        if (siblingFormat) {
            newOverrides[siblingFormat] = saveData;
        }
        setManualOverrides(newOverrides);

        try {
            const regeneratePreview = async (name) => {
                const assignedImageId = assignments[name];
                if (!files[assignedImageId]) return null;
                
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

            const regenerationPromises = [regeneratePreview(formatName)];
            if (siblingFormat) {
                setStatusMessage(`Salvando edições para ${formatName} e ${siblingFormat}...`);
                regenerationPromises.push(regeneratePreview(siblingFormat));
            }

            const results = await Promise.all(regenerationPromises);
            
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

        setIsLoading(true);
        setStatusMessage("Gerando pré-visualizações...");

        const assignmentsForGeneration = {};
        const overridesForGeneration = {};
        const preservedPreviews = {};

        FORMAT_ORDER.forEach(formatName => {
            if (lockedSlots[formatName]) {
                if (previews[formatName]) {
                    preservedPreviews[formatName] = previews[formatName];
                }
            } else {
                assignmentsForGeneration[formatName] = assignments[formatName];
                if (taglineState.enabled && taglineState.text) {
                    overridesForGeneration[formatName] = { 
                        ...manualOverrides[formatName],
                        tagline: { ...taglineState } 
                    };
                } else if (manualOverrides[formatName]) {
                    overridesForGeneration[formatName] = manualOverrides[formatName];
                }
            }
        });

        setPreviews(preservedPreviews);

        try {
            if (Object.keys(assignmentsForGeneration).length > 0) {
                const newPreviewData = await getPreviews(
                    files,
                    assignmentsForGeneration,
                    selectedLogos,
                    overridesForGeneration
                );
                setPreviews(prev => ({ ...prev, ...newPreviewData }));
            }
            
            setStatusMessage("Pré-visualizações geradas com sucesso!");

        } catch (error) {
            setStatusMessage("Erro ao gerar previews.");
            console.error("Falha ao gerar as pré-visualizações:", error);
            setPreviews(prev => ({...prev, ...preservedPreviews}));
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadZip = async () => {
        const campaignId = window.prompt("Por favor, insira o ID da campanha:", "");
        if (!campaignId || campaignId.trim() === "") {
            setStatusMessage("Download cancelado. O ID da campanha é necessário.");
            return;
        }

        setIsLoading(true);
        setStatusMessage("Preparando e compactando arquivos...");

        try {
            const zipBlob = await generateAndDownloadZip(campaignId.trim(), previews);
            const url = window.URL.createObjectURL(new Blob([zipBlob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `images_${campaignId.trim()}.zip`);
            
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            setStatusMessage("Download iniciado com sucesso!");

        } catch (error) {
            console.error("Falha ao gerar o ZIP:", error);
            setStatusMessage("Ocorreu um erro ao gerar o arquivo .zip. Verifique o console.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleToggleLock = (formatName) => {
        setState.setLockedSlots(prev => ({
            ...prev,
            [formatName]: !prev[formatName] 
        }));
    };

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

    return {
        handleFileSelect,
        handleAssignmentChange,
        handleAssignAll,
        handleFolderSearch,
        handleFontSearch,
        handleAddLogo,
        handleRemoveLogo,
        handleStartEditing,
        handleCloseEditor,
        handleSaveEdit,
        handleGeneratePreviews,
        handleDownloadZip,
        handleToggleLock
    };
}
