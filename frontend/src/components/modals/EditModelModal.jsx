import React, { useState, useEffect } from 'react';
import { Modal, Button, TextField, Label, Input, toast } from '@heroui/react';
import { Upload } from 'lucide-react';
import { CategorySelector } from '../form/CategorySelector';
import { TagSelector } from '../form/TagSelector';
import { api } from '../../services/api';

export const EditModelModal = ({ show, model, categories, onClose, onSave, loading, onAddCategory, onDeleteCategory }) => {
  const [editCategory, setEditCategory] = useState('');
  const [editName, setEditName] = useState('');
  const [editIdentifier, setEditIdentifier] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [bbmodelFile, setBbmodelFile] = useState(null);
  const [jsonFile, setJsonFile] = useState(null);

  useEffect(() => {
    if (model) {
      setEditCategory(model.namespace);
      setEditName(model.name);
      setEditIdentifier(model.identifier || model.model_identifier || '');
      setEditTags(model.tags ? model.tags.map(t => typeof t === 'string' ? t : t.id) : []);
      setBbmodelFile(null);
      setJsonFile(null);
    }
  }, [model]);

  if (!show || !model) return null;

  const handleSubmit = () => {
    if (!editCategory || !editName || !editIdentifier) {
      toast.danger('Category, Name, and Identifier are required');
      return;
    }

    const formData = new FormData();
    formData.append('namespace', editCategory);
    formData.append('modelName', editName);
    formData.append('modelIdentifier', editIdentifier);
    formData.append('tags', JSON.stringify(editTags));

    if (bbmodelFile) formData.append('bbmodel', bbmodelFile);
    if (jsonFile) formData.append('json', jsonFile);

    onSave(formData);
  };

  const handleAddCategoryWrapper = async (name) => {
      if (onAddCategory) {
          const res = await onAddCategory(name);
          if (res && res.success) {
              setEditCategory(name);
          }
          return res;
      }
  };

  const handleDeleteCategoryWrapper = async (name) => {
      if (onDeleteCategory) {
          const res = await onDeleteCategory(name);
          if (res && res.success && editCategory === name) {
              setEditCategory('');
          }
          return res;
      }
  };

  return (
      <Modal isOpen={show} onOpenChange={onClose}>
        <Modal.Backdrop>
          <Modal.Container className="max-w-150">
            <Modal.Dialog className="bg-card transition-colors">
              <Modal.CloseTrigger className="text-tertiary hover:text-foreground" />

              <Modal.Header>
                <Modal.Heading className="text-2xl font-semibold text-foreground">
                  Edit Model
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body className="space-y-5 p-1">
                {/* File Uploads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BBModel File */}
                  <div className="flex flex-col gap-2">
                    <Label className="block text-sm font-medium text-secondary">
                      Replace BBModel
                    </Label>
                    <div className="relative group">
                      <input
                          type="file"
                          accept=".bbmodel"
                          onChange={(e) => setBbmodelFile(e.target.files[0])}
                          className="hidden"
                          id="edit-bbmodel-upload"
                      />
                      <label
                          htmlFor="edit-bbmodel-upload"
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
                      Replace JSON
                    </Label>
                    <div className="relative group">
                      <input
                          type="file"
                          accept=".json"
                          onChange={(e) => setJsonFile(e.target.files[0])}
                          className="hidden"
                          id="edit-json-upload"
                      />
                      <label
                          htmlFor="edit-json-upload"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl cursor-pointer bg-surface hover:bg-surface-hover transition-colors"
                      >
                        <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                        <span className="text-sm font-medium text-foreground">{jsonFile ? jsonFile.name : 'Choose .json file'}</span>
                      </label>
                    </div>
                  </div>
                </div>

                <CategorySelector
                    value={editCategory}
                    onChange={setEditCategory}
                    options={categories}
                    onAdd={handleAddCategoryWrapper}
                    onDelete={handleDeleteCategoryWrapper}
                />

                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Model Name<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter name..."
                      className="w-full bg-(--bg-tertiary)"
                  />
                </TextField>

                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Model Identifier<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                      value={editIdentifier}
                      onChange={(e) => setEditIdentifier(e.target.value)}
                      placeholder="Enter identifier..."
                      className="w-full bg-(--bg-tertiary)"
                  />
                </TextField>

                <TagSelector
                    selectedTags={editTags}
                    onChange={setEditTags}
                />

              </Modal.Body>

              <Modal.Footer className="flex gap-3 pt-4">
                <Button
                    onPress={handleSubmit}
                    isDisabled={loading}
                    className="flex-1 bg-(--success) hover:bg-(--success-hover) text-success-foreground"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                    onPress={onClose}
                    className="border border-default text-secondary"
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
