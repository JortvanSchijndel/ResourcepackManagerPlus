import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, AlertDialog } from '@heroui/react';
import { ModelPreview } from './ModelPreview';

export const ModelCard = ({
                            model,
                            preview,
                            minecraft_model,
                              onDelete,
                            onModelClick,
                            branch,
                            allTags,
                            isAdmin,
                            isReview
                          }) => {
  const [inView, setInView] = useState(false);
  const cardRef = useRef(null);

  const tags = React.useMemo(() => {
    if (model.tags && model.tags.length > 0 && allTags) {
      // Handle both string IDs and object tags in model.tags
      return allTags.filter(t => {
        return model.tags.some(mt => {
          const mtId = typeof mt === 'object' ? mt.id : mt;
          return mtId === t.id;
        });
      });
    }
    return [];
  }, [model.tags, allTags]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      {
        rootMargin: '0px', // Adjust as needed for when to start loading
        threshold: 0.1, // Percentage of the target element which is currently visible
      }
    );

    const currentCardRef = cardRef.current;

    if (currentCardRef) {
      observer.observe(currentCardRef);
    }

    return () => {
      if (currentCardRef) {
        observer.unobserve(currentCardRef);
      }
    };
  }, []);

  return (
      <div
          ref={cardRef}
          className="transition-all hover:shadow-lg cursor-pointer"
          onClick={onModelClick}
      >
        <Card
            variant={isReview ? 'tertiary' : 'default'}
        >
          {inView ? (
            <>
              <Card.Content className="p-0">
                  <ModelPreview 
                    bbmodel={preview} 
                    minecraft_model={minecraft_model}
                    branch={branch}
                    namespace={model.namespace}
                    modelIdentifier={model.model_identifier}
                  />
              </Card.Content>

              <Card.Header>
                <div className="flex justify-between items-start mb-1">
                  <Card.Title>{model.name}</Card.Title>
                  {isReview && (
                    <span className="text-[10px] px-1.5 py-0.5 border">
                      Review
                    </span>
                  )}
                </div>
                <Card.Description>{model.namespace}:{model.model_identifier}</Card.Description>
                <div className="text-[10px] mb-3 flex justify-between">
                  <span>v{model.version || 1}</span>
                  <span>by {model.author || 'unknown'}</span>
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tags.map(tag => (
                      <span 
                        key={tag.id} 
                        className="px-1.5 py-0.5 text-[10px] border"
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
              </Card.Header>
              <Card.Footer>
                <div className="flex gap-2 flex-wrap">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Button onPress={onModelClick} size="sm" className="h-8">View</Button>
                  </div>

                  {isAdmin && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <AlertDialog>
                        <Button variant="danger" size="sm" className="h-8" onPointerDown={(e) => e.stopPropagation()}>Delete</Button>
                        <AlertDialog.Backdrop>
                          <AlertDialog.Container>
                            <AlertDialog.Dialog>
                              <AlertDialog.CloseTrigger />
                              <AlertDialog.Header>
                                <AlertDialog.Icon status="danger" />
                                <AlertDialog.Heading>Delete Model</AlertDialog.Heading>
                              </AlertDialog.Header>
                              <AlertDialog.Body>
                                Are you sure you want to permanently delete this model? This action cannot be undone.
                              </AlertDialog.Body>
                              <AlertDialog.Footer>
                                <Button slot="close" variant="tertiary" size="sm">Cancel</Button>
                                <Button slot="close" variant="danger" size="sm" onPress={onDelete}>Delete</Button>
                              </AlertDialog.Footer>
                            </AlertDialog.Dialog>
                          </AlertDialog.Container>
                        </AlertDialog.Backdrop>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </Card.Footer>
            </>
          ) : (
            <div className="w-full h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <span className="text-gray-500">Loading...</span>
            </div>
          )}
        </Card>
      </div>
  );
};