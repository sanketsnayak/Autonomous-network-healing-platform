/**
 * API Service Layer for Autonomous Network Healing Platform
 * Handles all communication with the backend REST API using native fetch
 */

import toast from 'react-hot-toast';

// Base configuration
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TIMEOUT = 30000; // Increased timeout to 30 seconds

// Utility function to create fetch with timeout
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// API helper function with error handling
const apiRequest = async (endpoint, options = {}) => {
  try {
    const url = `${BASE_URL}${endpoint}`;
    
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await fetchWithTimeout(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      let errorMessage = 'An error occurred';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    // Return the response object with data property for compatibility
    const data = await response.json();
    return { data };
    
  } catch (error) {
    const message = error.message || 'An error occurred';
    console.error('API Error:', message);
    toast.error(`API Error: ${message}`);
    throw error;
  }
};

// HTTP method helpers
const api = {
  get: async (endpoint, params = {}) => {
    try {
      const url = new URL(`${BASE_URL}${endpoint}`);
      
      // Only append primitive values as query params
      if (params && typeof params === 'object') {
        Object.keys(params).forEach(key => {
          const value = params[key];
          if (
            value !== undefined &&
            value !== null &&
            (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
          ) {
            url.searchParams.append(key, String(value));
          }
        });
      }
      
      // Add auth token if available
      const token = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        let errorMessage = 'An error occurred';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      return { data };
    } catch (error) {
      const message = error.message || 'An error occurred';
      console.error('API Error:', message);
      toast.error(`API Error: ${message}`);
      throw error;
    }
  },
  
  post: (endpoint, data = {}) => apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  put: (endpoint, data = {}) => apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  patch: (endpoint, data = {}) => apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  delete: (endpoint) => apiRequest(endpoint, {
    method: 'DELETE',
  }),
};

// Device API endpoints
export const deviceApi = {
  // Get all devices
  getAll: () => api.get('/devices'),
  
  // Get device by ID
  getById: (id) => api.get(`/devices/${id}`),
  
  // Create new device
  create: (deviceData) => api.post('/devices', deviceData),
  
  // Update device
  update: (id, deviceData) => api.put(`/devices/${id}`, deviceData),
  
  // Delete device
  delete: (id) => api.delete(`/devices/${id}`),
  
  // Get device statistics
  getStats: () => api.get('/devices/stats'),
  
  // Test device connectivity
  testConnectivity: (id) => api.post(`/devices/${id}/test`),
};

// Alert API endpoints
export const alertApi = {
  // Get all alerts
  getAll: (params = {}) => api.get('/alerts', params),
  
  // Get alert by ID
  getById: (id) => api.get(`/alerts/${id}`),
  
  // Create new alert
  create: (alertData) => api.post('/alerts', alertData),
  
  // Update alert status
  updateStatus: (id, status) => api.patch(`/alerts/${id}/status`, { status }),
  
  // Acknowledge alert
  acknowledge: (id, userId) => api.patch(`/alerts/${id}/acknowledge`, { userId }),
  
  // Get alert statistics
  getStats: () => api.get('/alerts/stats'),
  
  // Get alerts by severity
  getBySeverity: (severity) => api.get(`/alerts/severity/${severity}`),
};

// Incident API endpoints
export const incidentApi = {
  // Get all incidents
  getAll: (params = {}) => api.get('/incidents', params),
  
  // Get incident by ID
  getById: (id) => api.get(`/incidents/${id}`),
  
  // Create new incident
  create: (incidentData) => api.post('/incidents', incidentData),
  
  // Update incident
  update: (id, incidentData) => api.put(`/incidents/${id}`, incidentData),
  
  // Close incident
  close: (id, resolution) => api.patch(`/incidents/${id}/close`, { resolution }),
  
  // Get incident statistics
  getStats: () => api.get('/incidents/stats'),
  
  // Trigger manual RCA
  triggerRCA: (id) => api.post(`/incidents/${id}/rca`),
};

// Policy API endpoints
export const policyApi = {
  // Get all policies
  getAll: () => api.get('/policies'),
  
  // Get policy by ID
  getById: (id) => api.get(`/policies/${id}`),
  
  // Create new policy
  create: (policyData) => api.post('/policies', policyData),
  
  // Update policy
  update: (id, policyData) => api.put(`/policies/${id}`, policyData),
  
  // Delete policy
  delete: (id) => api.delete(`/policies/${id}`),
  
  // Enable/disable policy
  toggleStatus: (id, enabled) => api.patch(`/policies/${id}/status`, { enabled }),
  
  // Test policy execution
  test: (id, testData) => api.post(`/policies/${id}/test`, testData),
};

// Topology API endpoints
export const topologyApi = {
  // Get all topologies
  getAll: () => api.get('/topology'),
  
  // Get topology by ID
  getById: (id) => api.get(`/topology/${id}`),
  
  // Update topology
  update: (id, topologyData) => api.put(`/topology/${id}`, topologyData),
  
  // Discover topology
  discover: () => api.post('/topology/discover'),
  
  // Get network map data
  getNetworkMap: () => api.get('/topology/network-map'),
  
  // Get service dependencies
  getServiceDependencies: () => api.get('/topology/service-dependencies'),
  
  // Validate topology
  validate: (id) => api.post(`/topology/${id}/validate`),
};

// Action API endpoints
export const actionApi = {
  // Get all actions
  getAll: (params = {}) => api.get('/actions', params),
  
  // Get action by ID
  getById: (id) => api.get(`/actions/${id}`),
  
  // Execute manual action
  execute: (actionData) => api.post('/actions/execute', actionData),
  
  // Get action history - get all actions as history
  getHistory: (params = {}) => api.get('/actions', params),
  
  // Get specific action history
  getActionHistory: (id) => api.get(`/actions/${id}/history`),
  
  // Get available action templates
  getTemplates: () => api.get('/actions/templates'),
  
  // Cancel running action
  cancel: (id) => api.post(`/actions/${id}/cancel`),
};

// Health and monitoring API endpoints
export const healthApi = {
  // Get overall system health
  getHealth: () => api.get('/health'),
  
  // Get system metrics
  getMetrics: () => api.get('/metrics'),
  
  // Get performance statistics
  getPerformance: () => api.get('/health/performance'),
  
  // Get service status
  getServiceStatus: () => api.get('/health/services'),
  
  // Get component health
  getComponentHealth: () => api.get('/health/components'),
};

// Dashboard API endpoints
export const dashboardApi = {
  // Get dashboard overview data
  getOverview: () => api.get('/dashboard/overview'),
  
  // Get real-time statistics
  getRealTimeStats: () => api.get('/dashboard/realtime'),
  
  // Get trend data
  getTrends: (timeRange = '24h') => api.get(`/dashboard/trends?range=${timeRange}`),
  
  // Get network status summary
  getNetworkStatus: () => api.get('/dashboard/network-status'),
  
  // Get recent activities
  getRecentActivities: (limit = 10) => api.get(`/dashboard/activities?limit=${limit}`),
};

// Utility function for handling file uploads
export const uploadFile = async (endpoint, file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const token = localStorage.getItem('authToken');
  const headers = {};
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  try {
    const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    
    if (!response.ok) {
      let errorMessage = 'Upload failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    return { data };
    
  } catch (error) {
    const message = error.message || 'Upload failed';
    console.error('Upload Error:', message);
    toast.error(`Upload Error: ${message}`);
    throw error;
  }
};

// Export the api object for custom requests
export default api;
