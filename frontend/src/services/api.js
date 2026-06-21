import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Projects
  getProjects: async () => {
    const response = await apiClient.get('/projects');
    return response.data;
  },
  getProject: async (id) => {
    const response = await apiClient.get(`/projects/${id}`);
    return response.data;
  },
  createProject: async (name, description, materialType = 'Mild Steel', materialThickness = 1.00) => {
    const response = await apiClient.post('/projects', {
      user_id: 1, // Hardcoded default user created in schema seed
      project_name: name,
      description,
      materialType,
      materialThickness,
    });
    return response.data;
  },
  deleteProject: async (id) => {
    const response = await apiClient.delete(`/projects/${id}`);
    return response.data;
  },
  updateProjectMaterial: async (id, materialType, materialThickness) => {
    const response = await apiClient.put(`/projects/${id}/material`, {
      materialType,
      materialThickness,
    });
    return response.data;
  },

  // Dashboard Stats
  getDashboardStats: async () => {
    const response = await apiClient.get('/projects/dashboard/stats');
    return response.data;
  },

  // Uploaded Files
  getProjectFiles: async (projectId) => {
    const response = await apiClient.get(`/files/project/${projectId}`);
    return response.data;
  },
  uploadFile: async (projectId, file, quantity = null) => {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('file', file);
    if (quantity !== null) {
      formData.append('quantity', quantity);
    }

    const response = await apiClient.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  deleteFile: async (id) => {
    const response = await apiClient.delete(`/files/${id}`);
    return response.data;
  },
  updateFileQuantity: async (id, quantity) => {
    const response = await apiClient.put(`/files/${id}/quantity`, { quantity });
    return response.data;
  },

  // Nesting Jobs
  startNestingJob: async (projectId, optimizationLevel = 'greedy', sheetWidth = 1000, sheetHeight = 1000, remnantId = null) => {
    const response = await apiClient.post(`/nesting/start/${projectId}`, { optimizationLevel, sheetWidth, sheetHeight, remnantId });
    return response.data;
  },
  getJobStatus: async (jobId) => {
    const response = await apiClient.get(`/nesting/status/${jobId}`);
    return response.data;
  },
  getJobResult: async (jobId) => {
    const response = await apiClient.get(`/nesting/result/${jobId}`);
    return response.data;
  },

  // Remnants
  getRemnants: async () => {
    const response = await apiClient.get('/remnants');
    return response.data;
  },
  recommendRemnants: async (projectId) => {
    const response = await apiClient.get(`/remnants/recommend/${projectId}`);
    return response.data;
  },

  // AI Advisor
  getAIRecommendations: async (jobId) => {
    const response = await apiClient.get(`/ai/advisor/${jobId}`);
    return response.data;
  },

  // Manual Layout Adjustment
  getLayoutPlacements: async (jobId) => {
    const response = await apiClient.get(`/nesting/layout/${jobId}`);
    return response.data;
  },
  updateLayoutPlacements: async (jobId, parts) => {
    const response = await apiClient.put(`/nesting/layout/${jobId}`, { parts });
    return response.data;
  },
  resetLayout: async (jobId) => {
    const response = await apiClient.post(`/nesting/reset/${jobId}`);
    return response.data;
  },
  regenerateLayout: async (jobId) => {
    const response = await apiClient.post(`/nesting/regenerate/${jobId}`);
    return response.data;
  },

  // Export Center
  exportPDF: async (jobId) => {
    return apiClient.get(`/export/pdf/${jobId}`, { responseType: 'blob' });
  },
  exportSVG: async (jobId) => {
    return apiClient.get(`/export/svg/${jobId}`, { responseType: 'blob' });
  },
  exportJSON: async (jobId) => {
    return apiClient.get(`/export/json/${jobId}`, { responseType: 'blob' });
  },

  // AI Copilot
  chatCopilot: async (jobId, message) => {
    const response = await apiClient.post('/copilot/chat', { jobId, message });
    return response.data;
  },
};

export default api;
