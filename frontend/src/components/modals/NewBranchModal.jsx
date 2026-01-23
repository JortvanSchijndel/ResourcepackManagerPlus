import React, { useState, useEffect } from 'react';
import { Modal, Button, TextField, Label, Input, Dropdown } from '@heroui/react';
import { useAuth } from '../../hooks/useAuth';

export const NewBranchModal = ({
  show,
  branches,
  currentBranch,
  onClose,
  onSubmit,
  loading
}) => {
  const [branchName, setBranchName] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (show && currentBranch) {
      setCopyFrom(currentBranch);
    }
  }, [show, currentBranch]);

  if (!show) return null;
  if (!isAdmin) return null; // Extra safety check

  const handleSubmit = () => {
    if (!branchName.trim()) {
      alert('Branch name is required');
      return;
    }
    onSubmit(branchName, copyFrom);
  };

return (
  <Modal isOpen={show} onOpenChange={onClose}>
    <Modal.Backdrop>
      <Modal.Container className="max-w-140">
        <Modal.Dialog className="bg-card">
          <Modal.CloseTrigger className="text-tertiary hover:text-foreground" />

          <Modal.Header>
            <Modal.Heading className="text-2xl font-semibold text-foreground">
              Create New Branch
            </Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-5">
            <TextField>
              <Label className="text-sm font-medium text-secondary">
                Branch Name<span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Enter a name"
                className="w-full bg-accent placeholder-background-inverse"
              />
            </TextField>

            <div>
              <Label className="block text-sm font-medium text-secondary mb-2">
                Copy from Branch<span className="text-red-500 ml-1">*</span>
              </Label>
              <Dropdown>
                <Dropdown.Trigger>
                  <div className="hover:bg-muted-hover-hover bg-muted text-primary w-full justify-between flex items-center px-3 py-2 rounded-lg border border-default cursor-pointer">
                    {copyFrom || 'Select branch'}
                  </div>
                </Dropdown.Trigger>
                <Dropdown.Popover className="w-(--trigger-width)">
                  <Dropdown.Menu onAction={(key) => setCopyFrom(key)} className="bg-popover">
                    {branches.map((b) => (
                      <Dropdown.Item key={b}>
                        <Label>{b}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
          </Modal.Body>

          <Modal.Footer className="flex gap-3">
            <Button
              onPress={handleSubmit}
              isDisabled={loading}
              className="flex-1 bg-(--success) hover:bg-(--success-hover) text-success-foreground rounded-lg px-5 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Branch'}
            </Button>
            <Button onPress={onClose}>
              Cancel
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
);
};