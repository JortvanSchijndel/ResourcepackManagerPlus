import { useState, useEffect } from 'react';
import { api } from '../services/api';

export const useBranches = () => {
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('dev');
  const [loading, setLoading] = useState(false);

  const loadBranches = async () => {
    try {
      const data = await api.getBranches();
      setBranches(data.branches || []);
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const createBranch = async (name, copyFrom) => {
    setLoading(true);
    try {
      const data = await api.createBranch(name, copyFrom);
      await loadBranches();
      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  const deleteBranch = async (branch) => {
    try {
      const data = await api.deleteBranch(branch);
      if (currentBranch === branch) setCurrentBranch('dev');
      await loadBranches();
      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const compareBranches = async (source, target) => {
    setLoading(true);
    try {
      const data = await api.compareBranches(source, target);
      return { success: true, differences: data.differences };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  const compareFileContent = async (source, target, path) => {
    try {
      const data = await api.compareFileContent(source, target, path);
      return { success: true, ...data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const mergeBranches = async (source, target, operations = null) => {
    setLoading(true);
    try {
      const data = await api.mergeBranches(source, target, operations);
      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, message: error.message };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  return {
    branches,
    currentBranch,
    setCurrentBranch,
    loading,
    createBranch,
    deleteBranch,
    compareBranches,
    compareFileContent,
    mergeBranches,
    refreshBranches: loadBranches,
  };
};