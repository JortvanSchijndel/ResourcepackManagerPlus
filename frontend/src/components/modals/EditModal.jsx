import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, TextField, Label, Input, Description } from '@heroui/react';
import { Plus, Trash2, Upload, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAuth } from '../../hooks/useAuth';

const AddCategoryModal = ({ show, onClose, onAdd, loading }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (show) setName('');
  }, [show]);

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Please enter a category name');
      return;
    }
    onAdd(name.trim());
  };

  if (!show) return null;

  return (
      <Modal isOpen={show} onOpenChange={onClose}>
        <Modal.Backdrop className="opacity-(--modal-backdrop-opacity)">
          <Modal.Container className="max-w-md">
            <Modal.Dialog>
              <Modal.CloseTrigger className="text-tertiary hover:text-foreground" />
              <Modal.Header>
                <Modal.Heading className="text-xl font-semibold text-foreground">
                  Add New Category
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Category<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Description className="text-xs text-tertiary mb-2">
                    A unique identifier for your resource pack category
                  </Description>
                  <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., ingeniamc, mypack..."
                      className="w-full placeholder-background-inverse"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      autoComplete="off"
                      data-1p-ignore
                  />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="flex gap-3 pt-4">
                <Button
                    onPress={handleSubmit}
                    isDisabled={loading}
                    className="flex-1 bg-(--primary) hover:bg-(--primary-hover) text-(--primary-foreground)"
                >
                  {loading ? 'Adding...' : 'Add'}
                </Button>
                <Button onPress={onClose} className="text-secondary">
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
  );
};

const CategoryDropdown = ({ value, onChange, options, onAdd, onDelete, isOpen, setIsOpen }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const dropdownRef = useRef(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, setIsOpen]);

  const handleSelection = (e, selected) => {
    e.preventDefault();
    e.stopPropagation();

    if (selected === '__add_new__') {
      setShowAddModal(true);
      setIsOpen(false);
    } else {
      onChange(selected);
      setIsOpen(false);
    }
  };

  const handleDelete = (e, opt) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirm(`Are you sure you want to delete the category "${opt}"?`)) {
      onDelete(opt);
    }
  };

  return (
      <>
        <div ref={dropdownRef}>
          <Label className="block text-sm text-secondary mb-2">
            Category<span className="text-red-500 ml-1">*</span>
          </Label>
          <Description className="text-xs text-tertiary mb-2">
            The category for your resource pack (becomes part of the path)
          </Description>
          <div className="relative">
            <Button onPress={() => setIsOpen(!isOpen)} className="w-full justify-between font-normal">
              {value || 'Select category...'}
            </Button>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-(--popover) border border-popover-border rounded-lg max-h-62.5 overflow-y-auto shadow-xl">
                  {isAdmin && (
                    <>
                      <div
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelection(e, '__add_new__');
                          }}
                          className="flex items-center gap-2 text-(--primary) px-3 py-2 hover:bg-accent cursor-pointer transition-colors rounded-t-lg"
                      >
                        <Plus size={16} />
                        <span>Add new category</span>
                      </div>
                      {options.length > 0 && <div className="h-px bg-separator mx-2 my-1" />}
                    </>
                  )}
                  {options.map((opt) => (
                      <div
                          key={opt}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelection(e, opt);
                          }}
                          className="flex items-center justify-between group px-3 py-2 hover:bg-accent cursor-pointer transition-colors"
                      >
                        <span className="text-foreground">{opt}</span>
                        {isAdmin && (
                          <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDelete(e, opt);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-(--danger) hover:text-(--danger-hover) transition-opacity ml-2 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                  ))}
                </div>
            )}
          </div>
        </div>

        <AddCategoryModal
            show={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={(name) => {
              onAdd(name);
              setShowAddModal(false);
            }}
        />
      </>
  );
};

const AddTagModal = ({ show, onClose, onAdd }) => {
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#3b82f6');
  const [tagGroup, setTagGroup] = useState('');

  useEffect(() => {
    if (show) {
      setTagName('');
      setTagColor('#3b82f6');
      setTagGroup('');
    }
  }, [show]);

  const handleSubmit = () => {
    if (!tagName.trim()) {
      alert('Please enter a tag name');
      return;
    }
    onAdd({ tag: tagName.trim(), color: tagColor, group: tagGroup || null });
  };

  if (!show) return null;

  return (
      <Modal isOpen={show} onOpenChange={onClose}>
        <Modal.Backdrop className="opacity-(--modal-backdrop-opacity)">
          <Modal.Container className="max-w-md">
            <Modal.Dialog>
              <Modal.CloseTrigger className="text-tertiary hover:text-foreground" />
              <Modal.Header>
                <Modal.Heading className="text-xl font-semibold text-foreground">
                  Add Custom Tag
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Tag Name<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                      value={tagName}
                      onChange={(e) => setTagName(e.target.value)}
                      placeholder="Enter tag name..."
                      className="w-full placeholder-background-inverse"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      autoComplete="off"
                      data-1p-ignore
                  />
                </TextField>

                <div>
                  <Label className="text-sm font-medium text-secondary mb-2 block">
                    Color<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                        type="color"
                        value={tagColor}
                        onChange={(e) => setTagColor(e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-default"
                    />
                    <span className="text-sm text-tertiary">{tagColor}</span>
                  </div>
                </div>

                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Group (optional)
                  </Label>
                  <Input
                      value={tagGroup}
                      onChange={(e) => setTagGroup(e.target.value)}
                      placeholder="e.g., area, type, status..."
                      className="w-full placeholder-background-inverse"
                      autoComplete="off"
                      data-1p-ignore
                  />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="flex gap-3 pt-4">
                <Button
                    onPress={handleSubmit}
                    className="flex-1 bg-(--primary) hover:bg-(--primary-hover) text-(--primary-foreground)"
                >
                  Add Tag
                </Button>
                <Button onPress={onClose} className="text-secondary">
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
  );
};

const TagSelector = ({ selectedTags, onChange }) => {
  const [customTags, setCustomTags] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const { isAdmin } = useAuth();

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await api.getTags()
        if (res?.tags) {
          // Normalize tags for frontend usage
          const normalized = res.tags.map(t => ({
            id: t.id,
            name: t.tag,       // frontend expects "name" for label
            color: t.color,
            group: t.group || null
          }))
          setCustomTags(normalized)
        }
      } catch (err) {
        console.error('Failed to fetch tags', err)
      }
    }
    fetchTags().catch(err => console.error("Failed to fetch tags:", err));
  }, [])


  const toggleTag = (id) => {
    onChange(
        selectedTags.includes(id)
            ? selectedTags.filter(t => t !== id)
            : [...selectedTags, id]
    )
  }

  const handleAddCustomTag = async ({ tag, color, group }) => {
    try {
      const data = await api.addTag({ tag, color, group });

      if (!data?.success) {
        alert(data?.error || 'Failed to create tag');
        return;
      }

      // Normalize tags for frontend immediately
      const normalized = data.tags.map(t => ({
        id: t.id,
        name: t.tag,    // 👈 frontend expects "name"
        color: t.color,
        group: t.group || null
      }));

      setCustomTags(normalized);

      const newTag = normalized.find(t => t.name === tag);
      if (newTag) {
        onChange([...selectedTags, newTag.id]);
      }

      setShowAddModal(false);
    } catch (err) {
      alert(err.message);
    }
  };


  const handleDeleteTag = async (e, tag) => {
    e.stopPropagation()
    if (!confirm('Delete this tag?')) return

    try {
      const res = await api.deleteTag(tag)
      if (res.success) {
        setCustomTags(res.tags)
        onChange(selectedTags.filter(id => id !== tag.id))
      }
    } catch {
      alert('Failed to delete tag')
    }
  }

  const { grouped, ungrouped } = customTags.reduce(
      (acc, tag) => {
        if (!tag.group || tag.group === 'Other') {
          acc.ungrouped.push(tag)
        } else {
          acc.grouped[tag.group] ||= []
          acc.grouped[tag.group].push(tag)
        }
        return acc
      },
      { grouped: {}, ungrouped: [] }
  )

  return (
      <div className="space-y-2">
        <label className="text-sm font-medium text-secondary">Tags</label>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
                className="
              w-full min-h-10 px-3 py-2
              border border-default rounded-lg
              bg-accent text-primary
              flex flex-wrap gap-2 text-left
            "
            >
              {selectedTags.length === 0 && (
                  <span className="text-tertiary text-sm">Select tags…</span>
              )}

              {selectedTags.map(id => {
                const tag = customTags.find(t => t.id === id)
                return tag ? (
                    <span
                        key={id}
                        className="px-2 py-0.5 rounded-md text-sm border"
                        style={{
                          backgroundColor: tag.color ? `${tag.color}33` : 'var(--muted)', // 20% opacity
                          borderColor: tag.color || 'var(--border)',
                          color: tag.color || 'var(--primary)'
                        }}
                    >
                    {tag.name}
                  </span>
                ) : null
              })}
            </button>
          </DropdownMenu.Trigger>

          {/* MAIN MENU */}
          <DropdownMenu.Content
              sideOffset={6}
              className="
            z-50 w-64 p-1
            bg-popover border border-popover-border
            rounded-lg shadow-xl
          "
          >
            {isAdmin && (
              <>
                <DropdownMenu.Item
                    onSelect={() => setShowAddModal(true)}
                    className="
                  flex items-center gap-2
                  px-2 py-1.5 text-sm
                  text-primary rounded-md
                  cursor-pointer
                  hover:bg-accent
                "
                >
                  <Plus size={14} />
                  Create New Tag
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="my-1 h-px bg-separator" />
              </>
            )}

            {/* GROUPS */}
            {Object.keys(grouped).sort().map(groupName => (
                <DropdownMenu.Sub key={groupName}>
                  <DropdownMenu.SubTrigger
                      className="
                  flex items-center justify-between
                  px-2 py-1.5 text-sm
                  text-secondary rounded-md
                  cursor-pointer
                  hover:bg-accent
                "
                  >
                    {groupName}
                    <ChevronRight size={14} className="text-tertiary" />
                  </DropdownMenu.SubTrigger>

                  {/* SUB MENU */}
                  <DropdownMenu.SubContent
                      sideOffset={6}
                      className="
                  z-50 min-w-60 w-60 p-1
                  bg-popover border border-popover-border
                  rounded-lg shadow-xl
                "
                  >
                    {grouped[groupName].map(tag => (
                        <DropdownMenu.Item
                            key={tag.id}
                            onSelect={() => toggleTag(tag.id)}
                            className="
                      flex items-center justify-between
                      px-2 py-1.5 text-sm
                      text-primary rounded-md
                      cursor-pointer
                      hover:bg-accent
                    "
                        >
                          <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                readOnly
                                checked={selectedTags.includes(tag.id)}
                                className="accent-(--primary)"
                            />
                            {tag.color && (
                                <span
                                    className="w-3 h-3 rounded-full border border-default"
                                    style={{ backgroundColor: tag.color }}
                                />
                            )}
                            <span>{tag.name}</span>
                          </div>


                          {isAdmin && (
                            <button
                                onClick={(e) => handleDeleteTag(e, tag)}
                                className="
                          text-danger hover:text-danger-hover
                          p-1 rounded
                        "
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Sub>
            ))}

            {/* UNGROUPED */}
            {ungrouped.length > 0 && (
                <>
                  <DropdownMenu.Separator className="my-1 h-px bg-separator" />

                  {ungrouped.map(tag => (
                      <DropdownMenu.Item
                          key={tag.id}
                          onSelect={() => toggleTag(tag.id)}
                          className="
                    flex items-center justify-between
                    px-2 py-1.5 text-sm
                    text-primary rounded-md
                    cursor-pointer
                    hover:bg-accent
                  "
                      >
                        <div className="flex items-center gap-2">
                          <input
                              type="checkbox"
                              readOnly
                              checked={selectedTags.includes(tag.id)}
                              className="accent-(--primary)"
                          />
                          {tag.color && (
                              <span
                                  className="w-3 h-3 rounded-full border border-default"
                                  style={{ backgroundColor: tag.color }}
                              />
                          )}
                          <span>{tag.name}</span>
                        </div>


                        {isAdmin && (
                          <button
                              onClick={(e) => handleDeleteTag(e, tag)}
                              className="text-danger hover:text-danger-hover p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </DropdownMenu.Item>
                  ))}
                </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <AddTagModal
            show={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={handleAddCustomTag}
        />
      </div>
  )
};

export const EditModal = ({ show, model, categories, onClose, onSave, loading }) => {
  const [editCategory, setEditCategory] = useState('');
  const [editName, setEditName] = useState('');
  const [editIdentifier, setEditIdentifier] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [bbmodelFile, setBbmodelFile] = useState(null);
  const [jsonFile, setJsonFile] = useState(null);
  const [isCategoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  useEffect(() => {
    if (model) {
      setEditCategory(model.namespace);
      setEditName(model.name);
      setEditIdentifier(model.identifier);
      setEditTags(model.tags ? model.tags.map(t => typeof t === 'string' ? t : t.id) : []);
      setBbmodelFile(null);
      setJsonFile(null);
    }
  }, [model]);

  if (!show || !model) return null;

  const handleSubmit = () => {
    if (!editCategory || !editName || !editIdentifier) {
      alert('Category, Name, and Identifier are required');
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

  const handleAddCategory = (name) => {
    const filtered = name.replace(/[^a-z0-9_-]/gi, '');
    if (!filtered) {
      alert('Category must contain only letters, numbers, underscores, and hyphens');
      return;
    }
    // This logic should be handled by the parent component
    // setLocalCategories(prev => [...prev, filtered]);
    setEditCategory(filtered);
  };

  const handleDeleteCategory = (name) => {
    // This logic should be handled by the parent component
    // setLocalCategories(prev => prev.filter(c => c !== name));
    if (editCategory === name) setEditCategory('');
  };

  return (
      <Modal isOpen={show} onOpenChange={onClose}>
        <Modal.Backdrop>
          <Modal.Container className="max-w-150">
            <Modal.Dialog className="bg-card border border-card transition-colors">
              <Modal.CloseTrigger className="text-tertiary hover:text-foreground" />

              <Modal.Header>
                <Modal.Heading className="text-2xl font-semibold text-foreground">
                  Edit Model
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body className="space-y-5">
                <CategoryDropdown
                    value={editCategory}
                    onChange={setEditCategory}
                    options={categories}
                    onAdd={handleAddCategory}
                    onDelete={handleDeleteCategory}
                    isOpen={isCategoryDropdownOpen}
                    setIsOpen={setCategoryDropdownOpen}
                />

                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Model Name<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                      value={editName}
                      onChange={(e) => setEditName(e.targe.value)}
                      placeholder="Enter name..."
                      className="w-full placeholder-background-inverse bg-accent hover:bg-(--accent-hover)"
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
                      className="w-full placeholder-background-inverse bg-accent hover:bg-(--accent-hover)"
                  />
                </TextField>

                <TagSelector 
                  selectedTags={editTags} 
                  onChange={setEditTags} 
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BBModel File */}
                  <div>
                    <Label className="block text-sm font-medium text-secondary mb-2">
                      Replace BBModel
                    </Label>
                    <div className="relative">
                      <input
                          type="file"
                          accept=".bbmodel"
                          onChange={(e) => setBbmodelFile(e.target.files[0])}
                          className="hidden"
                          id="edit-bbmodel-upload"
                      />
                      <label
                          htmlFor="edit-bbmodel-upload"
                          className="flex items-center justify-center gap-2 w-full bg-accent text-foreground border border-default rounded-lg px-4 py-3 text-sm cursor-pointer hover:bg-(--accent-hover) transition-colors"
                      >
                        <Upload size={16} />
                        <span>{bbmodelFile ? bbmodelFile.name : 'Choose .bbmodel'}</span>
                      </label>
                    </div>
                  </div>

                  {/* JSON File */}
                  <div>
                    <Label className="block text-sm font-medium text-secondary mb-2">
                      Replace JSON
                    </Label>
                    <div className="relative">
                      <input
                          type="file"
                          accept=".json"
                          onChange={(e) => setJsonFile(e.target.files[0])}
                          className="hidden"
                          id="edit-json-upload"
                      />
                      <label
                          htmlFor="edit-json-upload"
                          className="flex items-center justify-center gap-2 w-full bg-accent text-foreground border border-default rounded-lg px-4 py-3 text-sm cursor-pointer hover:bg-(--accent-hover) transition-colors"
                      >
                        <Upload size={16} />
                        <span>{jsonFile ? jsonFile.name : 'Choose .json'}</span>
                      </label>
                    </div>
                  </div>
                </div>

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