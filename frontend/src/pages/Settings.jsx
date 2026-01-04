import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button, Input, Label, Dropdown, Modal, TextField } from '@heroui/react';
import { Trash2, Plus, ArrowLeft, Key, User, Server, RefreshCw } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/constants';

const fetchWithCreds = (url, options = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include',
  });
};

const Settings = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const { showMessage } = useToast();
  const navigate = useNavigate();

  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('normal');

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newSelfPassword, setNewSelfPassword] = useState('');
  const [newSelfUsername, setNewSelfUsername] = useState('');

  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState('#000000');
  const [newTagGroup, setNewTagGroup] = useState('');

  const [servers, setServers] = useState([]);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newServerApiKey, setNewServerApiKey] = useState('');
  const [heartbeatLoading, setHeartbeatLoading] = useState(false);

  const fetchServers = useCallback(async () => {
    try {
      const response = await fetchWithCreds(`${API_URL}/servers`);
      const data = await response.json();
      setServers(data.servers.map(s => ({ ...s, connected: null })));
    } catch (error) {
      console.error('Error fetching servers:', error);
    }
  }, []);

  const checkHeartbeats = useCallback(async () => {
    setHeartbeatLoading(true);
    try {
      const response = await fetchWithCreds(`${API_URL}/servers/heartbeat`);
      const data = await response.json();
      setServers(prevServers =>
        prevServers.map(server => {
          const status = data.statuses.find(s => s.id === server.id);
          return status ? { ...server, connected: status.connected } : server;
        })
      );
    } catch (error) {
      console.error('Error checking heartbeats:', error);
    } finally {
      setHeartbeatLoading(false);
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetchWithCreds(`${API_URL}/users`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetchWithCreds(`${API_URL}/tags`);
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };
  
  useEffect(() => {
    const fetchData = async () => {
      if (isAdmin) {
        await fetchUsers();
      }
      await fetchTags();
      await fetchServers();
      await checkHeartbeats();
      setNewSelfUsername(user?.username || '');
      setLoading(false);
    };
    fetchData();
  }, [isAdmin, user, fetchServers, checkHeartbeats]);

  const handleAddServer = async (e) => {
    e.preventDefault();
    try {
      const response = await fetchWithCreds(`${API_URL}/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newServerName, url: newServerUrl, api_key: newServerApiKey }),
      });
      const result = await response.json();
      if (response.ok) {
        showMessage(result.message || "Server added successfully");
        setNewServerName('');
        setNewServerUrl('');
        setNewServerApiKey('');
        await fetchServers();
        await checkHeartbeats();
      } else {
        showMessage(result.error || 'Failed to add server', 'error');
      }
    } catch (error) {
      showMessage('Failed to add server', 'error');
    }
  };

  const handleDeleteServer = async (serverId) => {
    if (!confirm('Are you sure you want to delete this server?')) return;
    try {
      const response = await fetchWithCreds(`${API_URL}/servers/${serverId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (response.ok) {
        showMessage(result.message || "Server deleted successfully");
        await fetchServers();
      } else {
        showMessage(result.error || 'Failed to delete server', 'error');
      }
    } catch (error) {
      showMessage('Failed to delete server', 'error');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await fetchWithCreds(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });

      if (response.ok) {
        showMessage("User created successfully");
        setNewUserOpen(false);
        setNewUsername('');
        setNewPassword('');
        setNewRole('normal');
        await fetchUsers();
      } else {
        const data = await response.json();
        showMessage(data.error || "Failed to create user", 'error');
      }
    } catch (error) {
      showMessage("An error occurred", 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await fetchWithCreds(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        showMessage("User deleted successfully");
        await fetchUsers();
      } else {
        const data = await response.json();
        showMessage(data.error || "Failed to delete user", 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const response = await fetchWithCreds(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (response.ok) {
        showMessage("User role updated");
        await fetchUsers();
      }
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const response = await fetchWithCreds(`${API_URL}/me/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newSelfUsername,
          currentPassword: currentPassword,
          newPassword: newSelfPassword
        }),
      });

      if (response.ok) {
        showMessage("Profile updated successfully");
        setChangePasswordOpen(false);
        setCurrentPassword('');
        setNewSelfPassword('');
      } else {
        const data = await response.json();
        showMessage(data.error || "Failed to update profile", 'error');
      }
    } catch (error) {
      showMessage("An error occurred", 'error');
    }
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    try {
      const response = await fetchWithCreds(`${API_URL}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: newTag, color: newTagColor, group: newTagGroup }),
      });

      if (response.ok) {
        showMessage("Tag created successfully");
        setNewTag('');
        setNewTagColor('#000000');
        setNewTagGroup('');
        await fetchTags();
      } else {
        const data = await response.json();
        showMessage(data.error || "Failed to create tag", 'error');
      }
    } catch (error) {
      showMessage("An error occurred", 'error');
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;
    try {
      const response = await fetchWithCreds(`${API_URL}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tagId }),
      });

      if (response.ok) {
        showMessage("Tag deleted successfully");
        await fetchTags();
      } else {
        const data = await response.json();
        showMessage(data.error || "Failed to delete tag", 'error');
      }
    } catch (error) {
      showMessage("An error occurred", 'error');
    }
  };

  if (loading) return <div>Loading...</div>;

  const StatusIndicator = ({ connected }) => {
    let bgColor = 'bg-gray-400';
    let text = 'Checking...';

    if (connected === true) {
      bgColor = 'bg-green-500';
      text = 'Connected';
    } else if (connected === false) {
      bgColor = 'bg-red-500';
      text = 'Disconnected';
    }

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${bgColor}`}>
        {text}
      </span>
    );
  };

  return (
      <div className="p-6 space-y-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onPress={() => navigate('/')}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        {/* Profile Settings */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <User className="h-6 w-6" /> Profile Settings
          </h2>
          <div className="bg-card border border-card rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Username: {user?.username}</p>
                <p className="text-sm text-muted">Role: {user?.role}</p>
              </div>
              <Button onPress={() => setChangePasswordOpen(true)}>
                <Key className="mr-2 h-4 w-4" /> Change Password / Username
              </Button>
            </div>
          </div>
        </div>

        {/* Tag Management (Visible to all) */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Tag Management</h2>
          <div className="bg-card border border-card rounded-lg p-6 space-y-6">
            <form onSubmit={handleCreateTag} className="flex gap-4 items-end">
              <TextField className="flex-1">
                <Label>Tag Name</Label>
                <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} required />
              </TextField>
              <TextField className="w-32">
                <Label>Color</Label>
                <Input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="h-10 p-1" />
              </TextField>
              <TextField className="flex-1">
                <Label>Group (Optional)</Label>
                <Input value={newTagGroup} onChange={(e) => setNewTagGroup(e.target.value)} />
              </TextField>
              <Button type="submit">Add Tag</Button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tags.map((tag, index) => {
                const tagId = typeof tag === 'object' ? tag.id : tag;
                const tagName = typeof tag === 'object' ? tag.tag : tag;
                const tagColor = typeof tag === 'object' ? tag.color : '#808080';

                return (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-background">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tagColor }}></div>
                        <span>{tagName}</span>
                      </div>
                      <Button size="sm" variant="ghost" color="danger" onPress={() => handleDeleteTag(tagId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Server Management */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Server className="h-6 w-6" /> Server Management
            </h2>
            <Button variant="outline" size="sm" onPress={checkHeartbeats} disabled={heartbeatLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${heartbeatLoading ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>
          </div>
          <div className="bg-card border border-card rounded-lg p-6 space-y-6">
            {isAdmin && (
              <form onSubmit={handleAddServer} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <TextField className="md:col-span-1">
                  <Label>Server Name</Label>
                  <Input value={newServerName} onChange={(e) => setNewServerName(e.target.value)} required />
                </TextField>
                <TextField className="md:col-span-1">
                  <Label>Server URL</Label>
                  <Input value={newServerUrl} onChange={(e) => setNewServerUrl(e.target.value)} required placeholder="http://ip:port" />
                </TextField>
                <TextField className="md:col-span-1">
                  <Label>API Key</Label>
                  <Input value={newServerApiKey} onChange={(e) => setNewServerApiKey(e.target.value)} required />
                </TextField>
                <Button type="submit" className="self-end h-10">Add Server</Button>
              </form>
            )}

            <div className="space-y-4">
              {servers.map(server => (
                <div key={server.id} className="flex items-center justify-between p-3 border rounded-lg bg-(--secondary)">
                  <div>
                    <p className="font-medium">{server.name}</p>
                    <p className="text-sm text-(--text-secondary)">{server.url}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusIndicator connected={server.connected} />
                    {isAdmin && (
                      <Button size="sm" variant="ghost" color="danger" onPress={() => handleDeleteServer(server.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Management (Admin Only) */}
        {isAdmin && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">User Management</h2>
                <Button onPress={() => setNewUserOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add User
                </Button>
              </div>

              <div className="border border-card rounded-lg overflow-x-auto">
                <table className="w-full text-sm bg-(--card)">
                  <thead className="bg-(--secondary)">
                  <tr>
                    <th className="p-4 text-left font-semibold">Username</th>
                    <th className="p-4 text-left font-semibold">Role</th>
                    <th className="p-4 text-right font-semibold">Actions</th>
                  </tr>
                  </thead>
                  <tbody>
                  {users.map((u) => (
                      <tr key={u.id} className="border-b border-card">
                        <td className="p-4 font-medium">{u.username}</td>
                        <td className="p-4">
                          <Dropdown>
                            <Dropdown.Trigger asChild>
                              <Button className="w-32 justify-between" isDisabled={u.id === user?.id}>
                                {u.role}
                              </Button>
                            </Dropdown.Trigger>
                            <Dropdown.Popover>
                              <Dropdown.Menu onAction={(key) => handleUpdateRole(u.id, key)}>
                                <Dropdown.Item id="normal">Normal</Dropdown.Item>
                                <Dropdown.Item id="admin">Admin</Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                        </td>
                        <td className="p-4 text-right">
                          <Button variant="ghost" size="icon" onPress={() => handleDeleteUser(u.id)} isDisabled={u.id === user?.id}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
        )}

        {/* Modals */}
        <Modal isOpen={newUserOpen} onOpenChange={setNewUserOpen}>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Create New User</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <TextField>
                      <Label>Username</Label>
                      <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
                    </TextField>
                    <TextField>
                      <Label>Password</Label>
                      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                    </TextField>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Dropdown>
                        <Dropdown.Trigger asChild>
                          <Button className="w-full justify-between">
                            {newRole}
                          </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover>
                          <Dropdown.Menu onAction={setNewRole}>
                            <Dropdown.Item id="normal">Normal</Dropdown.Item>
                            <Dropdown.Item id="admin">Admin</Dropdown.Item>
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                    </div>
                    <Button type="submit" className="w-full">Create User</Button>
                  </form>
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>

        <Modal isOpen={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Update Profile</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <TextField>
                      <Label>Username</Label>
                      <Input value={newSelfUsername} onChange={(e) => setNewSelfUsername(e.target.value)} required />
                    </TextField>
                    <TextField>
                      <Label>Current Password (Required)</Label>
                      <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                    </TextField>
                    <TextField>
                      <Label>New Password (Optional)</Label>
                      <Input type="password" value={newSelfPassword} onChange={(e) => setNewSelfPassword(e.g.value)} placeholder="Leave blank to keep current" />
                    </TextField>
                    <Button type="submit" className="w-full">Update Profile</Button>
                  </form>
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </div>
  );
};

export default Settings;