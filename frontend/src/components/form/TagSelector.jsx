import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronRight, MoreHorizontal, Pencil, ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Modal, Button, TextField, Label, Input, ComboBox, ListBox, toast } from '@heroui/react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

const AddTagModal = ({ show, onClose, onAdd, existingGroupNames = [] }) => {
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#3b82f6');
  const [tagGroup, setTagGroup] = useState('');

  const handleClose = () => {
    setTagName('');
    setTagColor('#3b82f6');
    setTagGroup('');
    onClose();
  };

  const handleSubmit = () => {
    if (!tagName.trim()) {
      toast.danger('Please enter a tag name');
      return;
    }

    onAdd({
      tag: tagName.trim(),
      color: tagColor,
      group: tagGroup || null
    });
  };

  if (!show) return null;

  return (
      <Modal isOpen={show} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <Modal.Backdrop>
          <Modal.Container className="max-w-md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="text-xl font-semibold">
                  Add Custom Tag
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4 p-1">
                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Tag Name<span className="text-danger ml-1">*</span>
                  </Label>
                  <Input
                      value={tagName}
                      onChange={(e) => setTagName(e.target.value)}
                      placeholder="Enter tag name..."
                      className="w-full"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      autoComplete="off"
                      data-1p-ignore
                  />
                </TextField>

                <div>
                  <Label className="text-sm font-medium text-(--txt-primary) mb-2 block">
                    Color<span className="text-danger ml-1">*</span>
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                        type="color"
                        value={tagColor}
                        onChange={(e) => setTagColor(e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-border"
                    />
                    <span className="text-sm text-(--txt-primary)">{tagColor}</span>
                  </div>
                </div>

                <ComboBox
                    inputValue={tagGroup}
                    onInputChange={setTagGroup}
                    allowsCustomValue={true}
                    placeholder="e.g., area, type, status..."
                    className="w-full"
                    aria-label="Tag Group"
                >
                  <Label className="text-sm font-medium text-secondary">
                    Group (optional)
                  </Label>
                  <ComboBox.InputGroup>
                    <Input />
                    <ComboBox.Trigger />
                  </ComboBox.InputGroup>
                  <ComboBox.Popover placement="bottom" className="bg-(--bg-tertiary)">
                    <ListBox>
                      {existingGroupNames.map(group => (
                          <ListBox.Item key={group} id={group} textValue={group}>
                            {group}
                          </ListBox.Item>
                      ))}
                    </ListBox>
                  </ComboBox.Popover>
                </ComboBox>
              </Modal.Body>
              <Modal.Footer className="flex gap-3 pt-4">
                <Button
                    onPress={handleSubmit}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Add Tag
                </Button>
                <Button onPress={handleClose} variant="outline" className="text-secondary">
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
  );
};

const EditTagModal = ({ show, onClose, onEdit, tag, existingGroupNames }) => {
  const [tagName, setTagName] = useState(tag?.name || '');
  const [tagColor, setTagColor] = useState(tag?.color || '#3b82f6');
  const [tagGroup, setTagGroup] = useState(tag?.group || '');

  const handleSubmit = async () => {
    if (!tagName.trim()) {
      toast.danger('Please enter a tag name');
      return;
    }

    await onEdit(tag.id, {
      tag: tagName.trim(),
      color: tagColor,
      group: tagGroup || null,
    });
    onClose();
    toast.success('Tag updated successfully!');
  };

  if (!show || !tag) return null;

  return (
      <Modal isOpen={show} onOpenChange={onClose}>
        <Modal.Backdrop>
          <Modal.Container className="max-w-md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="text-xl font-semibold">
                  Edit Tag: {tag.name}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4 p-1">
                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Tag Name<span className="text-danger ml-1">*</span>
                  </Label>
                  <Input
                      value={tagName}
                      onChange={(e) => setTagName(e.target.value)}
                      placeholder="Enter tag name..."
                      className="w-full"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      autoComplete="off"
                      data-1p-ignore
                  />
                </TextField>

                <div>
                  <Label className="text-sm font-medium text-(--txt-primary) mb-2 block">
                    Color<span className="text-danger ml-1">*</span>
                  </Label>
                  <div className="flex gap-2 items-center">
                    <input
                        type="color"
                        value={tagColor}
                        onChange={(e) => setTagColor(e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border border-border"
                    />
                    <span className="text-sm text-(--txt-primary)">{tagColor}</span>
                  </div>
                </div>

                <ComboBox
                    inputValue={tagGroup}
                    onInputChange={setTagGroup}
                    allowsCustomValue={true}
                    placeholder="e.g., area, type, status..."
                    className="w-full"
                    aria-label="Tag Group"
                >
                  <Label className="text-sm font-medium text-secondary">
                    Group (optional)
                  </Label>
                  <ComboBox.InputGroup>
                    <Input />
                    <ComboBox.Trigger />
                  </ComboBox.InputGroup>
                  <ComboBox.Popover placement="bottom" className="bg-(--bg-tertiary)">
                    <ListBox>
                      {existingGroupNames.map(group => (
                          <ListBox.Item key={group} id={group} textValue={group}>
                            {group}
                          </ListBox.Item>
                      ))}
                    </ListBox>
                  </ComboBox.Popover>
                </ComboBox>
              </Modal.Body>
              <Modal.Footer className="flex gap-3 pt-4">
                <Button
                    onPress={handleSubmit}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Save Changes
                </Button>
                <Button onPress={onClose} variant="outline" className="text-secondary">
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
  );
};

const EditGroupModal = ({ show, onClose, onRename, groupToRename }) => {
  const [newGroupName, setNewGroupName] = useState(groupToRename?.oldName || '');

  const handleSubmit = async () => {
    if (!newGroupName.trim()) {
      toast.danger('Please enter a group name');
      return;
    }
    if (newGroupName.trim() === groupToRename.oldName) {
      toast.danger('New group name cannot be the same as the old name');
      return;
    }

    await onRename(groupToRename.oldName, newGroupName.trim());
    onClose();
  };

  if (!show || !groupToRename) return null;

  return (
      <Modal isOpen={show} onOpenChange={onClose}>
        <Modal.Backdrop>
          <Modal.Container className="max-w-md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading className="text-xl font-semibold">
                  Rename Group: {groupToRename.oldName}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4 p-1">
                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    New Group Name<span className="text-danger ml-1">*</span>
                  </Label>
                  <Input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Enter new group name..."
                      className="w-full"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      autoComplete="off"
                      data-1p-ignore
                  />
                </TextField>
              </Modal.Body>
              <Modal.Footer className="flex gap-3 pt-4">
                <Button
                    onPress={handleSubmit}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Rename Group
                </Button>
                <Button onPress={onClose} variant="outline" className="text-secondary">
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
  );
};

export const TagSelector = ({ selectedTags, onChange, label = 'Tags' }) => {
  const [customTags, setCustomTags] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false);
  const [tagToEdit, setTagToEdit] = useState(null);
  const [showRenameGroupModal, setShowRenameGroupModal] = useState(false);
  const [groupToRename, setGroupToRename] = useState(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await api.getTags()
        if (res?.tags) {
          // Normalize tags for frontend usage
          const normalized = res.tags.map(t => ({
            id: t.id,
            name: t.tag,
            color: t.color,
            group: t.group || null
          }))
          setCustomTags(normalized)
        }
      } catch (err) {
        console.error('Failed to fetch tags', err)
      }
    }
    void fetchTags()
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
        toast.danger(data?.error || 'Failed to create tag');
        return;
      }

      const normalized = data.tags.map(t => ({
        id: t.id,
        name: t.tag,
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
      toast.danger(err.message);
    }
  };

  const handleEditTag = async (tagId, updatedTagData) => {
    try {
      const data = await api.updateTag(tagId, updatedTagData);

      if (!data?.success) {
        toast.danger(data?.error || 'Failed to update tag');
        return;
      }

      const normalized = data.tags.map(t => ({
        id: t.id,
        name: t.tag,
        color: t.color,
        group: t.group || null
      }));

      setCustomTags(normalized);
      onChange(selectedTags.filter(id => normalized.some(nt => nt.id === id)));

      setShowEditModal(false);
      setTagToEdit(null);
    } catch (err) {
      toast.danger(err.message);
    }
  };

  const handleDeleteTag = async (e, tag) => {
    if (!confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) return;

    try {
      const res = await api.deleteTag(tag);
      if (res.success) {
        const normalized = res.tags.map(t => ({
          id: t.id,
          name: t.tag,
          color: t.color,
          group: t.group || null
        }));
        setCustomTags(normalized);
        onChange(selectedTags.filter(id => id !== tag.id));
        toast.success('Tag deleted successfully!');
      }
    } catch (err)
 {
      toast.danger('Failed to delete tag: ' + err.message);
    }
  };

  const handleRenameGroup = async (oldName, newName) => {
    if (!oldName || !newName || oldName === newName) {
      toast.danger("Invalid group name or no change.");
      return;
    }
    if (!isAdmin) {
      toast.danger("You are not authorized to rename groups.");
      return;
    }

    try {
      const result = await api.renameTagGroup(oldName, newName);
      if (result.success) {
        // Update local state (customTags) after successful backend update
        const updatedTags = customTags.map(tag =>
            tag.group === oldName ? { ...tag, group: newName } : tag
        );
        setCustomTags(updatedTags);
        toast.success(`Group '${oldName}' renamed to '${newName}'`);
        setShowRenameGroupModal(false);
        setGroupToRename(null);
      } else {
        toast.danger(result.error || "Failed to rename group.");
      }
    } catch (err) {
      toast.danger(`Failed to rename group: ${err.message}`);
    }
  };

  const { grouped, ungrouped } = customTags.reduce(
      (acc, tag) => {
        if (!tag.group || tag.group === 'Other') {
          acc.ungrouped.push(tag)
        } else {
          if (!acc.grouped[tag.group]) acc.grouped[tag.group] = []
          acc.grouped[tag.group].push(tag)
        }
        return acc
      },
      { grouped: {}, ungrouped: [] }
  )

  return (
      <div className="space-y-2">
        {label && <label className="text-sm font-medium text-(--txt-primary)">{label}</label>}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
                className="
              w-full min-h-10 px-3 py-2
              border border-border rounded-lg
              bg-(--bg-tertiary)
              flex items-center justify-between gap-2 text-left mt-1
            "
            >
              <div className="flex flex-wrap gap-2 flex-1">
                {selectedTags.length === 0 && (
                    <span className="text-(--txt-tertiary) text-sm">Select tags…</span>
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
              </div>
              <ChevronDown size={16} className="text-tertiary" />
            </button>
          </DropdownMenu.Trigger>

          {/* MAIN MENU */}
          <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className="
            z-50 w-64 p-1
            bg-(--bg-tertiary)
            rounded-(--radius) shadow-xl
            text-(--txt-primary)
            data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
            data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
          "
          >
              <>
                <DropdownMenu.Item
                    onSelect={() => setShowAddModal(true)}
                    className="
                  flex items-center gap-2
                  px-2 py-1.5 text-sm
                  text-primary rounded-md
                  cursor-pointer
                  hover:bg-(--bg-transparent-hover) text-(--txt-primary)
                "
                >
                  <Plus size={14} />
                  Create New Tag
                </DropdownMenu.Item>

                <DropdownMenu.Separator className="my-1 h-px bg-muted" />
              </>

            {/* GROUPS */}
            {Object.keys(grouped).sort().map(groupName => (
                <DropdownMenu.Sub key={groupName}>
                  <div className="flex items-center justify-between">
                    <DropdownMenu.SubTrigger
                        className="
                  flex-1 flex items-center justify-between
                  px-2 py-1.5 text-sm
                  text-secondary rounded-md
                  cursor-pointer
                  hover:bg-(--bg-transparent-hover) text-(--txt-primary)
                "
                    >
                      <span className="flex-1 text-left">{groupName}</span>
                      <ChevronRight size={14} className="text-tertiary" />
                    </DropdownMenu.SubTrigger>

                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className="ml-2 p-1 rounded hover:bg-(--bg-transparent-hover)"
                          aria-label="Group menu"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content
                          className="
                        z-50 w-48 p-1
                        bg-(--bg-tertiary)
                        rounded-(--radius) shadow-xl
                        text-(--txt-primary)
                      "
                      >
                        {isAdmin && (
                            <DropdownMenu.Item
                                className="
                                flex items-center gap-2
                                px-2 py-1.5 text-sm
                                text-secondary rounded-md
                                cursor-pointer
                                hover:bg-(--bg-transparent-hover)
                              "
                                onSelect={() => {
                                  setGroupToRename({ oldName: groupName, newName: groupName });
                                  setShowRenameGroupModal(true);
                                }}
                            >
                              <Pencil size={14} className="mr-2" /> Rename Group
                            </DropdownMenu.Item>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </div>

                    {/* SUB MENU tags inside group */}
                    <DropdownMenu.SubContent
                        sideOffset={6}
                        className="
                  z-50 min-w-60 w-60 p-1 right-1 relative
                  bg-(--bg-tertiary)
                  rounded-(--radius) shadow-xl text-(--txt-primary)
                "
                    >
                      {grouped[groupName].map(tag => (
                          <div key={tag.id} className="flex items-center justify-between">
                            <div
                                onClick={() => toggleTag(tag.id)}
                                className="
                              flex items-center justify-between
                              px-2 py-1.5 text-sm
                              text-primary rounded-md
                              cursor-pointer
                              hover:bg-(--bg-transparent-hover)
                            "
                            >
                              <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    readOnly
                                    checked={selectedTags.includes(tag.id)}
                                    className="accent-primary"
                                />
                                {tag.color && (
                                    <span
                                        className="w-3 h-3 rounded-full border border-border"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                )}
                                <span>{tag.name}</span>
                              </div>
                            </div>

                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger asChild>
                                <button onClick={(e) => { e.stopPropagation(); }} className="ml-2 p-1 rounded hover:bg-(--bg-transparent-hover)" aria-label="Tag menu">
                                  <MoreHorizontal size={14} />
                                </button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Content className="z-50 w-48 p-1 bg-(--bg-tertiary) rounded-(--radius) shadow-xl text-(--txt-primary)">
                                {isAdmin && (
                                    <DropdownMenu.Item
                                        className="
                                        flex items-center gap-2
                                        px-2 py-1.5 text-sm
                                        text-secondary rounded-md
                                        cursor-pointer
                                        hover:bg-(--bg-transparent-hover)
                                      "
                                        onSelect={() => {
                                          setTagToEdit(tag);
                                          setShowEditModal(true);
                                        }}
                                    >
                                      <Pencil size={14} /> Edit Tag
                                    </DropdownMenu.Item>
                                )}
                                {isAdmin && (
                                    <DropdownMenu.Item
                                        className="
                                        flex items-center gap-2
                                        px-2 py-1.5 text-sm
                                        text-danger rounded-md
                                        cursor-pointer
                                        hover:bg-(--bg-transparent-hover)
                                      "
                                        onSelect={() => {
                                          void handleDeleteTag(null, tag);

                                        }}
                                    >
                                      <Trash2 size={14} /> Delete Tag
                                    </DropdownMenu.Item>
                                )}
                              </DropdownMenu.Content>
                            </DropdownMenu.Root>
                          </div>
                      ))}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Sub>
            ))}

            {/* UNGROUPED */}
            {ungrouped.length > 0 && (
                <>
                  <DropdownMenu.Separator className="my-1 h-px bg-muted" />

                  {ungrouped.map(tag => (
                      <div key={tag.id} className="flex items-center justify-between">
                        <div
                            onClick={() => toggleTag(tag.id)}
                            className="
                          flex items-center justify-between
                          px-2 py-1.5 text-sm
                          text-primary rounded-md
                          cursor-pointer
                          hover:bg-(--bg-transparent-hover)
                        "
                        >
                          <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                readOnly
                                checked={selectedTags.includes(tag.id)}
                                className="accent-primary"
                            />
                            {tag.color && (
                                <span
                                    className="w-3 h-3 rounded-full border border-border"
                                    style={{ backgroundColor: tag.color }}
                                />
                            )}
                            <span>{tag.name}</span>
                          </div>
                        </div>

                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button onClick={(e) => { e.stopPropagation(); }} className="ml-2 p-1 rounded hover:bg-(--bg-transparent-hover)" aria-label="Tag menu">
                              <MoreHorizontal size={14} />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content className="z-50 w-48 p-1 bg-(--bg-tertiary) rounded-(--radius) shadow-xl text-(--txt-primary)">
                            {isAdmin && (
                                <DropdownMenu.Item
                                    className="
                                    flex items-center gap-2
                                    px-2 py-1.5 text-sm
                                    text-secondary rounded-md
                                    cursor-pointer
                                    hover:bg-(--bg-transparent-hover)
                                  "
                                    onSelect={() => {
                                      setTagToEdit(tag);
                                      setShowEditModal(true);
                                    }}
                                >
                                  <Pencil size={14} /> Edit Tag
                                </DropdownMenu.Item>
                            )}
                            {isAdmin && (
                                <DropdownMenu.Item
                                    className="
                                    flex items-center gap-2
                                    px-2 py-1.5 text-sm
                                    text-danger rounded-md
                                    cursor-pointer
                                    hover:bg-(--bg-transparent-hover)
                                  "
                                    onSelect={() => {
                                      void handleDeleteTag(null, tag);
                                    }}
                                >
                                  <Trash2 size={14} /> Delete Tag
                                </DropdownMenu.Item>
                            )}
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
                      </div>
                  ))}
                </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <AddTagModal
            show={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={handleAddCustomTag}
            existingGroupNames={Array.from(new Set(customTags.map(t => t.group).filter(Boolean))).sort()}
        />

        <EditTagModal
            key={tagToEdit?.id || 'edit-tag-modal'}
            show={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setTagToEdit(null);
            }}
            onEdit={handleEditTag}
            tag={tagToEdit}
            existingGroupNames={Array.from(new Set(customTags.map(t => t.group).filter(Boolean))).sort()}
        />

        <EditGroupModal
            key={groupToRename?.oldName || 'rename-group-modal'}
            show={showRenameGroupModal}
            onClose={() => {
              setShowRenameGroupModal(false);
              setGroupToRename(null);
            }}
            onRename={handleRenameGroup}
            groupToRename={groupToRename}
        />
      </div>
  )
};
