import axios from 'axios';

// Define a URL base da API. Usa a variável de ambiente VITE_API_URL se estiver disponível.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const apiClient = axios.create({
    baseURL: API_URL,
});

/**
 * Busca uma lista de pastas de logos no servidor.
 * @param {string} query - Termo de busca opcional para filtrar as pastas.
 * @returns {Promise<Array>} Uma lista de nomes de pastas.
 */
export const listLogoFolders = async (query = '') => {
    try {
        const response = await apiClient.get(`/list-logo-folders?query=${encodeURIComponent(query)}`);
        return response.data;
    } catch (error) {
        console.error("API Error: Falha ao buscar pastas de logos", error);
        throw error;
    }
};

/**
 * Busca os logos dentro de uma pasta específica.
 * @param {string} folderName - O nome da pasta a ser pesquisada.
 * @returns {Promise<Array>} Uma lista de objetos, cada um contendo o nome e os dados do logo.
 */
export const listLogosInFolder = async (folderName) => {
    try {
        const response = await apiClient.get(`/list-logos/${encodeURIComponent(folderName)}`);
        return response.data;
    } catch (error) {
        console.error(`API Error: Falha ao buscar logos para a pasta ${folderName}`, error);
        throw error;
    }
};

/**
 * Obtém as configurações e regras de todos os formatos de imagem.
 * @returns {Promise<Object>} O objeto de configuração dos formatos.
 */
export const getFormatsConfig = async () => {
    try {
        const response = await apiClient.get('/get-formats-config');
        return response.data; 
    } catch (error) {
        console.error("API Error: Falha ao buscar configurações de formato", error);
        throw error;
    }
};

/**
 * Envia as imagens e configurações para gerar múltiplas pré-visualizações.
 * @param {Object} files - Contém imageA e imageB.
 * @param {Object} assignments - Mapeia cada formato para 'imageA' ou 'imageB'.
 * @param {Array} selectedLogos - Lista de logos selecionados para a campanha.
 * @param {Object} overrides - Configurações manuais de edição para cada formato.
 * @returns {Promise<Object>} Um objeto com os dados das pré-visualizações geradas.
 */
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

/**
 * Gera uma única pré-visualização para um formato específico, usado após edições manuais
 * @param {string} formatName - O nome do formato 
 * @param {File} imageFile - O arquivo de imagem a ser usado
 * @param {Array} logosInfo - Informações sobre os logos a serem aplicados
 * @param {Object} override - As configurações de edição para este formato
 * @returns {Promise<Blob>} A imagem de pré-visualização gerada como um Blob
 */
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

/**
 * Envia todos os dados da campanha para o backend para processar e gerar um arquivo .zip para download.
 * @param {string} campaignId - Identificador da campanha, usado para nomear o arquivo .zip
 * @param {Object} previews - Objeto contendo os dados base64 de todas as imagens finais
 * @returns {Promise<Blob>} O arquivo .zip como um Blob
 */
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

/**
 * Envia um log de erro do frontend para o servidor para monitoramento
 * @param {Error} error - O objeto de erro capturado no frontend
 */
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

/**
 * Envia uma imagem para teste de reconhecimento de objetos pela IA.
 * @param {File} file - A imagem a ser testada
 * @param {string} formatName - O nome do formato para referência
 * @returns {Promise<Blob>} A imagem com as detecções da IA
 */
export const getRecognitionTest = async (file, formatName) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format_name', formatName); 

    const response = await apiClient.post('/test-recognition', formData, {
        responseType: 'blob',
    });
    
    return response.data;
};

/**
 * Busca a lista de fontes disponíveis no servidor
 * @param {string} query - Termo de busca opcional para filtrar as fontes
 * @returns {Promise<Object>} Um objeto contendo uma lista de nomes de arquivos de fontes
 */
export const listFonts = async (query = '') => {
    try {
        const response = await apiClient.get(`/list-fonts?query=${encodeURIComponent(query)}`);
        return response.data;
    } catch (error) {
        console.error("API Error: Falha ao buscar fontes. Verifique se o backend está no ar e se a pasta de fontes existe.", error);
        return { fonts: [] };
    }
};

/**
 * Gera a imagem de preview do formato 'ENTREGA'
 * @param {Object} previews - O estado atual dos previews, contendo os dados das imagens necessárias
 * @returns {Promise<Blob>} A imagem de 'ENTREGA' como um Blob
 */
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

/**
 * Faz o upload de um ou mais arquivos de logo para uma pasta específica no servidor
 * Se a pasta não existir, ela será criada
 * @param {string} folderName - O nome da marca/pasta onde os logos serão salvos
 * @param {FileList} files - A lista de arquivos de logo a serem enviados
 * @returns {Promise<Object>} Uma resposta de sucesso do servidor
 */
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