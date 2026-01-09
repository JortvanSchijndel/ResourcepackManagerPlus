import React, { useState, useEffect, Suspense } from 'react';
import { ModelCard } from './ModelCard';
import { ModelDetailModal } from '../modals/ModelDetailModal';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Canvas } from '@react-three/fiber';
import { MinecraftModel } from './MinecraftModel';
import { OrbitControls } from './OrbitControls';
import * as THREE from 'three';
import { createPortal } from 'react-dom';

export const ModelGrid = ({
                            models,
                            modelPreviews,
                            onEdit,
                            onDownload,
                            onCopyMove,
                            onDelete,
                            onPreviewClick,
                            branch
                          }) => {
  const [selectedModel, setSelectedModel] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const { isAdmin } = useAuth();
  
  // Shared Canvas State
  const [hoveredModel, setHoveredModel] = useState(null);
  const [canvasTarget, setCanvasTarget] = useState(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await api.getTags();
        if (res?.tags) {
          setAllTags(res.tags);
        }
      } catch (e) {
        console.error("Failed to fetch tags", e);
      }
    };
    fetchTags();
  }, []);

  const handleModelClick = (model) => {
    setSelectedModel(model);
    setIsDetailModalOpen(true);
  };

  const handleEditFromDetail = (model) => {
    setIsDetailModalOpen(false);
    onEdit(model);
  };

  // Handle mouse enter/leave for cards to manage the shared canvas
  const handleCardMouseEnter = (modelId, targetElement) => {
    setHoveredModel(modelId);
    setCanvasTarget(targetElement);
  };

  const handleCardMouseLeave = () => {
    setHoveredModel(null);
    setCanvasTarget(null);
  };

  if (models.length === 0) {
    return (
        <div className="bg-card rounded-xl p-6 border border-card transition-colors">
          <div className="text-center py-16 text-muted">
            <div className="text-5xl mb-4">📦</div>
            <div className="text-lg mb-2 text-secondary">No models found</div>
            <div className="text-sm text-tertiary">Upload your first model to get started</div>
          </div>
        </div>
    );
  }

  // Separate models into review and approved
  const reviewModels = models.filter(m => m.status === 'review');
  const approvedModels = models.filter(m => m.status !== 'review');

  // Group models by category (namespace)
  const groupModels = (modelsToGroup) => {
    return modelsToGroup.reduce((acc, model) => {
      const key = model.namespace;
      if (!acc[key]) acc[key] = [];
      acc[key].push(model);
      return acc;
    }, {});
  };

  const groupedApprovedModels = groupModels(approvedModels);

  // Find the currently hovered model data
  const currentHoveredModel = models.find(m => `${m.namespace}-${m.model_identifier}` === hoveredModel);
  const currentHoveredPreview = currentHoveredModel ? modelPreviews[`${currentHoveredModel.namespace}-${currentHoveredModel.model_identifier}`] : null;
  const currentHoveredModelData = currentHoveredPreview?.minecraft_model || currentHoveredPreview?.bbmodel;

  return (
      <>
        {/* Shared Canvas Portal */}
        {canvasTarget && currentHoveredModelData && createPortal(
            <div 
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'auto',
                    zIndex: 10
                }}
            >
                <Canvas camera={{ position: [2, 2, 2], fov: 65 }}>
                    <Suspense fallback={null}>
                        <ambientLight intensity={0.6} />
                        <directionalLight position={[5, 5, 5]} intensity={0.8} />
                        <pointLight position={[-5, -5, -5]} intensity={0.3} />
                        <MinecraftModel 
                            modelData={currentHoveredModelData}
                            bbModelData={currentHoveredPreview?.bbmodel}
                            branch={branch}
                            namespace={currentHoveredModel.namespace}
                            modelIdentifier={currentHoveredModel.model_identifier}
                        />
                        <OrbitControls enableZoom={true} enablePan={true} />
                    </Suspense>
                </Canvas>
            </div>,
            canvasTarget
        )}

        {/* Review Section (Only visible if there are models in review) */}
        {reviewModels.length > 0 && (
          <div className="mb-12 border-b border-border pb-8">
            <div className="text-lg font-bold text-warning mb-6 flex items-center gap-2">
              ⚠️ Models for Review
              <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-medium bg-warning-soft-hover text-warning border border-warning/30">
                {reviewModels.length}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {reviewModels.map((model) => {
                  const modelId = `${model.namespace}-${model.model_identifier}`;
                  const previewData = modelPreviews[modelId];
                  return (
                      <ModelCard
                          key={modelId}
                          model={model}
                          preview={previewData?.bbmodel}
                          minecraft_model={previewData?.minecraft_model}
                          onEdit={() => onEdit(model)}
                          onDownload={() => onDownload(model)}
                          onCopyMove={() => onCopyMove(model)}
                          onDelete={() => onDelete(model)}
                          onPreviewClick={() => onPreviewClick(previewData?.bbmodel)}
                          onModelClick={() => handleModelClick(model)}
                          branch={branch}
                          allTags={allTags}
                          isAdmin={isAdmin}
                          isReview={true}
                          onMouseEnter={(e) => handleCardMouseEnter(modelId, e.currentTarget.querySelector('.model-preview-container'))}
                          onMouseLeave={handleCardMouseLeave}
                          isHovered={hoveredModel === modelId}
                      />
                  );
              })}
            </div>
          </div>
        )}

        {/* Approved Models */}
        {Object.entries(groupedApprovedModels).map(([group, groupModels]) => (
            <div key={group} className="mb-8">
              <div className="text-sm font-semibold text-secondary uppercase tracking-wide mb-4 flex items-center gap-2">
                📁 {group}
                <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-medium bg-secondary text-secondary-foreground border border-default transition-colors">
              {groupModels.length}
            </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {groupModels.map((model) => {
                    const modelId = `${model.namespace}-${model.model_identifier}`;
                    const previewData = modelPreviews[modelId];
                    return (
                        <ModelCard
                            key={modelId}
                            model={model}
                            preview={previewData?.bbmodel}
                            minecraft_model={previewData?.minecraft_model}
                            onEdit={() => onEdit(model)}
                            onDownload={() => onDownload(model)}
                            onCopyMove={() => onCopyMove(model)}
                            onDelete={() => onDelete(model)}
                            onPreviewClick={() => onPreviewClick(previewData?.bbmodel)}
                            onModelClick={() => handleModelClick(model)}
                            branch={branch}
                            allTags={allTags}
                            isAdmin={isAdmin}
                            onMouseEnter={(e) => handleCardMouseEnter(modelId, e.currentTarget.querySelector('.model-preview-container'))}
                            onMouseLeave={handleCardMouseLeave}
                            isHovered={hoveredModel === modelId}
                        />
                    );
                })}
              </div>
            </div>
        ))}

        {/* Detail Modal */}
        {selectedModel && (
            <ModelDetailModal
                model={selectedModel}
                preview={
                  modelPreviews[
                      `${selectedModel.namespace}-${selectedModel.model_identifier}`
                      ]?.bbmodel
                }
                minecraft_model={
                  modelPreviews[
                      `${selectedModel.namespace}-${selectedModel.model_identifier}`
                      ]?.minecraft_model
                }
                isOpen={isDetailModalOpen}
                onClose={() => {
                  setIsDetailModalOpen(false);
                  setSelectedModel(null);
                }}
                branch={branch}
                onEdit={handleEditFromDetail}
                onDownload={onDownload}
                onCopyMove={onCopyMove}
                onDelete={onDelete}
                isAdmin={isAdmin}
            />
        )}

      </>
  );
};