import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../config/constants';

export const ModelPreview = ({ bbmodel, minecraft_model, onClick, branch, namespace, modelIdentifier, isHovered }) => {
    // Prefer minecraft_model (JSON) if available, otherwise fallback to bbmodel
    const modelData = minecraft_model || bbmodel;
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            {
                root: null,
                rootMargin: '200px', // Load before it comes into view
                threshold: 0
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, []);

    // Construct thumbnail URL - assuming it's automatically generated on upload
    const thumbnailUrl = branch && namespace && modelIdentifier 
        ? `${API_URL}/thumbnail/${branch}/${namespace}/${modelIdentifier}.png`
        : null;

    return (
        <div
            ref={containerRef}
            className="w-full h-48 bg-canvas rounded-t-lg overflow-hidden border-b border-card relative group"
            onClick={onClick}
        >
            {/* If hovered, the parent ModelGrid will render the canvas in a portal over this element */}
            {/* If not hovered, we show a static preview or placeholder */}
            
            {!isHovered && (
                <div className="w-full h-full flex items-center justify-center bg-card/50">
                    {thumbnailUrl ? (
                        <img 
                            src={thumbnailUrl} 
                            alt={`${namespace}:${modelIdentifier}`}
                            className="w-full h-full object-contain p-2"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                            }}
                        />
                    ) : null}
                    
                    {/* Fallback if image fails or doesn't exist */}
                    <div className="hidden w-full h-full flex items-center justify-center text-muted text-sm" style={{ display: thumbnailUrl ? 'none' : 'flex' }}>
                        {modelData ? (
                            <div className="text-4xl opacity-20">📦</div>
                        ) : (
                            <span className="animate-pulse">Loading...</span>
                        )}
                    </div>
                </div>
            )}

            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
        </div>
    );
};