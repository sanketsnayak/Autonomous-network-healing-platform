import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Eye, 
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';
import { useAlerts } from '../hooks/useApi';
import { formatRelativeTime, getStatusColor, getSeverityColor } from '../utils/helpers';

/**
 * Alerts page component for viewing and managing network alerts
 * Shows real-time alerts with filtering, search, and action capabilities
 */
export default function Alerts() {
  const { alerts, loading, error, refetch } = useAlerts();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Filter alerts based on status and search term
  const filteredAlerts = (alerts || []).filter(alert => {
    const matchesFilter = filter === 'all' || alert.status === filter;
    const matchesSearch = alert.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.device?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Get severity icon
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'major':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'minor':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading alerts</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <button 
            onClick={refetch}
            className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
        <button
          onClick={refetch}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search alerts..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Alerts List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredAlerts.length === 0 ? (
            <li className="px-6 py-12 text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {alerts?.length === 0 
                  ? 'No alerts have been generated yet'
                  : 'Try adjusting your filters'
                }
              </p>
            </li>
          ) : (
            filteredAlerts.map((alert) => (
              <li key={alert._id} className="hover:bg-gray-50">
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {getSeverityIcon(alert.severity)}
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-gray-900">
                          {alert.message}
                        </p>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <span>{alert.device}</span>
                        <span className="mx-2">•</span>
                        <span>{formatRelativeTime(alert.timestamp || alert.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(alert.status)}`}>
                      {alert.status}
                    </span>
                    <button
                      onClick={() => setSelectedAlert(alert)}
                      className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-gray-400 hover:text-gray-500"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Alert Details</h3>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Message</label>
                <p className="mt-1 text-sm text-gray-900">{selectedAlert.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Device</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAlert.device}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Severity</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAlert.severity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAlert.status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Time</label>
                  <p className="mt-1 text-sm text-gray-900">{formatRelativeTime(selectedAlert.timestamp || selectedAlert.createdAt)}</p>
                </div>
              </div>
              {selectedAlert.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedAlert.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
