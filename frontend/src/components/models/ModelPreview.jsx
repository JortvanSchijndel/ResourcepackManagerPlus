import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../config/constants';

export const ModelPreview = ({onClick, branch, namespace, modelIdentifier }) => {
    // Prefer minecraft_model (JSON) if available, otherwise fallback to bbmodel
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
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
            observer.disconnect();
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
            <div className="w-full h-full flex items-center justify-center bg-card/50">
                {thumbnailUrl && isVisible ? (
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
                <div className="hidden w-full h-full flex items-center justify-center text-muted text-sm" style={{ display: (thumbnailUrl && isVisible) ? 'none' : 'flex' }}>
                    <div className="text-4xl opacity-20">📦</div>
                </div>
            </div>

            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
        </div>
    );
};