import React, { useState, useEffect } from 'react';
import { Modal, Button, TextField, Label, Input, Dropdown } from '@heroui/react';
import { useAuth } from '../../hooks/useAuth';

export const CopyMoveModal = ({
                                show,
                                model,
                                branches,
                                currentBranch,
                                areas,
                                categories,
                                onClose,
                                onSubmit,
                                loading
                              }) => {
  const [copyMode, setCopyMode] = useState('copy');
  const [targetBranch, setTargetBranch] = useState('');
  const [targetArea, setTargetArea] = useState('');
  const [targetCategory, setTargetCategory] = useState('');
  const [targetName, setTargetName] = useState('');
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (model && branches.length > 0) {
      const otherBranch = branches.find(b => b !== currentBranch) || '';
      setTargetBranch(otherBranch);
      setTargetArea(model.area);
      setTargetCategory(model.category);
      setTargetName(model.name);
    }
  }, [model, branches, currentBranch]);

  if (!show || !model) return null;

  const handleSubmit = () => {
    if (!targetBranch || !targetArea || !targetCategory || !targetName) {
      alert('All fields are required');
      return;
    }

    onSubmit({
      sourceBranch: currentBranch,
      targetBranch,
      sourceArea: model.area,
      sourceCategory: model.category,
      sourceName: model.name,
      targetArea,
      targetCategory,
      targetName,
      mode: copyMode,
    });
  };

  const availableBranches = branches.filter(b => b !== currentBranch);

  return (
      <Modal isOpen={show} onOpenChange={onClose}>
        <Modal.Backdrop>
          <Modal.Container className="max-w-140">
            <Modal.Dialog className="bg-card border border-card transition-colors">
              <Modal.CloseTrigger className="text-tertiary hover:text-foreground" />

              <Modal.Header>
                <Modal.Heading className="text-2xl font-semibold text-foreground">
                  Copy/Move Model
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body className="space-y-5">
                <div>
                  <Label className="block text-sm font-medium text-secondary mb-2">
                    Operation<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Dropdown>
                    <Dropdown.Trigger>
                      <Button className="w-full justify-between font-normal">
                        {copyMode === 'copy' ? 'Copy (keep original)' : 'Move (delete original)'}
                      </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover className="w-(--trigger-width)">
                      <Dropdown.Menu onAction={(key) => setCopyMode(key)}>
                        <Dropdown.Item key="copy">
                          <Label>Copy (keep original)</Label>
                        </Dropdown.Item>
                        {isAdmin && (
                          <Dropdown.Item key="move">
                            <Label>Move (delete original)</Label>
                          </Dropdown.Item>
                        )}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>

                <div>
                  <Label className="block text-sm font-medium text-secondary mb-2">
                    Target Branch<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Dropdown>
                    <Dropdown.Trigger>
                      <Button className="w-full justify-between font-normal">
                        {targetBranch || 'Select branch'}
                      </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover className="w-(--trigger-width)">
                      <Dropdown.Menu onAction={(key) => setTargetBranch(key)}>
                        {availableBranches.map((b) => (
                            <Dropdown.Item key={b}>
                              <Label>{b}</Label>
                            </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>

                <div>
                  <Label className="block text-sm font-medium text-secondary mb-2">
                    Target Area<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Dropdown>
                    <Dropdown.Trigger>
                      <Button className="w-full justify-between font-normal">
                        {targetArea || 'Select area...'}
                      </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover className="w-(--trigger-width)">
                      <Dropdown.Menu onAction={(key) => setTargetArea(key)}>
                        {(areas || []).map((a) => (
                            <Dropdown.Item key={a}>
                              <Label>{a}</Label>
                            </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>

                <div>
                  <Label className="block text-sm font-medium text-secondary mb-2">
                    Target Category<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Dropdown>
                    <Dropdown.Trigger>
                      <Button className="w-full justify-between font-normal">
                        {targetCategory || 'Select category...'}
                      </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover className="w-(--trigger-width)">
                      <Dropdown.Menu onAction={(key) => setTargetCategory(key)}>
                        {(categories || []).map((c) => (
                            <Dropdown.Item key={c}>
                              <Label>{c}</Label>
                            </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>

                <TextField>
                  <Label className="text-sm font-medium text-secondary">
                    Target Name<span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                      value={targetName}
                      onChange={(e) => setTargetName(e.target.value)}
                      placeholder="e.g., ferris_wheel"
                      className="w-full placeholder-background-inverse bg-accent hover:bg-(--accent-hover)"
                  />
                </TextField>
              </Modal.Body>

              <Modal.Footer className="flex gap-3 pt-4">
                <Button
                    onPress={handleSubmit}
                    isDisabled={loading}
                    className="flex-1 bg-(--success) hover:bg-(--success-hover) text-success-foreground"
                >
                  {loading ? 'Processing...' : `${copyMode === 'copy' ? 'Copy' : 'Move'} Model`}
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