import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from './OrbitControls';
import { MinecraftModel } from './MinecraftModel';

export const ModelPreview = ({ bbmodel, minecraft_model, onClick, branch, namespace, modelIdentifier }) => {
    // Prefer minecraft_model (JSON) if available, otherwise fallback to bbmodel
    const modelData = minecraft_model || bbmodel;

    return (
        <div
            className="w-full h-48 bg-canvas rounded-t-lg overflow-hidden border-b border-card relative group"
            onClick={onClick}
        >
            <Canvas camera={{ position: [2, 2, 2], fov: 65 }}>
                <Suspense fallback={null}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 5, 5]} intensity={0.8} />
                    <pointLight position={[-5, -5, -5]} intensity={0.3} />
                    {modelData ? (
                        <MinecraftModel 
                            modelData={modelData}
                            bbModelData={bbmodel}
                            branch={branch}
                            namespace={namespace}
                            modelIdentifier={modelIdentifier}
                        />
                    ) : (
                        // Fallback placeholder if no model data
                        <mesh>
                            <boxGeometry args={[1, 1, 1]} />
                            <meshStandardMaterial color="#2a2a2a" wireframe />
                        </mesh>
                    )}
                    <OrbitControls enableZoom={true} enablePan={true} />
                </Suspense>
            </Canvas>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
        </div>
    );
};