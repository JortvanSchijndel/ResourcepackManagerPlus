import { API_URL } from '../config/constants';

// Helper to handle credentials (cookies)
const fetchWithCreds = (url, options = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include',
  });
};

export const api = {
  pushToServer: async (branch, serverId) => {
    const response = await fetchWithCreds(`${API_URL}/push-to-server`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, serverId }),
    });
    return response.json();
  },

  renameTagGroup: async (oldGroupName, newGroupName) => {
    const response = await fetchWithCreds(`${API_URL}/tag-groups/${encodeURIComponent(oldGroupName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_group_name: newGroupName }),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to rename tag group');
    }
    return data;
  },

  // Servers
  getServers: async () => {
    const response = await fetchWithCreds(`${API_URL}/servers`);
    return response.json();
  },

  // Branches
  getBranches: async () => {
    const response = await fetchWithCreds(`${API_URL}/branches`);
    return response.json();
  },

  createBranch: async (name, copyFrom) => {
    const response = await fetchWithCreds(`${API_URL}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, copyFrom }),
    });
    return response.json();
  },

  deleteBranch: async (branch) => {
    const response = await fetchWithCreds(`${API_URL}/branches/${branch}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  // Models
  getModels: async (branch) => {
    const response = await fetchWithCreds(`${API_URL}/models/${branch}`);
    return response.json();
  },

  getModelDetail: async (branch, namespace, modelIdentifier) => {
    const response = await fetchWithCreds(
      `${API_URL}/model/${branch}/${namespace}/${modelIdentifier}`
    );
    return response.json();
  },

  uploadModel: async (branch, formData) => {
    const response = await fetchWithCreds(`${API_URL}/upload/${branch}`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  updateModel: async (branch, namespace, modelIdentifier, formData) => {
    const response = await fetchWithCreds(
      `${API_URL}/model/${branch}/${namespace}/${modelIdentifier}`, 
      {
        method: 'POST',
        body: formData,
      }
    );
    return response.json();
  },

  deleteModel: async (branch, namespace, modelIdentifier) => {
    const response = await fetchWithCreds(
      `${API_URL}/model/${branch}/${namespace}/${modelIdentifier}`,
      { method: 'DELETE' }
    );
    return response.json();
  },

  copyModel: async (data) => {
    const response = await fetchWithCreds(`${API_URL}/copy-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  approveModel: async (branch, namespace, modelIdentifier) => {
    const response = await fetchWithCreds(
      `${API_URL}/model/${branch}/${namespace}/${modelIdentifier}/approve`,
      { method: 'POST' }
    );
    return response.json();
  },

  addComment: async (branch, namespace, modelIdentifier, text) => {
    const response = await fetchWithCreds(
      `${API_URL}/model/${branch}/${namespace}/${modelIdentifier}/comment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }
    );
    return response.json();
  },

  // Namespaces (Categories)
  getNamespaces: async () => {
    const response = await fetchWithCreds(`${API_URL}/namespaces`);
    return response.json();
  },

  // Merge
  compareBranches: async (source, target) => {
    const response = await fetchWithCreds(`${API_URL}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, target }),
    });
    return response.json();
  },

  compareFileContent: async (source, target, path) => {
    const response = await fetchWithCreds(`${API_URL}/compare/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, target, path }),
    });
    return response.json();
  },

  mergeBranches: async (source, target, operations = null) => {
    const response = await fetchWithCreds(`${API_URL}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, target, operations }),
    });
    return response.json();
  },

  // Downloads
  downloadBBModel: (branch, namespace, modelIdentifier) => {
    window.open(
      `${API_URL}/download/bbmodel/${branch}/${namespace}/${modelIdentifier}`,
      '_blank'
    );
  },

  downloadPack: (branch) => {
    window.open(`${API_URL}/download/pack/${branch}`, '_blank');
  },

  // Tags
  getTags: async () => {
    const response = await fetchWithCreds(`${API_URL}/tags`);
    return response.json();
  },

  addTag: async (tag) => {
    const response = await fetchWithCreds(`${API_URL}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tag),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to create tag');
    }

    return data;
  },

  deleteTag: async (tag) => {
    const response = await fetchWithCreds(`${API_URL}/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tag),
    });
    return response.json();
  },

  updateTag: async (tagId, updatedTagData) => {
    const response = await fetchWithCreds(`${API_URL}/tags/${tagId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTagData),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(data?.error || 'Failed to update tag');
    }

    return data;
  },

  // Raw File Editor
  listFiles: async (branch) => {
    const response = await fetchWithCreds(`${API_URL}/files?branch=${branch}`);
    return response.json();
  },

  getFileContent: async (branch, path) => {
    const response = await fetchWithCreds(`${API_URL}/files/content?branch=${branch}&path=${encodeURIComponent(path)}`);
    return response.json();
  },

  saveFileContent: async (branch, path, content) => {
    const response = await fetchWithCreds(`${API_URL}/files/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, path, content }),
    });
    return response.json();
  },

  createFileOrFolder: async (branch, path, isFolder) => {
    const response = await fetchWithCreds(`${API_URL}/files/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, path, isFolder }),
    });
    return response.json();
  },

  deleteFileOrFolder: async (branch, path) => {
    const response = await fetchWithCreds(`${API_URL}/files/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, path }),
    });
    return response.json();
  },

  renameFile: async (branch, oldPath, newPath) => {
    const response = await fetchWithCreds(`${API_URL}/files/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch, oldPath, newPath }),
    });
    return response.json();
  },

  uploadFile: async (branch, path, file) => {
    const formData = new FormData();
    formData.append('branch', branch);
    formData.append('path', path);
    formData.append('file', file);
    const response = await fetchWithCreds(`${API_URL}/files/upload`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  // Thumbnails
  getThumbnail: (branch, namespace, modelIdentifier) => {
    return `${API_URL}/thumbnail/${branch}/${namespace}/${modelIdentifier}.png`;
  },

  // Audit
  auditModels: async (branch) => {
    const response = await fetchWithCreds(`${API_URL}/audit/${branch}`);
    return response.json();
  },

  updateThumbnail: async (branch, namespace, modelIdentifier, thumbnailBlob) => {
    const formData = new FormData();
    formData.append('thumbnail', thumbnailBlob, 'thumbnail.png');
    const response = await fetchWithCreds(
      `${API_URL}/model/${branch}/${namespace}/${modelIdentifier}/thumbnail`,
      {
        method: 'POST',
        body: formData,
      }
    );
    return response.json();
  }
};
