import React, { useState, useEffect } from 'react';
import { ModelCard } from './ModelCard';
import { ModelDetailModal } from '../modals/ModelDetailModal';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '@heroui/react';

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

  if (models.length === 0) {
    return (
        <Card>
          <Card.Content className="text-center py-16">
            <div className="text-5xl mb-4">📦</div>
            <div className="text-lg mb-2">No models found</div>
            <div className="text-sm">Upload your first model to get started</div>
          </Card.Content>
        </Card>
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

  return (
      <>
        {/* Review Section (Only visible if there are models in review) */}
        {reviewModels.length > 0 && (
          <div className="mb-12 border-b pb-8">
            <div className="text-lg font-bold mb-6 flex items-center gap-2">
              ⚠️ Models for Review
              <span className="inline-block px-2.5 py-1 text-xs font-medium border">
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
                      />
                  );
              })}
            </div>
          </div>
        )}

        {/* Approved Models */}
        {Object.entries(groupedApprovedModels).map(([group, groupModels]) => (
            <div key={group} className="mb-8">
              <div className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
                📁 {group}
                <span className="inline-block px-2.5 py-1 text-xs font-medium border transition-colors">
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