/**
 * Utility functions for data formatting and common operations
 */

import { format, formatDistanceToNow, isValid } from 'date-fns';

// Date and time formatting utilities
export const formatDate = (date, pattern = 'MMM dd, yyyy HH:mm:ss') => {
  if (!date) return 'N/A';
  const dateObj = new Date(date);
  return isValid(dateObj) ? format(dateObj, pattern) : 'Invalid Date';
};

export const formatRelativeTime = (date) => {
  if (!date) return 'N/A';
  const dateObj = new Date(date);
  return isValid(dateObj) ? formatDistanceToNow(dateObj, { addSuffix: true }) : 'Invalid Date';
};

// Status formatting with colors
export const getStatusColor = (status) => {
  const statusColors = {
    // Device statuses
    'up': 'text-green-600 bg-green-100',
    'down': 'text-red-600 bg-red-100',
    'degraded': 'text-yellow-600 bg-yellow-100',
    'maintenance': 'text-blue-600 bg-blue-100',
    'unknown': 'text-gray-600 bg-gray-100',
    
    // Alert severities
    'critical': 'text-red-600 bg-red-100',
    'major': 'text-orange-600 bg-orange-100',
    'minor': 'text-yellow-600 bg-yellow-100',
    'warning': 'text-yellow-600 bg-yellow-100',
    'info': 'text-blue-600 bg-blue-100',
    
    // Incident statuses
    'open': 'text-red-600 bg-red-100',
    'investigating': 'text-orange-600 bg-orange-100',
    'in_progress': 'text-blue-600 bg-blue-100',
    'resolved': 'text-green-600 bg-green-100',
    'closed': 'text-gray-600 bg-gray-100',
    
    // Action statuses
    'pending': 'text-yellow-600 bg-yellow-100',
    'running': 'text-blue-600 bg-blue-100',
    'completed': 'text-green-600 bg-green-100',
    'failed': 'text-red-600 bg-red-100',
    'cancelled': 'text-gray-600 bg-gray-100',
    
    // Service health
    'healthy': 'text-green-600 bg-green-100',
    'unhealthy': 'text-red-600 bg-red-100',
    'service_degraded': 'text-yellow-600 bg-yellow-100',
    'error': 'text-red-600 bg-red-100',
  };
  
  return statusColors[status?.toLowerCase()] || 'text-gray-600 bg-gray-100';
};

// Severity level formatting
export const getSeverityColor = (severity) => {
  const severityColors = {
    'critical': 'text-red-600 bg-red-100',
    'major': 'text-orange-600 bg-orange-100',
    'minor': 'text-yellow-600 bg-yellow-100',
    'warning': 'text-yellow-600 bg-yellow-100',
    'info': 'text-blue-600 bg-blue-100',
  };
  
  return severityColors[severity?.toLowerCase()] || 'text-gray-600 bg-gray-100';
};

export const getSeverityIcon = (severity) => {
  const severityIcons = {
    'critical': '🔴',
    'major': '🟠',
    'minor': '🟡',
    'warning': '⚠️',
    'info': 'ℹ️',
  };
  
  return severityIcons[severity?.toLowerCase()] || '❓';
};

// Device type formatting
export const getDeviceIcon = (type) => {
  const deviceIcons = {
    'router': '🌐',
    'switch': '🔀',
    'firewall': '🛡️',
    'server': '🖥️',
    'wireless_ap': '📶',
    'load_balancer': '⚖️',
    'vpn_gateway': '🔐',
    'proxy': '🔄',
    'dns_server': '🗺️',
    'dhcp_server': '📍',
  };
  
  return deviceIcons[type?.toLowerCase()] || '🖥️';
};

// Number formatting utilities
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const formatPercent = (value, decimals = 1) => {
  if (value === null || value === undefined) return 'N/A';
  return `${Number(value).toFixed(decimals)}%`;
};

export const formatDuration = (milliseconds) => {
  if (!milliseconds) return '0ms';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else if (seconds > 0) {
    return `${seconds}s`;
  } else {
    return `${milliseconds}ms`;
  }
};

// Network utilities
export const formatBandwidth = (bandwidth) => {
  if (!bandwidth) return 'N/A';
  
  // Handle different bandwidth formats
  const bwLower = bandwidth.toLowerCase();
  if (bwLower.includes('gbps')) {
    return bandwidth;
  } else if (bwLower.includes('mbps')) {
    return bandwidth;
  } else if (bwLower.includes('kbps')) {
    return bandwidth;
  }
  
  // Try to parse numeric value and add units
  const numeric = parseFloat(bandwidth);
  if (!isNaN(numeric)) {
    if (numeric >= 1000000000) {
      return `${(numeric / 1000000000).toFixed(1)} Gbps`;
    } else if (numeric >= 1000000) {
      return `${(numeric / 1000000).toFixed(0)} Mbps`;
    } else if (numeric >= 1000) {
      return `${(numeric / 1000).toFixed(0)} Kbps`;
    } else {
      return `${numeric} bps`;
    }
  }
  
  return bandwidth;
};

// IP address validation
export const isValidIP = (ip) => {
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
};

// URL validation
export const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Data sorting utilities
export const sortByKey = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    let aVal = a[key];
    let bVal = b[key];
    
    // Handle nested keys (e.g., 'user.name')
    if (key.includes('.')) {
      const keys = key.split('.');
      aVal = keys.reduce((obj, k) => obj?.[k], a);
      bVal = keys.reduce((obj, k) => obj?.[k], b);
    }
    
    // Handle different data types
    if (aVal instanceof Date && bVal instanceof Date) {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return direction === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // Fallback to string comparison
    const aStr = String(aVal || '');
    const bStr = String(bVal || '');
    return direction === 'asc' 
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });
};

// Filter utilities
export const filterByStatus = (items, status) => {
  if (!status || status === 'all') return items;
  return items.filter(item => item.status?.toLowerCase() === status.toLowerCase());
};

export const filterBySeverity = (items, severity) => {
  if (!severity || severity === 'all') return items;
  return items.filter(item => item.severity?.toLowerCase() === severity.toLowerCase());
};

export const filterByTimeRange = (items, range, dateField = 'createdAt') => {
  if (!range || range === 'all') return items;
  
  const now = new Date();
  let startDate;
  
  switch (range) {
    case '1h':
      startDate = new Date(now - 60 * 60 * 1000);
      break;
    case '24h':
      startDate = new Date(now - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      return items;
  }
  
  return items.filter(item => {
    const itemDate = new Date(item[dateField]);
    return itemDate >= startDate;
  });
};

// Search utilities
export const searchItems = (items, query, searchFields = ['name', 'description']) => {
  if (!query) return items;
  
  const lowerQuery = query.toLowerCase();
  
  return items.filter(item => {
    return searchFields.some(field => {
      let value = item[field];
      
      // Handle nested fields
      if (field.includes('.')) {
        const keys = field.split('.');
        value = keys.reduce((obj, k) => obj?.[k], item);
      }
      
      return String(value || '').toLowerCase().includes(lowerQuery);
    });
  });
};

// Chart data utilities
export const generateTimeSeriesData = (data, timeField, valueField, intervalMinutes = 5) => {
  // Group data by time intervals
  const grouped = {};
  
  data.forEach(item => {
    const time = new Date(item[timeField]);
    const intervalStart = new Date(Math.floor(time.getTime() / (intervalMinutes * 60 * 1000)) * intervalMinutes * 60 * 1000);
    const key = intervalStart.toISOString();
    
    if (!grouped[key]) {
      grouped[key] = { timestamp: intervalStart, values: [] };
    }
    
    grouped[key].values.push(item[valueField]);
  });
  
  // Calculate averages for each interval
  return Object.values(grouped).map(group => ({
    timestamp: group.timestamp,
    value: group.values.reduce((sum, val) => sum + val, 0) / group.values.length,
    count: group.values.length
  })).sort((a, b) => a.timestamp - b.timestamp);
};

// Local storage utilities
export const saveToLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export const loadFromLocalStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return defaultValue;
  }
};

// Theme utilities
export const getThemeColor = (theme = 'light') => {
  const colors = {
    light: {
      primary: '#3b82f6',
      secondary: '#6b7280',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      background: '#ffffff',
      surface: '#f9fafb',
    },
    dark: {
      primary: '#60a5fa',
      secondary: '#9ca3af',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      background: '#111827',
      surface: '#1f2937',
    }
  };
  
  return colors[theme] || colors.light;
};

export default {
  formatDate,
  formatRelativeTime,
  getStatusColor,
  getSeverityColor,
  getSeverityIcon,
  getDeviceIcon,
  formatBytes,
  formatPercent,
  formatDuration,
  formatBandwidth,
  isValidIP,
  isValidURL,
  sortByKey,
  filterByStatus,
  filterBySeverity,
  filterByTimeRange,
  searchItems,
  generateTimeSeriesData,
  saveToLocalStorage,
  loadFromLocalStorage,
  getThemeColor,
};
