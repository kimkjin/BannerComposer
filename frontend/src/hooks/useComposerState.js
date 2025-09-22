import { useState, useEffect } from 'react';
import { getFormatsConfig } from '../api/composerApi';
import { FORMAT_ORDER, IMAGE_A_ID, IMAGE_B_ID } from '../constants';

export function useComposerState() {
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
    const [lockedSlots, setLockedSlots] = useState({});
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

    return {
        formatsConfig, setFormatsConfig,
        isLoading, setIsLoading,
        statusMessage, setStatusMessage,
        files, setFiles,
        previews, setPreviews,
        assignments, setAssignments,
        selectedFolder, setSelectedFolder,
        logos, setLogos,
        selectedLogos, setSelectedLogos,
        isEditing, setIsEditing,
        editingFormat, setEditingFormat,
        lockedSlots, setLockedSlots,
        manualOverrides, setManualOverrides,
        taglineState, setTaglineState
    };
}
