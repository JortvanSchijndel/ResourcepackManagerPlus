import React, { useState, useEffect, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "../models/OrbitControls";
import { Modal, Button, Input } from "@heroui/react";
import { MinecraftModel } from "../models/MinecraftModel";
import { api } from '../../services/api';

export const ModelDetailModal = ({
                                     model,
                                     preview,
                                     minecraft_model,
                                     isOpen,
                                     onClose,
                                     branch,
                                     onEdit,
                                     onDownload,
                                     onCopyMove,
                                     onDelete,
                                     isAdmin
                                 }) => {
    const [modelData, setModelData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [allTags, setAllTags] = useState([]);
    const [commentText, setCommentText] = useState("");
    const [submittingComment, setSubmittingComment] = useState(false);
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

    const fetchModelData = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await api.getModelDetail(branch, model.namespace, model.model_identifier);
            setModelData(data);
        } catch (err) {
            console.error("Model fetch failed:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!model || !isOpen || !branch) return;
        fetchModelData();
    }, [model, isOpen, branch]);

    if (!model) return null;

    const InfoRow = ({ label, value }) => (
        <div className="flex flex-col sm:flex-row gap-2 py-3 border-b border-card">
            <div className="text-sm font-semibold text-secondary min-w-35">
                {label}
            </div>
            <div className="text-sm text-foreground flex-1 break-all">
                {value || "N/A"}
            </div>
        </div>
    );

    const handleDownload = async () => {
        if (onDownload) {
            onDownload(model);
            return;
        }
        api.downloadBBModel(branch, model.namespace, model.model_identifier);
    };

    const handleApprove = async () => {
        try {
            await api.approveModel(branch, model.namespace, model.model_identifier);
            // Refresh data
            fetchModelData();
            // Also refresh parent list if possible, but for now just close or update local state
            onClose(); // Close to force refresh of grid
        } catch (e) {
            alert("Failed to approve: " + e.message);
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        setSubmittingComment(true);
        try {
            await api.addComment(branch, model.namespace, model.model_identifier, commentText);
            setCommentText("");
            fetchModelData(); // Refresh to see new comment
        } catch (e) {
            alert("Failed to add comment: " + e.message);
        } finally {
            setSubmittingComment(false);
        }
    };

    // Use minecraft_model from props (grid preview) or fetched data
    // Prioritize fetched data as it might be more complete
    const displayModel = modelData?.minecraft_model || minecraft_model || modelData?.bbmodel || preview;

    // Extract textures from model data
    useMemo(() => {
        if (!displayModel?.textures) return [];
        return Object.entries(displayModel.textures).map(([key, value]) => ({
            key,
            path: value
        }));
    }, [displayModel]);
// Check for animation (mcmeta files or animated textures in bbmodel)
    useMemo(() => {
        if (modelData?.bbmodel?.textures) {
            return modelData.bbmodel.textures.some(t => t.frame_time > 1 || (t.frame_count && t.frame_count > 1));
        }
        return false; // Hard to tell from just JSON without checking files
    }, [modelData]);
// Resolve tags
    const modelTags = useMemo(() => {
        const tagIds = modelData?.metadata?.tags || model.tags || [];
        if (!tagIds.length) return [];

        // Handle both ID strings and full tag objects if they come that way
        return tagIds.map(tagId => {
            if (typeof tagId === 'object') return tagId;
            return allTags.find(t => t.id === tagId) || { tag: tagId, color: '#888' };
        });
    }, [modelData, model, allTags]);

    const isReview = modelData?.metadata?.status === 'review';
    const comments = modelData?.metadata?.comments || [];
    const displayName = modelData?.name || model.name;

    return (
        <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="bg-background border border-card max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col md:flex-row">
                        <Modal.CloseTrigger className="absolute top-4 right-4 z-10" />

                        {/* Left Column: Preview & Info */}
                        <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-card overflow-y-auto">
                            <Modal.Header className="p-0 mb-6">
                                <div className="flex justify-between items-start">
                                    <Modal.Heading className="text-xl font-bold text-foreground">
                                        {displayName}
                                    </Modal.Heading>
                                    {isReview && (
                                        <span className="bg-warning-soft-hover text-warning px-2 py-1 rounded text-xs border border-warning/30 font-bold">
                                            IN REVIEW
                                        </span>
                                    )}
                                </div>
                            </Modal.Header>

                            {loading && (
                                <div className="text-center py-8 text-muted">
                                    <div className="text-2xl mb-2">⏳</div>
                                    <div>Loading model data...</div>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                                    <div className="text-red-500 font-semibold mb-1">
                                        Error
                                    </div>
                                    <div className="text-sm text-red-400">{error}</div>
                                </div>
                            )}

                            {!loading && !error && (
                                <>
                                    {/* 3D Preview */}
                                    <div className="mb-6">
                                        <div className="w-full h-75 bg-canvas rounded-lg overflow-hidden border border-card relative">
                                            <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
                                                <Suspense fallback={null}>
                                                    <ambientLight intensity={0.6} />
                                                    <directionalLight
                                                        position={[5, 5, 5]}
                                                        intensity={0.8}
                                                    />
                                                    <pointLight
                                                        position={[-5, -5, -5]}
                                                        intensity={0.3}
                                                    />
                                                    {displayModel ? (
                                                        <MinecraftModel 
                                                            modelData={displayModel} 
                                                            bbModelData={modelData?.bbmodel}
                                                            branch={branch}
                                                            namespace={model.namespace}
                                                            modelIdentifier={model.model_identifier}
                                                        />
                                                    ) : (
                                                        <mesh>
                                                            <boxGeometry args={[1, 1, 1]} />
                                                            <meshStandardMaterial color="#2a2a2a" wireframe />
                                                        </mesh>
                                                    )}
                                                    <OrbitControls enableZoom={true} enablePan={true} />
                                                </Suspense>
                                            </Canvas>
                                        </div>
                                    </div>

                                    {/* Model Info */}
                                    <div className="space-y-1">
                                        <InfoRow label="Name" value={displayName} />
                                        <InfoRow
                                            label="Category"
                                            value={modelData?.namespace || model.namespace}
                                        />
                                        <InfoRow label="Identifier" value={modelData?.model_identifier || model.model_identifier} />
                                        <InfoRow label="Author" value={modelData?.metadata?.author || "Unknown"} />
                                        <InfoRow label="Version" value={modelData?.metadata?.version || "1"} />
                                        <InfoRow
                                            label="Has BBModel"
                                            value={model.has_bbmodel ? "Yes" : "No"}
                                        />

                                        {/* Tags */}
                                        <div className="flex flex-col sm:flex-row gap-2 py-3 border-b border-card">
                                            <div className="text-sm font-semibold text-secondary min-w-35">
                                                Tags
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {modelTags.length > 0 ? (
                                                    modelTags.map((tag, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-2 py-0.5 rounded text-xs border"
                                                            style={{
                                                                backgroundColor: tag.color ? `${tag.color}33` : 'var(--muted)',
                                                                borderColor: tag.color || 'var(--border)',
                                                                color: tag.color || 'var(--primary)'
                                                            }}
                                                        >
                                                            {tag.tag || tag.name || tag.id}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-sm text-muted">No tags</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right Column: Comments & Actions */}
                        <div className="w-full md:w-87.5 flex flex-col bg-card/50">
                            <div className="flex-1 p-6 overflow-y-auto">
                                <div className="text-sm font-semibold text-secondary mb-4">Comments & History</div>
                                
                                <div className="space-y-4 mb-6">
                                    {comments.length === 0 ? (
                                        <div className="text-sm text-muted italic">No comments yet.</div>
                                    ) : (
                                        comments.map((comment, idx) => (
                                            <div key={idx} className="bg-card border border-card p-3 rounded-lg text-sm">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-semibold text-primary">{comment.user}</span>
                                                    <span className="text-xs text-tertiary">
                                                        {new Date(comment.timestamp).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className="text-foreground">{comment.text}</div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="mt-auto">
                                    <Input 
                                        placeholder="Add a comment..." 
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        className="mb-2"
                                    />
                                    <Button 
                                        size="sm" 
                                        className="w-full" 
                                        onPress={handleAddComment}
                                        disabled={submittingComment || !commentText.trim()}
                                    >
                                        Post Comment
                                    </Button>
                                </div>
                            </div>

                            <div className="p-6 border-t border-card bg-background">
                                <div className="flex flex-col gap-2">
                                    {isReview && isAdmin && (
                                        <Button onPress={handleApprove} className="bg-success text-white w-full mb-2">
                                            Approve Model
                                        </Button>
                                    )}
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        {onEdit && (
                                            <Button onPress={() => onEdit(model)}>Edit / New Version</Button>
                                        )}
                                        {model.has_bbmodel && (
                                            <Button onPress={handleDownload}>
                                                Download BBModel
                                            </Button>
                                        )}
                                        {onCopyMove && (
                                            <Button onPress={() => onCopyMove(model)}>Copy/Move</Button>
                                        )}
                                        {isAdmin && onDelete && (
                                            <Button onPress={() => onDelete(model)} className="bg-danger">Delete</Button>
                                        )}
                                    </div>
                                    <Button onPress={onClose} variant="flat" className="mt-2">Close</Button>
                                </div>
                            </div>
                        </div>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
};