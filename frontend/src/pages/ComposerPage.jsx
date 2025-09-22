import React from 'react';
import { useComposerState } from '../hooks/useComposerState';
import { useComposerHandlers } from '../hooks/useComposerHandlers';
import BriefingPanel from '../components/BriefingPanel';
import PreviewGrid from '../components/PreviewGrid';
import ImageEditorModal from '../components/ImageEditorModal';
import SplitLayoutEditor from '../components/SplitLayoutEditor';
import BrandLogoEditor from '../components/BrandLogoEditor';
import ActionControls from '../components/ActionControls';
import MassAssignControls from '../components/MassAssignControls';
import { FORMAT_ORDER } from '../constants';
import './ComposerPage.css';

function ComposerPage() {
    const state = useComposerState();
    const handlers = useComposerHandlers(state, {
        setFiles: state.setFiles,
        setAssignments: state.setAssignments,
        setIsLoading: state.setIsLoading,
        setStatusMessage: state.setStatusMessage,
        setPreviews: state.setPreviews,
        setLogos: state.setLogos,
        setEditingFormat: state.setEditingFormat,
        setIsEditing: state.setIsEditing,
        setManualOverrides: state.setManualOverrides,
        setSelectedLogos: state.setSelectedLogos,
        setLockedSlots: state.setLockedSlots
    });

    const canGenerate = state.files.imageA && state.files.imageB && state.selectedLogos.length > 0;

    const renderEditorModal = () => {
        if (!state.isEditing || !state.editingFormat) return null;

        const editorProps = {
            preview: state.editingFormat,
            onClose: handlers.handleCloseEditor,
            onSave: handlers.handleSaveEdit,
            globalTaglineState: state.taglineState,
        };

        const formatName = state.editingFormat.name;
        if (['HOME_PRIVATE.jpg', 'HOME_PRIVATE_PUBLIC.jpg'].includes(formatName)) {
            return <SplitLayoutEditor key={formatName} {...editorProps} />;
        }
        if (formatName === 'BRAND_LOGO.jpg') {
            return <BrandLogoEditor key={formatName} {...editorProps} />;
        }
        return <ImageEditorModal key={formatName} {...editorProps} />;
    };

    return (
        <div className="composer-page">
            <BriefingPanel
                onFileSelect={handlers.handleFileSelect}
                onFolderSearch={handlers.handleFolderSearch}
                onFolderSelect={state.setSelectedFolder}
                logos={state.logos}
                selectedLogos={state.selectedLogos}
                onAddLogo={handlers.handleAddLogo}
                onRemoveLogo={handlers.handleRemoveLogo}
                taglineState={state.taglineState}
                onTaglineStateChange={state.setTaglineState}
                onFontSearch={handlers.handleFontSearch}
            />

            {renderEditorModal()}
            
            <main className="preview-area">
                <div className="preview-header">
                    <h1>Banner Composer</h1>
                    <p>{state.statusMessage}</p>
                </div>

                <ActionControls
                    onGenerate={handlers.handleGeneratePreviews}
                    onDownload={handlers.handleDownloadZip}
                    canGenerate={canGenerate}
                    isLoading={state.isLoading}
                    previews={state.previews}
                />
                
                <MassAssignControls
                    onAssignAll={handlers.handleAssignAll}
                    files={state.files}
                />
                
                <PreviewGrid
                    previews={state.previews}
                    isLoading={state.isLoading}
                    assignments={state.assignments}
                    onAssignmentChange={handlers.handleAssignmentChange}
                    onStartEdit={handlers.handleStartEditing}
                    formatOrder={FORMAT_ORDER}
                    lockedSlots={state.lockedSlots}
                    onToggleLock={handlers.handleToggleLock}
                />
            </main>
        </div>
    );
}

export default ComposerPage;
