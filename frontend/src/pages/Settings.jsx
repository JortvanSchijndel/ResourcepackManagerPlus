import React, { useState, useEffect, useCallback, useRef, Suspense, useContext, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import {Button, Input, Label, Dropdown, Modal, TextField, Switch, Tabs, Select, ListBox, toast} from '@heroui/react';
import {
  Trash2,
  Plus,
  ArrowLeft,
  Key,
  User,
  Server,
  RefreshCw,
  Sun,
  Moon,
  AlertTriangle,
  Image as ImageIcon,
  CheckCircle,
  Tags,
  GitBranch,
  SunMoon,
  Github
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/constants';
import { api } from '../services/api';
import { useBranches } from '../hooks/useBranches';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '../components/3d/OrbitControls';
import { MinecraftModel } from '../components/3d/MinecraftModel';

const fetchWithCreds = (url, options = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include',
  });
};

const BRAND_DEFAULT = 'oklch(0.58 0.256 293.597)';

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

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const { user, isAdmin, isDark, themePreference, setThemePreference, branch } = useAuth();
  const navigate = useNavigate();

  // Branch selector state
  const {
    branches,
    currentBranch: selectedAuditBranch,
    setCurrentBranch: setSelectedAuditBranch,
    loading: branchesLoading,
  } = useBranches();

  // State from original component
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('normal');

  // Admin edit user modal state
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('normal');

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
  const [auditIssues, setAuditIssues] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false);
  const [regeneratingAllThumbnails, setRegeneratingAllThumbnails] = useState(false);
  const [currentThumbnailModel, setCurrentThumbnailModel] = useState(null);
  const captureThumbnailRef = useRef(null);

  // Branding state
  const [brandColor, setBrandColor] = useState(BRAND_DEFAULT);
  const [brandIconFile, setBrandIconFile] = useState(null);
  const [brandIconPreview, setBrandIconPreview] = useState(null);
  const [brandName, setBrandName] = useState('');

  const colorInputValue = useMemo(() => {
    const hexRegex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
    return hexRegex.test(brandColor) ? brandColor : '#3b82f6';
  }, [brandColor]);

  // Ensure the branch selector always has a valid branch
  useEffect(() => {
    if (branches.length > 0 && (!selectedAuditBranch || !branches.includes(selectedAuditBranch))) {
      setSelectedAuditBranch(branches[0]);
    }
  }, [branches, selectedAuditBranch, setSelectedAuditBranch]);

  // Fetch functions (mostly unchanged)
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
      setLoading(true);
      if (isAdmin) {
        await fetchUsers();
      }
      await fetchTags();
      await fetchServers();
      await checkHeartbeats();
      setNewSelfUsername(user?.username || '');

      // Fetch branding config (brand color + icon availability)
      try {
        const response = await fetchWithCreds(`${API_URL}/branding`);
        if (response.ok) {
          const data = await response.json();
          if (data?.brand) {
            setBrandColor(data.brand);
            document.documentElement.style.setProperty('--brand', data.brand);
          }
          if (data?.name) {
            setBrandName(data.name);
            try {
              if (data.name) document.title = data.name;
            } catch {
              // ignore
            }
          }
          if (data?.icon) {
            setBrandIconPreview(`${API_URL}/branding/icon`);
          }
        }
      } catch (e) {
        console.error('Failed to fetch branding:', e);
      }

      setLoading(false);
    };
    fetchData();
  }, [isAdmin, user, fetchServers, checkHeartbeats]);

  // Handlers (unchanged)
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
        toast.success(result.message || "Server added successfully");
        setNewServerName('');
        setNewServerUrl('');
        setNewServerApiKey('');
        await fetchServers();
        await checkHeartbeats();
      } else {
        toast.danger(result.error || 'Failed to add server');
      }
    } catch {
      toast.danger('Failed to add server');
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
        toast.success(result.message || "Server deleted successfully");
        await fetchServers();
      } else {
        toast.danger(result.error || 'Failed to delete server');
      }
    } catch {
      toast.danger('Failed to delete server');
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
        toast.success("User created successfully");
        setNewUserOpen(false);
        setNewUsername('');
        setNewPassword('');
        setNewRole('normal');
        await fetchUsers();
      } else {
        const data = await response.json();
        toast.danger(data.error || "Failed to create user");
      }
    } catch {
      toast.danger("An error occurred");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const response = await fetchWithCreds(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        toast.success("User deleted successfully");
        await fetchUsers();
      } else {
        const data = await response.json();
        toast.danger(data.error || "Failed to delete user");
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
        toast.success("User role updated");
        await fetchUsers();
      } else {
        const data = await response.json().catch(() => ({}));
        toast.danger(data.error || "Failed to update role");
      }
    } catch (error) {
      console.error('Error updating role:', error);
      toast.danger("Failed to update role");
    }
  };

  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditRole(u.role);
    setEditPassword('');
    setEditUserOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const payload = { role: editRole, username: editUsername };
      if (editPassword) payload.password = editPassword;

      const response = await fetchWithCreds(`${API_URL}/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast.success("User updated successfully");
        setEditUserOpen(false);
        setEditingUser(null);
        await fetchUsers();
      } else {
        toast.danger(data.error || "Failed to update user");
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.danger("An error occurred");
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
        toast.success("Profile updated successfully");
        setChangePasswordOpen(false);
        setCurrentPassword('');
        setNewSelfPassword('');
      } else {
        const data = await response.json();
        toast.danger(data.error || "Failed to update profile");
      }
    } catch {
      toast.danger("An error occurred");
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
        toast.success("Tag created successfully");
        setNewTag('');
        setNewTagColor('#000000');
        setNewTagGroup('');
        await fetchTags();
      } else {
        const data = await response.json();
        toast.danger(data.error || "Failed to create tag");
      }
    } catch {
      toast.danger("An error occurred");
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
        toast.success("Tag deleted successfully");
        await fetchTags();
      } else {
        const data = await response.json();
        toast.danger(data.error || "Failed to delete tag");
      }
    } catch {
      toast.danger("An error occurred");
    }
  };

  const runAudit = async () => {
    if (!selectedAuditBranch) {
      toast.danger("Select a branch for the audit first.");
      return;
    }
    setAuditLoading(true);
    try {
      const data = await api.auditModels(selectedAuditBranch);
      setAuditIssues(data.issues);
      if (data.issues.length === 0) {
        toast.success("No issues found!");
      }
    } catch (error) {
      console.error("Audit failed:", error);
      toast.danger("Failed to run audit");
    } finally {
      setAuditLoading(false);
    }
  };

  const generateThumbnails = async () => {
    if (!selectedAuditBranch) {
      toast.danger("Select a branch for the audit first.");
      return;
    }
    const missingThumbnails = auditIssues.filter(i => i.issue === "Missing thumbnail");
    if (missingThumbnails.length === 0) {
      toast.info("No missing thumbnails to generate.");
      return;
    }

    setGeneratingThumbnails(true);
    
    for (const issue of missingThumbnails) {
      try {
        const modelData = await api.getModelDetail(selectedAuditBranch, issue.namespace, issue.model_identifier);
        setCurrentThumbnailModel(modelData);
        
        await new Promise(resolve => setTimeout(resolve, 1000)); 
        
        if (captureThumbnailRef.current) {
            const dataUrl = captureThumbnailRef.current();
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            
            await api.updateThumbnail(selectedAuditBranch, issue.namespace, issue.model_identifier, blob);
        }
      } catch (e) {
        console.error(`Failed to generate thumbnail for ${issue.model_identifier}`, e);
      }
    }
    
    setCurrentThumbnailModel(null);
    setGeneratingThumbnails(false);
    toast.success("Thumbnail generation complete");
    runAudit();
  };

  const handleRegenerateAllThumbnails = async () => {
    if (!selectedAuditBranch) {
      toast.danger("Select a branch first.");
      return;
    }
    if (!confirm('Are you sure you want to regenerate ALL thumbnails for this branch? This can take a long time and cannot be undone.')) {
        return;
    }

    setRegeneratingAllThumbnails(true);
    
    try {
        const modelsData = await api.getModels(selectedAuditBranch);
        const allModels = modelsData.models || [];

        if (allModels.length === 0) {
            toast.info("No models found in this branch.");
            setRegeneratingAllThumbnails(false);
            return;
        }

        toast.info(`Starting thumbnail regeneration for ${allModels.length} models. Please wait...`);

        for (const modelInfo of allModels) {
          try {
            const modelData = await api.getModelDetail(selectedAuditBranch, modelInfo.namespace, modelInfo.model_identifier);
            setCurrentThumbnailModel(modelData);
            
            // Give React time to render the model before capturing
            await new Promise(resolve => setTimeout(resolve, 500)); 
            
            if (captureThumbnailRef.current) {
                const dataUrl = captureThumbnailRef.current();
                const res = await fetch(dataUrl);
                const blob = await res.blob();
                
                await api.updateThumbnail(selectedAuditBranch, modelInfo.namespace, modelInfo.model_identifier, blob);
            }
          } catch (e) {
            console.error(`Failed to generate thumbnail for ${modelInfo.namespace}:${modelInfo.model_identifier}`, e);
            toast.danger(`Failed for ${modelInfo.model_identifier}`);
          }
        }
        
        toast.success("All thumbnails have been regenerated successfully.");

    } catch (error) {
        console.error("Failed to fetch models for thumbnail regeneration:", error);
        toast.danger("Could not fetch model list for regeneration.");
    } finally {
        setCurrentThumbnailModel(null);
        setRegeneratingAllThumbnails(false);
    }
  };

  // Branding helpers
  const applyBrandColor = (color) => {
    try {
      document.documentElement.style.setProperty('--brand', color);
    } catch {
      // ignore invalid CSS values
    }
  };

  const handleBrandColorChange = (value) => {
    setBrandColor(value);
    applyBrandColor(value);
  };

  const saveBrandColor = async () => {
    try {
      const response = await fetchWithCreds(`${API_URL}/branding/color`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: brandColor }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success("Brand color saved");
      } else {
        toast.danger(data.error || "Failed to save brand color");
      }
    } catch {
      toast.danger("Failed to save brand color");
    }
  };

  const resetBrandColor = async () => {
    setBrandColor(BRAND_DEFAULT);
    applyBrandColor(BRAND_DEFAULT);
    try {
      await fetchWithCreds(`${API_URL}/branding/color`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: BRAND_DEFAULT }),
      });
      toast.success("Brand color reset");
    } catch {
      // ignore backend failures for reset
    }
  };

  const handleBrandNameChange = (value) => {
    setBrandName(value);
    try {
      if (value) document.title = value;
    } catch {
      // ignore
    }
  };

  const saveBrandName = async () => {
    try {
      const response = await fetchWithCreds(`${API_URL}/branding/name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: brandName }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success("Brand name saved");
      } else {
        toast.danger(data.error || "Failed to save brand name");
      }
    } catch {
      toast.danger("Failed to save brand name");
    }
  };

  const handleIconSelect = (file) => {
    setBrandIconFile(file || null);
    if (file) {
      setBrandIconPreview(URL.createObjectURL(file));
    } else {
      setBrandIconPreview(null);
    }
  };

  const uploadBrandIcon = async () => {
    if (!brandIconFile) {
      toast.danger("Select a PNG 256x256 file first");
      return;
    }
    try {
      const formData = new FormData();
      formData.append('icon', brandIconFile);
      const response = await fetchWithCreds(`${API_URL}/branding/icon`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success("Icon uploaded");
        setBrandIconFile(null);
        setBrandIconPreview(`${API_URL}/branding/icon?ts=${Date.now()}`);
      } else {
        toast.danger(data.error || "Failed to upload icon");
      }
    } catch {
      toast.danger("Failed to upload icon");
    }
  };

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

  const allTabs = [
    { id: 'profile', label: 'Profile', icon: User, admin: false },
    { id: 'branding', label: 'Branding', icon: ImageIcon, admin: true },
    { id: 'tags', label: 'Tag Management', icon: Tags, admin: false },
    { id: 'audit', label: 'Model Audit', icon: AlertTriangle, admin: true },
    { id: 'users', label: 'User Management', icon: User, admin: true },
    { id: 'servers', label: 'Server Management', icon: Server, admin: true },
    { id: 'github_backup', label: 'GitHub Backup', icon: Github, admin: true },
  ];

  const tabs = allTabs.filter(tab => !tab.admin || isAdmin);

  const renderContent = () => {
    if (loading) return <div className="flex justify-center items-center h-full"><p>Loading...</p></div>;

    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2 mb-4">
                {isDark ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6" />} Appearance
              </h2>
              <div className="bg-(--bg-secondary) border border-border rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-(--txt-primary)">Dark Mode</p>
                    <p className="text-sm text-(--txt-secondary)">Toggle between light and dark theme</p>
                  </div>
                  <Tabs
                    aria-label="Theme"
                    selectedKey={themePreference}
                    onSelectionChange={(key) => {
                      setThemePreference(key);
                      if (key === "dark") {
                        document.documentElement.classList.add("dark");
                        document.cookie = "theme=dark; path=/";
                      } else if (key === "light") {
                        document.documentElement.classList.remove("dark");
                        document.cookie = "theme=light; path=/";
                      } else {
                        // system
                        document.cookie = "theme=system; path=/";
                        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                          document.documentElement.classList.add("dark");
                        } else {
                          document.documentElement.classList.remove("dark");
                        }
                      }
                    }}
                    className="w-auto"
                  >
                    <Tabs.ListContainer>
                      <Tabs.List aria-label="Theme">
                        <Tabs.Tab id="light">
                          <Sun className="size-4" />
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="dark">
                          <Moon className="size-4" />
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="system">
                          <SunMoon className="size-4" />
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      </Tabs.List>
                    </Tabs.ListContainer>
                  </Tabs>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2 mb-4">
                <User className="h-6 w-6" /> Profile Settings
              </h2>
              <div className="bg-(--bg-secondary) border border-border rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-(--txt-primary)">Username: {user?.username}</p>
                    <p className="text-sm text-(--txt-secondary)">Role: {user?.role}</p>
                  </div>
                  <Button onPress={() => setChangePasswordOpen(true)}>
                    <Key className="mr-2 h-4 w-4" /> Change Password / Username
                  </Button>
                </div>
              </div>
            </div>

            {/* Branding moved to the dedicated Branding tab */}
          </div>
        );
      case 'branding':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2 mb-4">
              <ImageIcon className="h-6 w-6" /> Branding
            </h2>
            <div className="bg-(--bg-secondary) border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-(--txt-primary)">Name</p>
                  <p className="text-sm text-(--txt-secondary)">Application name / title shown in the browser tab.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input value={brandName} onChange={(e) => handleBrandNameChange(e.target.value)} placeholder="Application name" disabled={!isAdmin} />
                  <div className="flex items-center gap-2">
                    <Button onPress={saveBrandName} className="h-10" disabled={!isAdmin}>Save</Button>
                    {!isAdmin && <span className="text-sm text-(--txt-secondary)">Only admins can change branding.</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-(--txt-primary)">Brand Color</p>
                  <p className="text-sm text-(--txt-secondary)">Choose a brand color using the color picker. This updates the --brand CSS variable.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="color" value={colorInputValue} onChange={(e) => handleBrandColorChange(e.target.value)} className="h-10 w-12 p-0" disabled={!isAdmin} />
                  <div className="flex items-center gap-2">
                    <Button onPress={saveBrandColor} className="h-10" disabled={!isAdmin}>Save</Button>
                    <Button variant="outline" onPress={resetBrandColor} className="h-10" disabled={!isAdmin}>Reset</Button>
                    {!isAdmin && <span className="text-sm text-(--txt-secondary)">Only admins can change branding.</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-(--txt-primary)">Brand Icon (256x256 PNG)</p>
                  <p className="text-sm text-(--txt-secondary)">Upload a 256x256 PNG to be used as an application icon.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 border border-border rounded overflow-hidden bg-(--bg-quaternary) flex items-center justify-center">
                      {brandIconPreview ? <img src={brandIconPreview} alt="icon preview" className="w-full h-full object-cover" /> : <span className="text-sm text-(--txt-secondary)">No icon</span>}
                    </div>
                    <input type="file" accept="image/png" onChange={(e) => handleIconSelect(e.target.files && e.target.files[0])} disabled={!isAdmin} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onPress={uploadBrandIcon} className="h-10" disabled={!isAdmin}>Upload</Button>
                    {!isAdmin && <span className="text-sm text-(--txt-secondary)">Only admins can change branding.</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'tags': {
        const groupedTags = tags.reduce((acc, tag) => {
          const group = tag.group || 'No Group';
          if (!acc[group]) acc[group] = [];
          acc[group].push(tag);
          return acc;
        }, {});

        return <TagManagement
          tags={tags}
          groupedTags={groupedTags}
          handleCreateTag={handleCreateTag}
          newTag={newTag}
          setNewTag={setNewTag}
          newTagColor={newTagColor}
          setNewTagColor={setNewTagColor}
          newTagGroup={newTagGroup}
          setNewTagGroup={setNewTagGroup}
          handleDeleteTag={handleDeleteTag}
          fetchTags={fetchTags}
        />;
      }
      case 'audit':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" /> Model Audit
            </h2>
            <div className="bg-(--bg-secondary) border border-border rounded-lg p-6 space-y-4">
              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <Select
                    className="w-[220px] select--primary"
                    placeholder="Select branch"
                    selectedKey={selectedAuditBranch || ''}
                    onSelectionChange={setSelectedAuditBranch}
                    isDisabled={branchesLoading || auditLoading || generatingThumbnails || regeneratingAllThumbnails}
                  >
                    <Select.Trigger className="select__trigger flex items-center gap-2">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {branches.map((b) => (
                          <ListBox.Item key={b} id={b} textValue={b}>
                            <span className="flex items-center gap-2">
                              <GitBranch size={16} className="text-(--txt-secondary)" />
                              <span>{b}</span>
                            </span>
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <Button onPress={runAudit} disabled={auditLoading || generatingThumbnails || regeneratingAllThumbnails || !selectedAuditBranch}>
                  {auditLoading ? 'Scanning...' : 'Scan for Issues'}
                </Button>
                <Button onPress={handleRegenerateAllThumbnails} disabled={auditLoading || generatingThumbnails || regeneratingAllThumbnails || !selectedAuditBranch}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {regeneratingAllThumbnails ? 'Regenerating...' : 'Regenerate All'}
                </Button>
                {auditIssues.some(i => i.issue === "Missing thumbnail") && (
                  <Button onPress={generateThumbnails} disabled={auditLoading || generatingThumbnails || regeneratingAllThumbnails || !selectedAuditBranch}>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    {generatingThumbnails ? 'Generating...' : `Generate Missing (${auditIssues.filter(i => i.issue === "Missing thumbnail").length})`}
                  </Button>
                )}
              </div>

              {currentThumbnailModel && (
                <div className="fixed top-0 left-0 opacity-0 pointer-events-none w-[256px] h-[256px]">
                   <Canvas gl={{ preserveDrawingBuffer: true }} camera={{ position: [2, 2, 2], fov: 65 }}>
                      <Suspense fallback={null}>
                        <ambientLight intensity={0.6} />
                        <directionalLight position={[5, 5, 5]} intensity={0.8} />
                        <pointLight position={[-5, -5, -5]} intensity={0.3} />
                        <MinecraftModel 
                            modelData={currentThumbnailModel.minecraft_model} 
                            bbModelData={currentThumbnailModel.bbmodel} 
                            branch={branch}
                            namespace={currentThumbnailModel.namespace}
                            modelIdentifier={currentThumbnailModel.model_identifier}
                        />
                        <OrbitControls enableZoom={false} enablePan={false} />
                        <SceneCapture onRegister={(fn) => (captureThumbnailRef.current = fn)} />
                      </Suspense>
                    </Canvas>
                </div>
              )}

              {auditIssues.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm text-(--txt-primary)">
                    <thead className="bg-(--bg-tertiary)">
                      <tr>
                        <th className="p-3 text-left">Namespace</th>
                        <th className="p-3 text-left">Model</th>
                        <th className="p-3 text-left">Issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditIssues.map((issue, idx) => (
                        <tr key={idx} className="border-t border-border bg-(--bg-secondary)">
                          <td className="p-3">{issue.namespace}</td>
                          <td className="p-3">{issue.model_identifier}</td>
                          <td className="p-3 text-red-500">{issue.issue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                !auditLoading && <div className="text-green-500 flex items-center gap-2"><CheckCircle size={16}/> No issues found.</div>
              )}
            </div>
          </div>
        );
      case 'users':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold flex items-center gap-2"><User className="h-6 w-6" /> User Management</h2>
              <Button onPress={() => setNewUserOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add User
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto bg-(--bg-secondary)">
              <table className="w-full text-sm text-(--txt-primary)">
                <thead className="bg-(--bg-tertiary)">
                <tr>
                  <th className="p-4 text-left font-semibold">Username</th>
                  <th className="p-4 text-left font-semibold">Role</th>
                  <th className="p-4 text-right font-semibold">Actions</th>
                </tr>
                </thead>
                <tbody>
                {users.map((u) => (
                    <tr key={u.id} className="border-b border-border">
                      <td className="p-4 font-medium">{u.username}</td>
                      <td className="p-4">
                        <Select className="w-32" defaultValue={u.role} onChange={(key) => handleUpdateRole(u.id, key)} isDisabled={u.id === user?.id}>
                          <Select.Trigger className="select__trigger w-32 justify-between">
                            <Select.Value className="select__value" />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="normal" textValue="normal">Normal</ListBox.Item>
                              <ListBox.Item id="admin" textValue="admin">Admin</ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </td>
                      <td className="p-4 text-right flex justify-end gap-2">
                        <Button size="sm" variant="outline" onPress={() => handleOpenEditUser(u)} isDisabled={u.id === user?.id}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon" color="danger" onPress={() => handleDeleteUser(u.id)} isDisabled={u.id === user?.id}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'servers':
        return (
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
            <div className="bg-(--bg-secondary) border border-border rounded-lg p-6 space-y-6">
              {isAdmin && (
                <form onSubmit={handleAddServer} className="grid grid-cols-4 gap-4 items-end">
                  <TextField>
                    <Label>Server Name</Label>
                    <Input value={newServerName} onChange={(e) => setNewServerName(e.target.value)} required />
                  </TextField>
                  <TextField>
                    <Label>Server URL</Label>
                    <Input value={newServerUrl} onChange={(e) => setNewServerUrl(e.target.value)} required placeholder="http://ip:port" />
                  </TextField>
                  <TextField>
                    <Label>API Key</Label>
                    <Input value={newServerApiKey} onChange={(e) => setNewServerApiKey(e.target.value)} required />
                  </TextField>
                  <div className="flex items-end">
                    <Button type="submit" className="h-10 w-full">Add Server</Button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {servers.map(server => (
                  <div key={server.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-(--bg-tertiary)">
                    <div>
                      <p className="font-medium text-(--txt-primary)">{server.name}</p>
                      <p className="text-sm text-(--txt-secondary)">{server.url}</p>
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
        );
      case 'github_backup':
        return <GithubBackupSettings />;
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-(--bg-primary) text-(--txt-primary) transition-colors ${isDark ? 'dark' : ''}`}>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onPress={() => navigate('/')}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <div className="flex gap-8">
          {/* Left Nav */}
          <aside className="w-1/5">
            <nav className="flex flex-col space-y-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-(--bg-tertiary) text-(--txt-primary) font-semibold'
                      : 'hover:bg-(--bg-secondary) text-(--txt-secondary)'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Right Content */}
          <main className="w-4/5">
            {renderContent()}
          </main>
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={newUserOpen} onOpenChange={setNewUserOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="bg-(--bg-secondary) text-(--txt-primary)">
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
                        <Button variant="outline" className="w-full justify-between">
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
            <Modal.Dialog className="bg-(--bg-secondary) text-(--txt-primary)">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Update Profile</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-1">
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <TextField>
                    <Label>New Username</Label>
                    <Input value={newSelfUsername} onChange={(e) => setNewSelfUsername(e.target.value)} required />
                  </TextField>
                  <TextField>
                    <Label>Current Password <span className="text-red-500">*</span></Label>
                    <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                  </TextField>
                  <TextField>
                    <Label>New Password</Label>
                    <Input 
                      type="password" 
                      value={newSelfPassword} 
                      onChange={(e) => setNewSelfPassword(e.target.value)} 
                      placeholder="Leave blank to keep current" 
                    />
                  </TextField>
                  <Button type="submit" className="w-full">Update Profile</Button>
                </form>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Admin: Edit user modal */}
      <Modal isOpen={editUserOpen} onOpenChange={setEditUserOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="bg-(--bg-secondary) text-(--txt-primary)">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Edit User</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <form onSubmit={handleSaveUser} className="space-y-4">
                  <TextField>
                    <Label>Username</Label>
                    <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} required />
                  </TextField>

                  <TextField>
                    <Label>New Password (leave blank to keep current)</Label>
                    <Input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="New password" />
                  </TextField>

                  <div>
                    <Label className="block mb-2">Role</Label>
                    <Select className="w-full" defaultValue={editRole} onChange={(key) => setEditRole(key)}>
                      <Select.Trigger className="select__trigger w-full">
                        <Select.Value className="select__value" />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="normal" textValue="normal">Normal</ListBox.Item>
                          <ListBox.Item id="admin" textValue="admin">Admin</ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full">Save</Button>
                </form>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
};

function GithubBackupSettings() {
  const [settings, setSettings] = useState({
    repoUrl: '',
    token: '',
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [newToken, setNewToken] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetchWithCreds(`${API_URL}/github/settings`);
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Error fetching github settings:', error);
        toast.danger('Failed to load GitHub settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      const payload = {
        ...settings,
        token: newToken || undefined, // Only send token if it's new
      };
      
      const response = await fetchWithCreds(`${API_URL}/github/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        toast.success('GitHub settings saved');
        setNewToken(''); // Clear the input after saving
      } else {
        const data = await response.json();
        toast.danger(data.error || 'Failed to save settings');
      }
    } catch {
      toast.danger('An error occurred while saving');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <Github className="h-6 w-6" /> GitHub Backup
      </h2>
      <div className="bg-(--bg-secondary) border border-border rounded-lg p-6 space-y-4">
        <Switch
          isSelected={settings.enabled}
          onChange={(isSelected) => setSettings({ ...settings, enabled: isSelected })}
          className="flex items-center justify-between"
        >
          <div>
            <Label>Enable Backup</Label>
            <p className="text-sm text-(--txt-secondary)">
              Automatically back up branches and configuration to a GitHub repository.
            </p>
          </div>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>

        <TextField>
          <Label>Repository URL</Label>
          <Input
            value={settings.repoUrl}
            onChange={(e) => setSettings({ ...settings, repoUrl: e.target.value })}
            placeholder="https://github.com/user/repo.git"
            disabled={!settings.enabled}
          />
        </TextField>

        <TextField>
          <Label>Personal Access Token</Label>
          <Input
            type="password"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            placeholder={settings.token ? 'PAT is currently set' : 'ghp_...'}
            disabled={!settings.enabled}
          />
        </TextField>
        
        <div className="flex justify-end">
          <Button onPress={handleSave} disabled={!settings.enabled}>Save Settings</Button>
        </div>
      </div>
    </div>
  );
}



function TagManagement({
  tags,
  groupedTags,
  handleCreateTag,
  newTag,
  setNewTag,
  newTagColor,
  setNewTagColor,
  newTagGroup,
  setNewTagGroup,
  handleDeleteTag,
  fetchTags,
}) {
  const [editTagModalOpen, setEditTagModalOpen] = useState(false);
  const [tagToEdit, setTagToEdit] = useState(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#000000');
  const [editTagGroup, setEditTagGroup] = useState('');

  // Handler for editing a tag
  const handleEditTag = (tag) => {
    setTagToEdit(tag);
    setEditTagName(tag.tag);
    setEditTagColor(tag.color || '#000000');
    setEditTagGroup(tag.group || '');
    setEditTagModalOpen(true);
  };

  const handleUpdateTag = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/tags/${tagToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tag: editTagName,
          color: editTagColor,
          group: editTagGroup,
        }),
      });
      if (response.ok) {
        toast.success("Tag updated");
        setEditTagModalOpen(false);
        setTagToEdit(null);
        await fetchTags();
      } else {
        const data = await response.json();
        toast.danger(data.error || "Update failed");
      }
    } catch {
      toast.danger("An error occurred");
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <Tags className="h-6 w-6" /> Tag Management
      </h2>
      <div className="bg-(--bg-secondary) border border-border rounded-lg p-6 space-y-6">
        <form onSubmit={handleCreateTag} className="flex gap-4 items-end flex-nowrap w-full">
          <TextField className="flex-1 min-w-0">
            <Label>Tag Name</Label>
            <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} required />
          </TextField>
          <TextField className="w-28 flex-shrink-0">
            <Label>Color</Label>
            <Input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="h-10 p-1" />
          </TextField>
          <TextField className="flex-1 min-w-0">
            <Label>Group (Optional)</Label>
            <Input value={newTagGroup} onChange={(e) => setNewTagGroup(e.target.value)} />
          </TextField>
          <Button type="submit" className="h-10 w-32 flex-shrink-0">Add Tag</Button>
        </form>

        <div className="space-y-6">
          {Object.entries(groupedTags).map(([group, groupTags]) => (
            <div key={group}>
              <div className="font-semibold text-(--txt-secondary) mb-2">{group}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupTags.map((tag, index) => (
                  <div key={tag.id || index} className="flex items-center justify-between p-3 border rounded-lg bg-(--bg-primary)">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color || '#808080' }}></div>
                      <span className="text-(--txt-primary)">{tag.tag}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" color="primary" onPress={() => handleEditTag(tag)}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z" />
                        </svg>
                      </Button>
                      <Button size="sm" variant="ghost" color="danger" onPress={() => handleDeleteTag(tag.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={editTagModalOpen} onOpenChange={setEditTagModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="bg-(--bg-secondary) text-(--txt-primary)">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Edit Tag</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <form onSubmit={handleUpdateTag} className="space-y-4">
                  <TextField>
                    <Label>Tag Name</Label>
                    <Input value={editTagName} onChange={e => setEditTagName(e.target.value)} required />
                  </TextField>
                  <TextField>
                    <Label>Color</Label>
                    <Input type="color" value={editTagColor} onChange={e => setEditTagColor(e.target.value)} className="h-10 p-1" />
                  </TextField>
                  <TextField>
                    <Label>Group (optional)</Label>
                    <Input value={editTagGroup} onChange={e => setEditTagGroup(e.target.value)} />
                  </TextField>
                  <Button type="submit" className="w-full">Save</Button>
                </form>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

export default Settings;
export { Settings };
