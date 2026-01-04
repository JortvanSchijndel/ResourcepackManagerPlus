import React, { useState, useEffect } from 'react';
import { Button } from '@heroui/react';
import { ModelPreview } from './ModelPreview';

export const ModelCard = ({
                            model,
                            preview,
                            minecraft_model,
                              onDelete,
                              onPreviewClick,
                            onModelClick,
                            branch,
                            allTags,
                            isAdmin,
                            isReview
                          }) => {
  const [tags, setTags] = useState([]);

  useEffect(() => {
    if (model.tags && model.tags.length > 0 && allTags) {
      // Handle both string IDs and object tags in model.tags
      const modelTags = allTags.filter(t => {
        return model.tags.some(mt => {
          const mtId = typeof mt === 'object' ? mt.id : mt;
          return mtId === t.id;
        });
      });
      setTags(modelTags);
    } else {
      setTags([]);
    }
  }, [model.tags, allTags]);

  return (
      <div
          className={`bg-card rounded-lg border overflow-hidden transition-all hover:shadow-lg cursor-pointer ${isReview ? 'border-warning' : 'border-card hover:border-border-hover'}`}
          onClick={onModelClick}
      >
        <ModelPreview 
          bbmodel={preview} 
          minecraft_model={minecraft_model}
          branch={branch}
          namespace={model.namespace}
          modelIdentifier={model.model_identifier}
          onClick={(e) => {
            e.stopPropagation();
            onPreviewClick();
          }} 
        />

        <div className="p-4">
          <div className="flex justify-between items-start mb-1">
            <div className="text-base font-semibold text-foreground">{model.name}</div>
            {isReview && (
              <span className="text-[10px] bg-warning-soft-hover text-warning px-1.5 py-0.5 rounded border border-warning/30">
                Review
              </span>
            )}
          </div>
          <div className="text-xs text-muted mb-1">{model.namespace}:{model.model_identifier}</div>
          <div className="text-[10px] text-tertiary mb-3 flex justify-between">
            <span>v{model.version || 1}</span>
            <span>by {model.author || 'unknown'}</span>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {tags.map(tag => (
                <span 
                  key={tag.id} 
                  className="px-1.5 py-0.5 rounded text-[10px] border"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}33` : 'var(--muted)',
                    borderColor: tag.color || 'var(--border)',
                    color: tag.color || 'var(--primary)'
                  }}
                >
                  {tag.tag || tag.name}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <div onClick={(e) => e.stopPropagation()}>
              <Button onPress={onModelClick} size="sm">View</Button>
            </div>

            {isAdmin && (
              <div onClick={(e) => e.stopPropagation()}>
                <Button onPress={onDelete} className="bg-danger" size="sm">Delete</Button>
              </div>
            )}
          </div>
        </div>
      </div>
  );
};