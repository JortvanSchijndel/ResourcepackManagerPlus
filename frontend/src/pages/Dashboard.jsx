import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/layout/TopBar';
import { Toast } from '../components/layout/Toast';
import { Toolbar } from '../components/common/Toolbar';
import { ModelGrid } from '../components/models/ModelGrid';
import { UploadModal } from '../components/modals/UploadModal';
import { EditModal } from '../components/modals/EditModal';
import { CopyMoveModal } from '../components/modals/CopyMoveModal';
import { NewBranchModal } from '../components/modals/NewBranchModal';
import { MergeModal } from '../components/modals/MergeModal';
import { PushToServerModal } from '../components/modals/PushToServerModal';
import { RawEditor } from './RawEditor';
import { useBranches } from '../hooks/useBranches';
import { useModels } from '../hooks/useModels';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export const Dashboard = () => {
  const { message, showMessage } = useToast();
  const { logout, isDark, setIsDark, branch, setBranch } = useAuth();
  const navigate = useNavigate();
  
  const {
    branches,
    currentBranch,
    setCurrentBranch,
    loading: branchLoading,
    createBranch,
    deleteBranch,
    mergeBranches,
  } = useBranches();

  // Sync branch state with useAuth
  useEffect(() => {
    if (currentBranch !== branch) {
      setBranch(currentBranch);
    }
  }, [currentBranch, branch, setBranch]);

  // If branch changes in settings (via useAuth), update local state
  useEffect(() => {
    if (branch && branch !== currentBranch) {
      setCurrentBranch(branch);
    }
  }, [branch, currentBranch, setCurrentBranch]);

  const {
    models,
    modelPreviews,
    loading: modelLoading,
    uploadModel,
    updateModel,
    deleteModel,
    copyModel,
    downloadBBModel,
    downloadPack,
  } = useModels(currentBranch);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTags, setFilterTags] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCopyMove, setShowCopyMove] = useState(false);
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showPushToServer, setShowPushToServer] = useState(false);
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [servers, setServers] = useState([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [tagsRes, serversRes] = await Promise.all([
          api.getTags(),
          api.getServers(),
        ]);
        setAvailableTags(tagsRes.tags || []);
        setServers(serversRes.servers || []);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        showMessage('Could not load tags or servers.', 'error');
      }
    };
    fetchInitialData();
  }, []);

  const handleUpload = async (formData) => {
    const result = await uploadModel(formData);
    if (result.success) {
      showMessage(result.message);
      setShowUpload(false);
    } else {
      showMessage(result.message, 'error');
    }
  };

  const handleEdit = async (formData) => {
    const result = await updateModel(
      selectedModel.namespace,
      selectedModel.model_identifier,
      formData
    );
    if (result.success) {
      showMessage(result.message);
      setShowEdit(false);
      setSelectedModel(null); 
    } else {
      showMessage(result.message, 'error');
    }
  };

  const handleDelete = async (model) => {
    if (!window.confirm(`Delete model "${model.name}"?`)) return;
    const result = await deleteModel(model);
    if (result.success) {
      showMessage(result.message);
    } else {
      showMessage(result.message, 'error');
    }
  };

  const handleCopyMove = async (data) => {
    const result = await copyModel(data);
    if (result.success) {
      showMessage(result.message);
      setShowCopyMove(false);
    } else {
      showMessage(result.message, 'error');
    }
  };

  const handleCreateBranch = async (name, copyFrom) => {
    const result = await createBranch(name, copyFrom);
    if (result.success) {
      showMessage(result.message);
      setShowNewBranch(false);
    } else {
      showMessage(result.message, 'error');
    }
  };

  const handleDeleteBranch = async (branch) => {
    if (!window.confirm(`Delete branch "${branch}"?`)) return;
    const result = await deleteBranch(branch);
    if (result.success) {
      showMessage(result.message);
    } else {
      showMessage(result.message, 'error');
    }
  };

  const handleMerge = async (source, target, operations) => {
    const result = await mergeBranches(source, target, operations);
    if (result.success) {
      showMessage(result.message);
      setShowMerge(false);
    } else {
      showMessage(result.message, 'error');
    }
  };
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredModels = models.filter((model) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      model.name.toLowerCase().includes(query) ||
      model.namespace.toLowerCase().includes(query) ||
      model.model_identifier.toLowerCase().includes(query);
    const matchesCategory = !filterCategory || model.namespace === filterCategory;
    
    const matchesTags = filterTags.length === 0 || (model.tags && filterTags.every(tagId => {
      return model.tags.some(t => {
        const tId = typeof t === 'object' ? t.id : t;
        return tId === tagId;
      });
    }));

    return matchesSearch && matchesCategory && matchesTags;
  });

  const uniqueCategories = [...new Set(models.map((m) => m.namespace))].sort();

  if (showRawEditor) {
    return (
      <div className={isDark ? 'dark' : ''}>
        <RawEditor 
          onBack={() => setShowRawEditor(false)} 
          currentBranch={currentBranch}
          isDark={isDark}
        />
      </div>
    );
  }

return (
  <div className={isDark ? 'dark' : ''}>
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <TopBar
        branches={branches}
        currentBranch={currentBranch}
        onBranchChange={setCurrentBranch}
        onNewBranch={() => setShowNewBranch(true)}
        onDeleteBranch={handleDeleteBranch}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onLogout={handleLogout}
      />

      <div className="max-w-400 mx-auto p-8">
        <Toolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterCategory={filterCategory}
          onFilterCategoryChange={setFilterCategory}
          filterTags={filterTags}
          onFilterTagsChange={setFilterTags}
          categories={uniqueCategories}
          tags={availableTags}
          onUpload={() => setShowUpload(true)}
          onDownloadPack={downloadPack}
          onMerge={() => setShowMerge(true)}
          onRawEditor={() => setShowRawEditor(true)}
          servers={servers}
          currentBranch={currentBranch}
          onPush={() => setShowPushToServer(true)}
        />

        <ModelGrid
          models={filteredModels}
          modelPreviews={modelPreviews}
          onEdit={(model) => {
            setSelectedModel(model);
            setShowEdit(true);
          }}
          onDownload={downloadBBModel}
          onCopyMove={(model) => {
            setSelectedModel(model);
            setShowCopyMove(true);
          }}
          onDelete={handleDelete}
          branch={currentBranch}
        />
      </div>

      <UploadModal
        show={showUpload}
        onClose={() => setShowUpload(false)}
        onUpload={handleUpload}
        categories={uniqueCategories}
        loading={modelLoading}
        existingModels={models}
      />

      <EditModal
        show={showEdit}
        model={selectedModel}
        categories={uniqueCategories}
        onClose={() => {
          setShowEdit(false);
          setSelectedModel(null);
        }}
        onSave={handleEdit}
        loading={modelLoading}
      />

      <CopyMoveModal
        show={showCopyMove}
        model={selectedModel}
        branches={branches}
        currentBranch={currentBranch}
        onClose={() => {
          setShowCopyMove(false);
          setSelectedModel(null);
        }}
        onSubmit={handleCopyMove}
        loading={modelLoading}
      />

      <NewBranchModal
        show={showNewBranch}
        branches={branches}
        currentBranch={currentBranch}
        onClose={() => setShowNewBranch(false)}
        onSubmit={handleCreateBranch}
        loading={branchLoading}
      />

      <MergeModal
        show={showMerge}
        branches={branches}
        onClose={() => setShowMerge(false)}
        onSubmit={handleMerge}
        loading={branchLoading}
      />

      <PushToServerModal
        show={showPushToServer}
        onClose={() => setShowPushToServer(false)}
        servers={servers}
        currentBranch={currentBranch}
      />

      <Toast message={message} />
    </div>
  </div>
);
};