import React, { useState, useRef, Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '../3d/OrbitControls';
import {
  Modal,
  Button,
  TextField,
  Label,
  Input,
  toast
} from '@heroui/react';
import { Upload } from 'lucide-react';
import { MinecraftModel } from '../3d/MinecraftModel';
import { TagSelector } from '../form/TagSelector';
import { CategorySelector } from '../form/CategorySelector';
import { api } from '../../services/api';

const SceneCapture = ({ onRegister }) => {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    if (onRegister) {
      onRegister(() => {
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png');
      });
    }
  }, [gl, scene, camera, onRegister]);

  return null;
};

export const UploadModal = ({
                              show,
                              onClose,
                              onUpload,
                              categories,
                              loading,
                              existingModels,
                              onAddCategory,
                              onDeleteCategory
                            }) => {
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadModelName, setUploadModelName] = useState('');
  const [bbmodelFile, setBbmodelFile] = useState(null);
  const [jsonFile, setJsonFile] = useState(null);
  const [modelIdentifier, setModelIdentifier] = useState('');
  const [isIdentifierTouched, setIsIdentifierTouched] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [bbmodelData, setBbmodelData] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [identifierError, setIdentifierError] = useState('');
  const captureThumbnailRef = useRef(null);

  useEffect(() => {
    if (show) {
      setUploadCategory('');
      setUploadModelName('');
      setBbmodelFile(null);
      setJsonFile(null);
      setModelIdentifier('');
      setIsIdentifierTouched(false);
      setUploadPreview(null);
      setBbmodelData(null);
      setSelectedTags([]);
      setIdentifierError('');
    }
  }, [show]);

  // Auto-generate model identifier from model name
  useEffect(() => {
    if (uploadModelName && !isIdentifierTouched) {
      const cleaned = uploadModelName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      setModelIdentifier(cleaned);
    }
  }, [uploadModelName, isIdentifierTouched]);

  // Check for duplicate identifier
  useEffect(() => {
    if (modelIdentifier && uploadCategory && existingModels) {
      const exists = existingModels.some(
        m => m.namespace === uploadCategory && m.model_identifier === modelIdentifier
      );
      if (exists) {
        setIdentifierError('This identifier already exists in the selected category.');
      } else {
        setIdentifierError('');
      }
    } else {
      setIdentifierError('');
    }
  }, [modelIdentifier, uploadCategory, existingModels]);

  const handleJsonSelect = (file) => {
    setJsonFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          // Use the JSON model for preview
          setUploadPreview(json);
        } catch (error) {
          console.error('Error parsing JSON model:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleBbmodelSelect = (file) => {
    setBbmodelFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bbmodel = JSON.parse(e.target.result);
          setBbmodelData(bbmodel);
        } catch (error) {
          console.error('Error parsing bbmodel:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async () => {
    if (!bbmodelFile || !jsonFile || !uploadCategory || !uploadModelName || !modelIdentifier) {
      toast.danger('Please fill all required fields and upload both files');
      return;
    }

    if (identifierError) {
      toast.danger('Please fix the errors before uploading.');
      return;
    }

    const formData = new FormData();
    formData.append('bbmodel', bbmodelFile);
    formData.append('json', jsonFile);
    formData.append('namespace', uploadCategory);
    formData.append('modelName', uploadModelName);
    formData.append('modelIdentifier', modelIdentifier);
    formData.append('tags', JSON.stringify(selectedTags));

    if (captureThumbnailRef.current) {
        try {
            const dataUrl = captureThumbnailRef.current();
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            formData.append('thumbnail', blob, 'thumbnail.png');
        } catch (e) {
            console.error("Thumbnail capture failed", e);
        }
    }

    onUpload(formData);
  };

  const handleAddCategoryWrapper = async (name) => {
      if (onAddCategory) {
          const res = await onAddCategory(name);
          if (res && res.success) {
              setUploadCategory(name);
          }
          return res;
      }
  };

  const handleDeleteCategoryWrapper = async (name) => {
      if (onDeleteCategory) {
          const res = await onDeleteCategory(name);
          if (res && res.success && uploadCategory === name) {
              setUploadCategory('');
          }
          return res;
      }
  };

  if (!show) return null;

  return (
      <Modal isOpen={show} onOpenChange={onClose}>
        <Modal.Backdrop>
          <Modal.Container className="w-full min-w-200 max-w-[95vw] mx-4 h-[calc(100vh-100px)] my-auto">
            <Modal.Dialog className="bg-card border border-card flex flex-col h-full transition-colors">
              <Modal.CloseTrigger />

              <Modal.Header className="shrink-0">
                <Modal.Heading className="text-2xl font-semibold text-foreground">
                  Upload New Model
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body className="space-y-5 pr-2 overflow-y-auto flex-1 p-1">
                {/* File Uploads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BBModel File */}
                  <div className="flex flex-col gap-2">
                    <Label className="block text-sm font-medium text-secondary">
                      BBModel File (.bbmodel)<span className="text-danger ml-1">*</span>
                    </Label>
                    <div className="relative group">
                      <input
                          type="file"
                          accept=".bbmodel"
                          onChange={(e) => handleBbmodelSelect(e.target.files[0])}
                          className="hidden"
                          id="bbmodel-upload"
                      />
                      <label
                          htmlFor="bbmodel-upload"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer bg-surface hover:bg-surface-hover transition-colors"
                      >
                        <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium text-foreground">{bbmodelFile ? bbmodelFile.name : 'Choose .bbmodel file'}</span>
                      </label>
                    </div>
                  </div>

                  {/* JSON File */}
                  <div className="flex flex-col gap-2">
                    <Label className="block text-sm font-medium text-secondary">
                      Model JSON (.json)<span className="text-danger ml-1">*</span>
                    </Label>
                    <div className="relative group">
                      <input
                          type="file"
                          accept=".json"
                          onChange={(e) => handleJsonSelect(e.target.files[0])}
                          className="hidden"
                          id="json-upload"
                      />
                      <label
                          htmlFor="json-upload"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer bg-surface hover:bg-surface-hover transition-colors"
                      >
                        <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium text-foreground">{jsonFile ? jsonFile.name : 'Choose .json file'}</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3D Preview */}
                {uploadPreview && (
                    <div
                        className="w-full h-40 lg:h-60 bg-canvas rounded-lg border border-card transition-colors"
                        onContextMenu={(e) => e.preventDefault()}
                    >
                      <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [2, 2, 2], fov: 65 }}>
                        <Suspense fallback={null}>
                          <ambientLight intensity={0.6} />
                          <directionalLight position={[5, 5, 5]} intensity={0.8} />
                          <pointLight position={[-5, -5, -5]} intensity={0.3} />
                          <MinecraftModel modelData={uploadPreview} bbModelData={bbmodelData} />
                          <OrbitControls enableZoom={true} enablePan={true} />
                          <SceneCapture onRegister={(fn) => (captureThumbnailRef.current = fn)} />
                        </Suspense>
                      </Canvas>
                    </div>
                )}

                {/* Model Name */}
                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Model Name<span className="text-danger ml-1">*</span>
                  </Label>
                  <Input
                      value={uploadModelName}
                      onChange={(e) => setUploadModelName(e.target.value)}
                      placeholder="e.g., Cool Sword"
                      className="w-full"
                      autoComplete="off"
                      data-1p-ignore
                      data-bwignore
                      data-form-type="other"
                  />
                </TextField>

                {/* Namespace (Category) */}
                <CategorySelector
                    value={uploadCategory}
                    onChange={setUploadCategory}
                    options={categories}
                    onAdd={handleAddCategoryWrapper}
                    onDelete={handleDeleteCategoryWrapper}
                />

                {/* Model Identifier */}
                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Model Identifier<span className="text-danger ml-1">*</span>
                  </Label>
                  <Input
                      value={modelIdentifier}
                      onChange={(e) => {
                        setModelIdentifier(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                        setIsIdentifierTouched(true);
                      }}
                      placeholder="cool_sword"
                      className={`w-full ${identifierError ? 'border-danger' : ''}`}
                      autoComplete="off"
                      data-1p-ignore
                  />
                  {identifierError && (
                    <div className="text-xs text-danger mt-1">{identifierError}</div>
                  )}
                </TextField>

                {/* Tag System */}
                <TagSelector
                    selectedTags={selectedTags}
                    onChange={setSelectedTags}
                />
              </Modal.Body>

              <Modal.Footer className="flex gap-3 pt-4 shrink-0">
                <Button
                    onPress={handleSubmit}
                    isDisabled={loading || !!identifierError}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Uploading...' : 'Upload Model'}
                </Button>
                <Button
                    onPress={onClose}
                    variant="outline"
                    className="border border-border text-secondary px-6 py-3 text-sm font-medium"
                >
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
  );
};
