import React, { useState } from 'react';
import { Button, Label, Select, ListBox, Modal, TextField, Input, Description, toast } from '@heroui/react';
import { Plus, Trash2 } from 'lucide-react';

const AddCategoryModal = ({ show, onClose, onAdd, loading }) => {
  const [name, setName] = useState('');

  const handleClose = () => {
    setName('');
    onClose();
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.danger('Please enter a category name');
      return;
    }
    onAdd(name.trim());
    setName('');
  };

  if (!show) return null;

  return (
      <Modal isOpen={show} onOpenChange={(isOpen) => !isOpen && handleClose()}>
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
                <Button onPress={handleClose} className="text-secondary">
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
  );
};

export const CategorySelector = ({ value, onChange, options, onAdd, onDelete, label, allowAdd = true, allowDelete = true }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectKey, setSelectKey] = useState(0);

  return (
    <>
      <Select
        key={selectKey}
        selectedKeys={value ? [value] : []}
        onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0];
            // Handle actual category selection
            if (selected !== '__add_new__') {
                onChange(selected);
            }
        }}
        placeholder="Select category..."
      >
        {label === null ? null : (
            label ? (
                <Label className="text-sm font-medium text-secondary">{label}</Label>
            ) : (
                <Label className="text-sm font-medium text-secondary">
                    Category<span className="text-danger ml-1">*</span>
                </Label>
            )
        )}
        <Select.Trigger className="w-full min-h-10">
            <Select.Value />
            <Select.Indicator />
        </Select.Trigger>
        <Select.Popover placement="bottom" className="bg-(--bg-tertiary)">
            <ListBox selectionMode="single">
                <ListBox.Section>
                    {options.map((opt) => (
                        <ListBox.Item key={opt} id={opt} textValue={opt}>
                            <div className="flex items-center justify-between w-full group">
                                <span>{opt}</span>
                                {allowDelete && (
                                  <Button
                                      isIconOnly
                                      size="sm"
                                      variant="ghost"
                                      className="opacity-0 group-hover:opacity-100 text-danger hover:text-danger-foreground"
                                      onPress={() => onDelete(opt)}
                                  >
                                      <Trash2 size={14} />
                                  </Button>
                                )}
                            </div>
                        </ListBox.Item>
                    ))}
                </ListBox.Section>
                {allowAdd && (
                    <ListBox.Section className="border-t border-muted -1 pt-1">
                        <ListBox.Item
                            key="__add_new__"
                            id="__add_new__"
                            textValue="Add new category"
                            onPress={() => { // Use onPress to trigger modal directly
                                setShowAddModal(true);
                                setSelectKey(k => k + 1); // Reset select component
                            }}
                        >
                            <div className="flex items-center gap-2 text-primary">
                                <Plus size={16} />
                                <span>Add new category</span>
                            </div>
                        </ListBox.Item>
                    </ListBox.Section>
                )}
            </ListBox>
        </Select.Popover>
      </Select>

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
