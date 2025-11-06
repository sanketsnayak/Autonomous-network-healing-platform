import React, { useState } from 'react';
import { 
  DocumentTextIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { useApi } from '../hooks/useApi';
import { formatDateTime } from '../utils/helpers';

/**
 * Policies page component for managing automation policies
 * Shows policies for autonomous network healing with CRUD operations
 */
export default function Policies() {
  const { data: policies = [], loading, error, refetch } = useApi('/policies');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filter policies based on status and search term
  const filteredPolicies = policies.filter(policy => {
    const matchesFilter = filter === 'all' || 
                         (filter === 'active' && policy.enabled) ||
                         (filter === 'inactive' && !policy.enabled);
    const matchesSearch = policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         policy.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Handle policy toggle
  const handleTogglePolicy = async (policyId, enabled) => {
    try {
      await fetch(`http://localhost:5000/api/policies/${policyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled })
      });
      refetch();
    } catch (error) {
      console.error('Failed to toggle policy:', error);
    }
  };

  // Handle policy deletion
  const handleDeletePolicy = async (policyId) => {
    if (window.confirm('Are you sure you want to delete this policy?')) {
      try {
        await fetch(`http://localhost:5000/api/policies/${policyId}`, {
          method: 'DELETE'
        });
        refetch();
      } catch (error) {
        console.error('Failed to delete policy:', error);
      }
    }
  };

  // Get policy type color
  const getPolicyTypeColor = (type) => {
    switch (type) {
      case 'remediation':
        return 'bg-blue-100 text-blue-800';
      case 'alert_correlation':
        return 'bg-yellow-100 text-yellow-800';
      case 'escalation':
        return 'bg-red-100 text-red-800';
      case 'notification':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
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
              <h3 className="text-sm font-medium text-red-800">Error loading policies</h3>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Automation Policies</h1>
            <p className="mt-2 text-gray-600">Configure autonomous healing and automation rules</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Create Policy</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { 
            title: 'Total Policies', 
            value: policies.length, 
            color: 'blue',
            icon: DocumentTextIcon
          },
          { 
            title: 'Active', 
            value: policies.filter(p => p.enabled).length, 
            color: 'green',
            icon: CheckCircleIcon
          },
          { 
            title: 'Inactive', 
            value: policies.filter(p => !p.enabled).length, 
            color: 'red',
            icon: XCircleIcon
          },
          { 
            title: 'Remediation', 
            value: policies.filter(p => p.type === 'remediation').length, 
            color: 'purple',
            icon: CogIcon
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
              placeholder="Search policies..."
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
              <option value="all">All Policies</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Policies List */}
      <div className="space-y-4">
        {filteredPolicies.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No policies</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first automation policy.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Create Policy
            </button>
          </div>
        ) : (
          filteredPolicies.map((policy) => (
            <div key={policy._id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${policy.enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <DocumentTextIcon className={`h-6 w-6 ${policy.enabled ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{policy.name}</h3>
                      <p className="text-sm text-gray-600">ID: {policy.policy_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPolicyTypeColor(policy.type)}`}>
                      {policy.type?.replace('_', ' ')}
                    </span>
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        policy.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {policy.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-700 mb-4">{policy.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Priority</label>
                    <p className="mt-1 text-sm text-gray-900">{policy.priority}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Created</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDateTime(policy.createdAt)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Last Updated</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDateTime(policy.updatedAt)}</p>
                  </div>
                </div>

                {/* Trigger Conditions */}
                {policy.triggers && policy.triggers.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                    <h4 className="text-sm font-medium text-yellow-900 mb-2">Triggers</h4>
                    <div className="space-y-1">
                      {policy.triggers.map((trigger, index) => (
                        <div key={index} className="text-sm text-yellow-700">
                          <span className="font-medium">{trigger.type}:</span> {trigger.condition}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {policy.conditions?.map((condition, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {condition.field} {condition.operator} {condition.value}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedPolicy(policy)}
                      className="text-blue-600 hover:text-blue-500"
                      title="View Details"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleTogglePolicy(policy._id, policy.enabled)}
                      className={`px-3 py-1 rounded text-sm ${
                        policy.enabled 
                          ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {policy.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDeletePolicy(policy._id)}
                      className="text-red-600 hover:text-red-500"
                      title="Delete Policy"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Policy Detail Modal */}
      {selectedPolicy && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white max-h-96 overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Policy Details</h3>
                <button
                  onClick={() => setSelectedPolicy(null)}
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
                      <span className="font-medium">Name:</span> {selectedPolicy.name}
                    </div>
                    <div>
                      <span className="font-medium">ID:</span> {selectedPolicy.policy_id}
                    </div>
                    <div>
                      <span className="font-medium">Type:</span> 
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPolicyTypeColor(selectedPolicy.type)}`}>
                        {selectedPolicy.type?.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Priority:</span> {selectedPolicy.priority}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                  <p className="text-sm text-gray-600">{selectedPolicy.description}</p>
                </div>

                {selectedPolicy.conditions && selectedPolicy.conditions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Conditions</h4>
                    <div className="space-y-2">
                      {selectedPolicy.conditions.map((condition, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded text-sm">
                          <span className="font-medium">{condition.field}</span> {condition.operator} <span className="font-medium">{condition.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPolicy.actions && selectedPolicy.actions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Actions</h4>
                    <div className="space-y-2">
                      {selectedPolicy.actions.map((action, index) => (
                        <div key={index} className="bg-blue-50 p-3 rounded text-sm">
                          <div className="font-medium text-blue-800">{action.type}</div>
                          {action.parameters && (
                            <pre className="mt-1 text-xs text-blue-700">
                              {JSON.stringify(action.parameters, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={() => setSelectedPolicy(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Policy Modal - Basic placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Policy</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="text-center py-8">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Policy Creation</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Policy creation interface will be implemented in the next phase.
                </p>
              </div>
              
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={() => setShowCreateModal(false)}
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
