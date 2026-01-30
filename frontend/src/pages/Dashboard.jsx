import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from '../components/layout/TopBar';
import { Toolbar } from '../components/layout/Toolbar';
import { ModelGrid } from '../components/3d/ModelGrid';
import { UploadModal } from '../components/modals/UploadModal';
import { EditModelModal } from '../components/modals/EditModelModal';
import { CopyMoveModal } from '../components/modals/CopyMoveModal';
import { NewBranchModal } from '../components/modals/NewBranchModal';
import { MergeModal } from '../components/modals/MergeModal';
import { PushToServerModal } from '../components/modals/PushToServerModal';
import { RawEditor } from './RawEditor';
import { useBranches } from '../hooks/useBranches';
import { useModels } from '../hooks/useModels';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Toast, toast } from '@heroui/react';

export const Dashboard = () => {
  const { logout, isDark, branch, setBranch } = useAuth();
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

  useEffect(() => {
    if (currentBranch !== branch) {
      setBranch(currentBranch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBranch]);

  useEffect(() => {
    if (branch && branch !== currentBranch) {
      setCurrentBranch(branch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

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
  const [categoriesList, setCategoriesList] = useState([]);

  const fetchInitialData = async () => {
    try {
      const [tagsRes, serversRes, namespacesRes] = await Promise.all([
        api.getTags(),
        api.getServers(),
        api.getNamespaces(),
      ]);
      setAvailableTags(tagsRes.tags || []);
      setServers(serversRes.servers || []);
      // api.getNamespaces() returns an object with { namespaces, categories } for compatibility
      const namespaces = (namespacesRes && (namespacesRes.namespaces || namespacesRes.categories)) || [];
      setCategoriesList(Array.isArray(namespaces) ? namespaces : []);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast.danger('Could not load tags, servers, or categories.');
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleAddCategory = async (category) => {
    try {
      const res = await api.createCategory(category);
      if (res.success) {
        setCategoriesList(res.categories);
        return res;
      } else {
        throw new Error(res.error || 'Failed to create category');
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleDeleteCategory = async (category) => {
    try {
      const res = await api.deleteCategory(category);
      if (res.success) {
        setCategoriesList(res.categories);
        if (filterCategory === category) setFilterCategory('');
        return res;
      } else {
        throw new Error(res.error || 'Failed to delete category');
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const handleUpload = useCallback(async (formData) => {
    const result = await uploadModel(formData);
    if (result.success) {
      toast.success(result.message);
      setShowUpload(false);
      // Refresh categories in case a new one was created implicitly (though we prefer explicit creation)
      fetchInitialData();
    } else {
      toast.danger(result.message);
    }
  }, [uploadModel]);

  const handleEdit = useCallback(async (formData) => {
    const result = await updateModel(
      selectedModel.namespace,
      selectedModel.model_identifier,
      formData
    );
    if (result.success) {
      toast.success(result.message);
      setShowEdit(false);
      setSelectedModel(null); 
      fetchInitialData();
    } else {
      toast.danger(result.message);
    }
  }, [updateModel, selectedModel]);

  const handleDelete = useCallback(async (model) => {
    if (!window.confirm(`Delete model "${model.name}"?`)) return;
    const result = await deleteModel(model);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.danger(result.message);
    }
  }, [deleteModel]);

  const handleCopyMove = useCallback(async (data) => {
    const result = await copyModel(data);
    if (result.success) {
      toast.success(result.message);
      setShowCopyMove(false);
    } else {
      toast.danger(result.message);
    }
  }, [copyModel]);

  const handleCreateBranch = useCallback(async (name, copyFrom) => {
    const result = await createBranch(name, copyFrom);
    if (result.success) {
      toast.success(result.message);
      setShowNewBranch(false);
    } else {
      toast.danger(result.message);
    }
  }, [createBranch]);

  const handleDeleteBranch = useCallback(async (branch) => {
    if (!window.confirm(`Delete branch "${branch}"?`)) return;
    const result = await deleteBranch(branch);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.danger(result.message);
    }
  }, [deleteBranch]);

  const handleMerge = useCallback(async (source, target, operations) => {
    const result = await mergeBranches(source, target, operations);
    if (result.success) {
      toast.success(result.message);
      setShowMerge(false);
    } else {
      toast.danger(result.message);
    }
  }, [mergeBranches]);
  
  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const filteredModels = models.filter((model) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      model.name.toLowerCase().includes(query) ||
      model.namespace.toLowerCase().includes(query) ||
      model.model_identifier.toLowerCase().includes(query);
    
    // Check if model namespace starts with the filter category (handles subcategories)
    const matchesCategory = !filterCategory || 
                            model.namespace === filterCategory || 
                            model.namespace.startsWith(filterCategory + '/');
    
    const matchesTags = filterTags.length === 0 || (model.tags && filterTags.every(tagId => {
      return model.tags.some(t => {
        const tId = typeof t === 'object' ? t.id : t;
        return tId === tagId;
      });
    }));

    return matchesSearch && matchesCategory && matchesTags;
  });

  const uniqueCategories = [...new Set(models.map((m) => m.namespace))].sort((a, b) => a.localeCompare(b));
  const displayCategories = categoriesList.length ? categoriesList : uniqueCategories;

  if (showRawEditor) {
    return (
      <RawEditor 
        onBack={() => setShowRawEditor(false)} 
        currentBranch={currentBranch}
      />
    );
  }

return (
  <div className={isDark ? 'dark' : ''}>
    <div className="min-h-screen transition-colors">
      <TopBar
        branches={branches}
        currentBranch={currentBranch}
        onBranchChange={setCurrentBranch}
        onNewBranch={() => setShowNewBranch(true)}
        onDeleteBranch={handleDeleteBranch}
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
          categories={displayCategories}
          tags={availableTags}
          onUpload={() => setShowUpload(true)}
          onDownloadPack={downloadPack}
          onMerge={() => setShowMerge(true)}
          onRawEditor={() => setShowRawEditor(true)}
          servers={servers}
          currentBranch={currentBranch}
          onPush={() => setShowPushToServer(true)}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
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
        categories={displayCategories}
        loading={modelLoading}
        existingModels={models}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      <EditModelModal
        show={showEdit}
        model={selectedModel}
        categories={displayCategories}
        onClose={() => {
          setShowEdit(false);
          setSelectedModel(null);
        }}
        onSave={handleEdit}
        loading={modelLoading}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
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

      <PushToServerModal
        show={showPushToServer}
        onClose={() => setShowPushToServer(false)}
        servers={servers}
        currentBranch={currentBranch}
      />

      <MergeModal
        show={showMerge}
        branches={branches}
        onClose={() => setShowMerge(false)}
        onSubmit={handleMerge}
        loading={branchLoading}
      />

      <Toast.Container />
    </div>
  </div>
);
};
