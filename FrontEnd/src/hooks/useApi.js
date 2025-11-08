/**
 * Custom React hooks for the Autonomous Network Healing Platform
 * Provides reusable data fetching and state management logic
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  deviceApi, 
  alertApi, 
  incidentApi, 
  policyApi, 
  topologyApi, 
  actionApi, 
  healthApi, 
  dashboardApi 
} from '../services/api';
import toast from 'react-hot-toast';

// Generic hook for API calls with loading, error, and success states
export const useApi = (apiCall, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  
  // Serialize deps to create stable dependency
  const stableDeps = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiCall();
        
        // Only check if cancelled, not mounted state (React dev mode unmounts components frequently)
        if (cancelled) {
          return;
        }
        
        setData(response.data);
      } catch (err) {
        if (cancelled) {
          return;
        }
        
        setError(err.response?.data?.message || err.message || 'An error occurred');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableDeps]); // Only depend on serialized deps - apiCall intentionally excluded to prevent infinite loop

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall();
      setData(response.data);
    } catch (err) {
      console.error('API call failed:', err);
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove apiCall to prevent infinite loop

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, loading, error, refetch };
};

// Hook for fetching devices with real-time updates
export const useDevices = (refreshInterval = 30000) => {
  const { data, loading, error, refetch } = useApi(() => deviceApi.getAll());
  
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(refetch, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refetch, refreshInterval]);

  const devices = data || [];
  const deviceCount = devices.length || 0;
  
  const onlineDevices = Array.isArray(devices) ? devices.filter(d => {
    // Handle both uppercase and lowercase status values
    const status = d.status?.toLowerCase();
    return status === 'up' || status === 'online';
  }).length : 0;
  const offlineDevices = Array.isArray(devices) ? devices.filter(d => {
    const status = d.status?.toLowerCase();
    return status === 'down' || status === 'offline';
  }).length : 0;

  return { 
    devices, 
    loading, 
    error, 
    refetch,
    deviceCount,
    onlineDevices,
    offlineDevices
  };
};

// Hook for fetching alerts with filtering and real-time updates
export const useAlerts = (filters = {}, refreshInterval = 10000) => {
  const { data, loading, error, refetch } = useApi(() => alertApi.getAll(filters), [filters]);
  
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(refetch, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refetch, refreshInterval]);

  const alertStats = {
    total: data?.length || 0,
    critical: Array.isArray(data) ? data.filter(a => a.severity === 'critical').length : 0,
    major: Array.isArray(data) ? data.filter(a => a.severity === 'major').length : 0,
    minor: Array.isArray(data) ? data.filter(a => a.severity === 'minor').length : 0,
    warning: Array.isArray(data) ? data.filter(a => a.severity === 'warning').length : 0,
    open: Array.isArray(data) ? data.filter(a => a.status === 'open').length : 0,
    acknowledged: Array.isArray(data) ? data.filter(a => a.status === 'acknowledged').length : 0,
  };

  return { 
    alerts: data || [], 
    loading, 
    error, 
    refetch,
    alertStats
  };
};

// Hook for fetching incidents
export const useIncidents = (filters = {}) => {
  const { data, loading, error, refetch } = useApi(() => incidentApi.getAll(filters), [filters]);
  
  // Extract incidents array from response object, fallback to empty array
  const incidents = Array.isArray(data?.incidents) ? data.incidents : 
                   Array.isArray(data) ? data : [];
  
  const incidentStats = {
    total: incidents.length || 0,
    open: incidents.filter(i => i.status === 'open').length || 0,
    investigating: incidents.filter(i => i.status === 'investigating').length || 0,
    resolved: incidents.filter(i => i.status === 'resolved').length || 0,
    critical: incidents.filter(i => i.severity === 'critical').length || 0,
  };

  return { 
    incidents: incidents, 
    loading, 
    error, 
    refetch,
    incidentStats
  };
};

// Hook for fetching policies
export const usePolicies = () => {
  const { data, loading, error, refetch } = useApi(() => policyApi.getAll());
  
  const policyStats = {
    total: data?.length || 0,
    enabled: Array.isArray(data) ? data.filter(p => p.enabled).length : 0,
    disabled: Array.isArray(data) ? data.filter(p => !p.enabled).length : 0,
    automation: Array.isArray(data) ? data.filter(p => p.policy_type === 'automation').length : 0,
    healing: Array.isArray(data) ? data.filter(p => p.policy_type === 'healing').length : 0,
  };

  return { 
    policies: data || [], 
    loading, 
    error, 
    refetch,
    policyStats
  };
};

// Hook for fetching topology data
export const useTopology = () => {
  const { data, loading, error, refetch } = useApi(() => topologyApi.getAll());
  
  return { 
    topology: data?.[0] || null, // Assuming single topology for now
    loading, 
    error, 
    refetch 
  };
};

// Hook for fetching network map data
export const useNetworkMap = () => {
  const { data, loading, error, refetch } = useApi(() => topologyApi.getNetworkMap());
  
  return { 
    networkMap: data || null, 
    loading, 
    error, 
    refetch 
  };
};

// Hook for fetching action history
export const useActions = (filters = {}) => {
  const { data, loading, error, refetch } = useApi(() => actionApi.getHistory(filters), [filters]);
  
  // Extract actions array from response object, fallback to empty array
  const actions = Array.isArray(data?.data) ? data.data : 
                 Array.isArray(data) ? data : [];
  
  const actionStats = {
    total: actions.length || 0,
    completed: actions.filter(a => a.status === 'completed').length || 0,
    failed: actions.filter(a => a.status === 'failed').length || 0,
    running: actions.filter(a => a.status === 'running').length || 0,
    pending: actions.filter(a => a.status === 'pending').length || 0,
  };

  return { 
    actions: actions, 
    loading, 
    error, 
    refetch,
    actionStats
  };
};

// Hook for fetching system health
export const useSystemHealth = (refreshInterval = 15000) => {
  const { data, loading, error, refetch } = useApi(() => healthApi.getHealth());
  
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(refetch, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refetch, refreshInterval]);

  const health = data || {};

  return { 
    health, 
    loading, 
    error, 
    refetch 
  };
};

// Hook for fetching dashboard overview data
export const useDashboard = (refreshInterval = 30000) => {
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch multiple dashboard data endpoints
      const [overview, networkStatus, activities] = await Promise.all([
        dashboardApi.getOverview(),
        dashboardApi.getNetworkStatus(),
        dashboardApi.getRecentActivities()
      ]);

      setOverviewData({
        overview: overview.data,
        networkStatus: networkStatus.data,
        activities: activities.data
      });
    } catch (err) {
      console.error('Dashboard data fetch failed:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    
    if (refreshInterval > 0) {
      const interval = setInterval(fetchOverview, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchOverview, refreshInterval]);

  return { 
    dashboardData: overviewData, 
    loading, 
    error, 
    refetch: fetchOverview 
  };
};

// Hook for WebSocket real-time updates
export const useWebSocket = (url, onMessage) => {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    try {
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
        setConnected(true);
        setError(null);
        console.log('WebSocket connected');
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };
      
      wsRef.current.onclose = () => {
        setConnected(false);
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connect();
        }, 5000);
      };
      
      wsRef.current.onerror = (err) => {
        setError('WebSocket connection error');
        console.error('WebSocket error:', err);
      };
    } catch (err) {
      setError('Failed to create WebSocket connection');
      console.error('WebSocket creation error:', err);
    }
  }, [url, onMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { connected, error, sendMessage, disconnect };
};

// Hook for managing local state with persistence
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
};

// Hook for debounced search
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Hook for managing async operations
export const useAsync = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (asyncFunction) => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFunction();
      return result;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, execute };
};
