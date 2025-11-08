import React, { useState } from 'react';
import { 
  CogIcon,
  PlayIcon,
  StopIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useActions } from '../hooks/useApi';
import { formatRelativeTime, getStatusColor } from '../utils/helpers';

/**
 * Actions page component for viewing and managing remediation actions
 * Shows automated healing actions with their status and results
 */
export default function Actions() {
  const { actions, loading, error, refetch } = useActions();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState(null);

  // Filter actions based on status and search term
  const filteredActions = (actions || []).filter(action => {
    const matchesFilter = filter === 'all' || action.status === filter;
    const matchesSearch = action.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         action.device?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         action.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Get action status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'running':
        return <CogIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  // Handle action retry
  const handleRetryAction = async (actionId) => {
    try {
      await fetch(`http://localhost:5000/api/actions/${actionId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      refetch();
    } catch (error) {
      console.error('Failed to retry action:', error);
    }
  };

  // Handle action cancellation
  const handleCancelAction = async (actionId) => {
    try {
      await fetch(`http://localhost:5000/api/actions/${actionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      refetch();
    } catch (error) {
      console.error('Failed to cancel action:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <XCircleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading actions</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Remediation Actions</h1>
        <p className="mt-2 text-gray-600">Monitor and manage automated healing actions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { 
            title: 'Total Actions', 
            value: actions.length, 
            color: 'blue',
            icon: CogIcon
          },
          { 
            title: 'Running', 
            value: actions.filter(a => a.status === 'running').length, 
            color: 'blue',
            icon: PlayIcon
          },
          { 
            title: 'Completed', 
            value: actions.filter(a => a.status === 'completed').length, 
            color: 'green',
            icon: CheckCircleIcon
          },
          { 
            title: 'Failed', 
            value: actions.filter(a => a.status === 'failed').length, 
            color: 'red',
            icon: XCircleIcon
          }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`flex-shrink-0 p-3 rounded-lg bg-${stat.color}-100`}>
                <stat.icon className={`h-6 w-6 text-${stat.color}-600`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search actions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter */}
          <div className="relative">
            <select
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Actions</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Actions List */}
      <div className="space-y-4">
        {filteredActions.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No actions</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all' ? 'No remediation actions found' : `No ${filter} actions found`}
            </p>
          </div>
        ) : (
          filteredActions.map((action) => (
            <div key={action._id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(action.status)}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {action.type || 'Remediation Action'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        ID: {action.action_id || action._id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(action.status)}`}>
                      {action.status}
                    </span>
                  </div>
                </div>

                {action.description && (
                  <p className="text-gray-700 mb-4">{action.description}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Device</label>
                    <p className="mt-1 text-sm text-gray-900">{action.device || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Started</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {action.startTime ? formatRelativeTime(action.startTime) : 
                       action.createdAt ? formatRelativeTime(action.createdAt) : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Duration</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {action.endTime && action.startTime ? 
                        `${Math.round((new Date(action.endTime) - new Date(action.startTime)) / 1000)}s` : 
                        action.status === 'running' ? 'In progress...' : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Priority</label>
                    <p className="mt-1 text-sm text-gray-900">{action.priority || 'Medium'}</p>
                  </div>
                </div>

                {/* Progress Bar for Running Actions */}
                {action.status === 'running' && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{action.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${action.progress || 0}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Error Message for Failed Actions */}
                {action.status === 'failed' && action.error && (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg">
                    <div className="flex">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-red-800">Error</h4>
                        <p className="mt-1 text-sm text-red-700">{action.error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Message for Completed Actions */}
                {action.status === 'completed' && action.result && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg">
                    <div className="flex">
                      <CheckCircleIcon className="h-5 w-5 text-green-400" />
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-green-800">Success</h4>
                        <p className="mt-1 text-sm text-green-700">{action.result}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {action.tags?.map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedAction(action)}
                      className="text-blue-600 hover:text-blue-500"
                      title="View Details"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    {action.status === 'failed' && (
                      <button
                        onClick={() => handleRetryAction(action._id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Retry
                      </button>
                    )}
                    {action.status === 'running' && (
                      <button
                        onClick={() => handleCancelAction(action._id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Detail Modal */}
      {selectedAction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white max-h-96 overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Action Details</h3>
                <button
                  onClick={() => setSelectedAction(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Type:</span> {selectedAction.type || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">ID:</span> {selectedAction.action_id || selectedAction._id}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedAction.status)}`}>
                        {selectedAction.status}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Device:</span> {selectedAction.device || 'N/A'}
                    </div>
                  </div>
                </div>

                {selectedAction.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                    <p className="text-sm text-gray-600">{selectedAction.description}</p>
                  </div>
                )}

                {selectedAction.parameters && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Parameters</h4>
                    <pre className="text-sm text-gray-600 bg-gray-50 p-3 rounded overflow-x-auto">
                      {JSON.stringify(selectedAction.parameters, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedAction.steps && selectedAction.steps.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Execution Steps</h4>
                    <div className="space-y-2">
                      {selectedAction.steps.map((step, index) => (
                        <div key={index} className="flex items-start space-x-3 text-sm">
                          <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                            step.status === 'completed' ? 'bg-green-500' :
                            step.status === 'failed' ? 'bg-red-500' :
                            step.status === 'running' ? 'bg-blue-500' :
                            'bg-gray-300'
                          }`}></div>
                          <div className="flex-1">
                            <p className="text-gray-900">{step.description}</p>
                            <p className="text-gray-500">
                              {step.timestamp ? formatRelativeTime(step.timestamp) : 'Pending'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Timing</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Created:</span> {formatRelativeTime(selectedAction.createdAt)}
                    </div>
                    <div>
                      <span className="font-medium">Started:</span> {
                        selectedAction.startTime ? formatRelativeTime(selectedAction.startTime) : 'Not started'
                      }
                    </div>
                    <div>
                      <span className="font-medium">Completed:</span> {
                        selectedAction.endTime ? formatRelativeTime(selectedAction.endTime) : 'In progress'
                      }
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span> {
                        selectedAction.endTime && selectedAction.startTime ?
                        `${Math.round((new Date(selectedAction.endTime) - new Date(selectedAction.startTime)) / 1000)}s` :
                        'N/A'
                      }
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={() => setSelectedAction(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
