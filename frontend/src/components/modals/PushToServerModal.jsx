import React, { useState, useEffect } from 'react';
import { Modal, Button, toast } from '@heroui/react';
import { api } from '../../services/api';

export const PushToServerModal = ({ servers, currentBranch, show, onClose }) => {
  const [selectedServers, setSelectedServers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) {
      setSelectedServers([]);
      setLoading(false);
    }
  }, [show]);

  const handleServerSelection = (serverId) => {
    setSelectedServers(prev =>
        prev.includes(serverId)
            ? prev.filter(id => id !== serverId)
            : [...prev, serverId]
    );
  };

  const handlePush = async () => {
    if (selectedServers.length === 0) {
      toast.warning('Please select at least one server.');
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
          selectedServers.map(serverId => api.pushToServer(currentBranch, serverId))
      );

      const successes = results.filter(r => r.success);
      const errors = results.filter(r => !r.success);

      if (successes.length > 0) {
        toast.success(`Successfully pushed to ${successes.length} server(s).`);
      }
      if (errors.length > 0) {
        const errorDetails = errors.map(e => e.message || 'Unknown error').join(', ');
        toast.danger(`Failed to push to ${errors.length} server(s): ${errorDetails}`);
      }
      onClose();
    } catch (error) {
      toast.danger(error.message || 'An unexpected error occurred during push.');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
      <Modal isOpen={show} onOpenChange={onClose}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="bg-card max-w-md">
              <Modal.CloseTrigger className="text-tertiary hover:text-foreground" />

              <Modal.Header>
                <Modal.Heading className="text-2xl font-semibold text-foreground">
                  Push to Server
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body className="space-y-4 p-6">
                <p className="text-secondary text-sm">
                  Select the servers to push the '{currentBranch}' branch to.
                </p>
                <div className="space-y-3">
                  {servers && servers.length > 0 ? (
                      servers.map(server => (
                          <label key={server.id} className="flex items-center space-x-3 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors">
                            <input
                                type="checkbox"
                                checked={selectedServers.includes(server.id)}
                                onChange={() => handleServerSelection(server.id)}
                                className="w-4 h-4 rounded border-gray-300 bg-blue-500"
                            />
                            <span className="text-foreground">{server.name}</span>
                          </label>
                      ))
                  ) : (
                      <p className="text-sm text-secondary">No servers configured.</p>
                  )}
                </div>
              </Modal.Body>

              <Modal.Footer className="flex gap-3 p-6 border-t border-default">
                <Button
                    onPress={handlePush}
                    isDisabled={loading || selectedServers.length === 0}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-5 py-3 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Pushing...' : `Push to ${selectedServers.length} Server(s)`}
                </Button>
                <Button
                    onPress={onClose}
                    className="bg-transparent border border-default text-secondary hover:bg-muted rounded-lg px-5 py-3 text-sm font-medium transition-all"
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