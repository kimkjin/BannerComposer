import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
    baseURL: API_URL,
});

export const listLogoFolders = async (query = '') => {
    try {
        const response = await apiClient.get(`/list-logo-folders?query=${encodeURIComponent(query)}`);
        return response.data;
    } catch (error) {
        console.error("API Error: Falha ao buscar pastas de logos", error);
        throw error;
    }
};

export const listLogosInFolder = async (folderName) => {
    try {
        const response = await apiClient.get(`/list-logos/${encodeURIComponent(folderName)}`);
        return response.data;
    } catch (error) {
        console.error(`API Error: Falha ao buscar logos para a pasta ${folderName}`, error);
        throw error;
    }
};

export const getFormatsConfig = async () => {
    try {
        const response = await apiClient.get('/get-formats-config');
        return response.data; 
    } catch (error) {
        console.error("API Error: Falha ao buscar configurações de formato", error);
        throw error;
    }
};

export const getPreviews = async (files, assignments, selectedLogos, overrides = {}) => {
    const formData = new FormData();
    formData.append('imageA', files.imageA);
    formData.append('imageB', files.imageB);

    const logosForApi = selectedLogos.map(logo => ({ folder: logo.folder, filename: logo.filename }));
    formData.append('selected_logos', JSON.stringify(logosForApi));

    const assignmentsJson = JSON.stringify(assignments);
    const assignmentsBlob = new Blob([assignmentsJson], { type: 'application/json' });
    formData.append('assignments', assignmentsBlob, 'assignments.json');

    const overridesJson = JSON.stringify(overrides);
    const overridesBlob = new Blob([overridesJson], { type: 'application/json' });
    formData.append('overrides', overridesBlob, 'overrides.json');

    const response = await apiClient.post('/generate-previews', formData);
    return response.data.previews;
};

export const getSinglePreview = async (formatName, imageFile, logosInfo, override) => {
    const formData = new FormData();
    
    formData.append('file', imageFile);
    formData.append('format_name', formatName.replace('.jpg', ''));
    formData.append('selected_logos', JSON.stringify(logosInfo));

    const overrideJson = JSON.stringify(override); 
    const overrideBlob = new Blob([overrideJson], { type: 'application/json' });
    formData.append('overrides', overrideBlob, 'overrides.json');
    
    const response = await apiClient.post('/generate-single-preview', formData, {
        responseType: 'blob',
    });

    return response.data;
};

export const processAndDownloadZip = async (files, assignments, selectedFolder, selectedLogo, overrides = {}) => {
    const formData = new FormData();
    formData.append('imageA', files.imageA);
    formData.append('imageB', files.imageB);
    formData.append('selected_folder', selectedFolder);
    formData.append('selected_logo_filename', selectedLogo);

    const assignmentsJson = JSON.stringify(assignments);
    const assignmentsBlob = new Blob([assignmentsJson], { type: 'application/json' });
    formData.append('assignments', assignmentsBlob, 'assignments.json');
    
    const overridesJson = JSON.stringify(overrides);
    const overridesBlob = new Blob([overridesJson], { type: 'application/json' });
    formData.append('overrides', overridesBlob, 'overrides.json');

    const response = await apiClient.post('/compose-and-zip', formData, {
        responseType: 'blob',
    });
    return response.data;
};

export const logErrorToServer = async (error) => {
    try {
        const errorData = {
            name: error.name || 'UnknownError',
            message: error.message || 'No message',
            stack: error.stack || 'No stack trace',
            componentStack: error.componentStack || null, 
        };
        await apiClient.post('/log-client-error', errorData);
    } catch (loggingError) {
        console.error("Falha ao enviar log de erro para o servidor:", loggingError);
    }
};

export const getRecognitionTest = async (file, formatName) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format_name', formatName); 

    const response = await apiClient.post('/test-recognition', formData, {
        responseType: 'blob',
    });
    
    return response.data;
};

export const listFonts = async (query = '') => {
    try {
        const response = await apiClient.get(`/list-fonts?query=${encodeURIComponent(query)}`);
        return response.data;
    } catch (error) {
        console.error("API Error: Falha ao buscar fontes. Verifique se o backend está no ar e se a pasta de fontes existe.", error);
        return { fonts: [] };
    }
};

export const getEntregaPreview = async (previews) => {
    try {
        const payload = {
            'slot1_web_jpg': previews['SLOT1_WEB.jpg'].data,
            'showroom_mobile_jpg': previews['SHOWROOM_MOBILE.jpg'].data,
            'home_private_jpg': previews['HOME_PRIVATE.jpg'].data,
        };
        const response = await apiClient.post('/generate-entrega-preview', payload, {
            responseType: 'blob',
        });
        return response.data;
    } catch (error) {
        console.error("API Error: Falha ao gerar o preview de Entrega", error);
        throw error;
    }
};

export const generateAndDownloadZip = async (campaignId, previews) => {
    const imagesData = Object.entries(previews).reduce((acc, [key, value]) => {
        if (value.data) {
            acc[key] = value.data;
        }
        return acc;
    }, {});

    const payload = {
        campaign_id: campaignId,
        images: imagesData,
    };

    const response = await apiClient.post('/generate-zip', payload, {
        responseType: 'blob',
    });

    return response.data;
};

export const uploadLogos = async (folderName, files) => {
    const formData = new FormData();
    formData.append('folder_name', folderName);

    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    try {
        const response = await apiClient.post('/upload-logos', formData, {
        });
        return response.data;
    } catch (error) {
        console.error("API Error: Falha ao fazer upload dos logos", error);
        throw error;
    }
};