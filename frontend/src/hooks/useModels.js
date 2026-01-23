import { useState, useEffect } from 'react';
import { api } from '../services/api';

export const useModels = (currentBranch) => {
  const [models, setModels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modelPreviews, setModelPreviews] = useState({});
  const [loading, setLoading] = useState(false);

  const loadModels = async () => {
    if (!currentBranch) return;

    try {
      const data = await api.getModels(currentBranch);
      const modelsList = data.models || [];
      setModels(modelsList);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await api.getNamespaces();
      setCategories(data.namespaces || []);
    } catch (error) {
      console.error('Error loading namespaces:', error);
    }
  };

  const uploadModel = async (formData) => {
    setLoading(true);
    try {
      await api.uploadModel(currentBranch, formData);
      await loadModels();
      await loadCategories();
      return { success: true, message: 'Model uploaded successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  const updateModel = async (namespace, modelIdentifier, formData) => {
    setLoading(true);
    try {
      await api.updateModel(currentBranch, namespace, modelIdentifier, formData);
      await loadModels();
      await loadCategories();
      return { success: true, message: 'Model updated successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  const deleteModel = async (model) => {
    try {
      await api.deleteModel(currentBranch, model.namespace, model.model_identifier);
      await loadModels();
      return { success: true, message: 'Model deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const copyModel = async (copyData) => {
    setLoading(true);
    try {
      const data = await api.copyModel(copyData);
      await loadModels();
      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentBranch) {
      loadModels();
      loadCategories();
    }
  }, [currentBranch]);

  return {
    models,
    categories,
    modelPreviews,
    loading,
    loadCategories,
    uploadModel,
    updateModel,
    deleteModel,
    copyModel,
    refreshModels: loadModels,
    downloadBBModel: (model) => api.downloadBBModel(currentBranch, model.namespace, model.model_identifier),
    downloadPack: () => api.downloadPack(currentBranch),
  };
};