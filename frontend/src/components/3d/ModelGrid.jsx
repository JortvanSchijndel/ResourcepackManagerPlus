import React, { useState, useEffect } from 'react';
import { ModelCard } from './ModelCard';
import { ModelDetailModal } from '../modals/ModelDetailModal';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Card, Button } from '@heroui/react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';

const ModelCategoryGroup = ({ 
    name, 
    path, 
    node, 
    level, 
    modelPreviews, 
    onEdit, 
    onDownload, 
    onCopyMove, 
    onDelete, 
    onPreviewClick, 
    onModelClick, 
    branch, 
    allTags, 
    isAdmin 
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasModels = node.models.length > 0;
    const hasChildren = Object.keys(node.children).length > 0;

    if (!hasModels && !hasChildren) return null;

    return (
        <div className="mb-4">
            <div 
                className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded select-none"
                style={{ marginLeft: `${level * 16}px` }}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {hasChildren || hasModels ? (
                    isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />
                ) : <div className="w-5" />}
                
                {isExpanded ? <FolderOpen size={20} className="text-yellow-500" /> : <Folder size={20} className="text-yellow-500" />}
                
                <span className="font-semibold text-lg">{name}</span>
                <span className="text-xs text-gray-500 border px-2 py-0.5 rounded-full">
                    {node.totalModels}
                </span>
            </div>

            {isExpanded && (
                <div className="mt-2">
                    {/* Render Models in this category */}
                    {hasModels && (
                        <div 
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-4"
                            style={{ marginLeft: `${(level + 1) * 16}px` }}
                        >
                            {node.models.map((model) => {
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
                                        onModelClick={() => onModelClick(model)}
                                        branch={branch}
                                        allTags={allTags}
                                        isAdmin={isAdmin}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* Render Subcategories */}
                    {Object.keys(node.children).sort().map(childName => (
                        <ModelCategoryGroup
                            key={childName}
                            name={childName}
                            path={node.children[childName].path}
                            node={node.children[childName]}
                            level={level + 1}
                            modelPreviews={modelPreviews}
                            onEdit={onEdit}
                            onDownload={onDownload}
                            onCopyMove={onCopyMove}
                            onDelete={onDelete}
                            onPreviewClick={onPreviewClick}
                            onModelClick={onModelClick}
                            branch={branch}
                            allTags={allTags}
                            isAdmin={isAdmin}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

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

  // Build Tree
  const buildTree = (modelsList) => {
      const root = { models: [], children: {}, totalModels: 0 };
      
      modelsList.forEach(model => {
          const parts = model.namespace.split('/');
          let currentNode = root;
          let currentPath = '';
          
          root.totalModels++;

          parts.forEach((part) => {
              currentPath = currentPath ? `${currentPath}/${part}` : part;
              if (!currentNode.children[part]) {
                  currentNode.children[part] = { 
                      models: [], 
                      children: {}, 
                      path: currentPath,
                      totalModels: 0
                  };
              }
              currentNode = currentNode.children[part];
              currentNode.totalModels++;
          });
          
          currentNode.models.push(model);
      });
      
      return root;
  };

  const tree = buildTree(approvedModels);

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

        {/* Approved Models Tree */}
        {Object.keys(tree.children).sort().map(categoryName => (
            <ModelCategoryGroup
                key={categoryName}
                name={categoryName}
                path={tree.children[categoryName].path}
                node={tree.children[categoryName]}
                level={0}
                modelPreviews={modelPreviews}
                onEdit={onEdit}
                onDownload={onDownload}
                onCopyMove={onCopyMove}
                onDelete={onDelete}
                onPreviewClick={onPreviewClick}
                onModelClick={handleModelClick}
                branch={branch}
                allTags={allTags}
                isAdmin={isAdmin}
            />
        ))}
        
        {/* Models at root level (if any, though usually namespace is required) */}
        {tree.models.length > 0 && (
             <div className="mb-8">
                <div className="text-sm font-semibold uppercase tracking-wide mb-4 flex items-center gap-2">
                    📁 Uncategorized
                    <span className="inline-block px-2.5 py-1 text-xs font-medium border transition-colors">
                        {tree.models.length}
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {tree.models.map((model) => {
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
        )}

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
