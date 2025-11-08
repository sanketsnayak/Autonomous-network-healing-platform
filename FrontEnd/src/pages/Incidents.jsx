import React, { useState } from 'react';
import { 
  ExclamationCircleIcon, 
  EyeIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserGroupIcon,
  CogIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useIncidents } from '../hooks/useApi';
import { formatDate, getStatusColor, getSeverityColor } from '../utils/helpers';

/**
 * Incidents page component for viewing and managing network incidents
 * Shows incidents with RCA results and remediation actions
 */
export default function Incidents() {
  const { incidents, loading, error, refetch } = useIncidents();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Filter incidents based on status and search term
  const filteredIncidents = incidents.filter(incident => {
    const matchesFilter = filter === 'all' || incident.status === filter;
    const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'resolved':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'investigating':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />;
      case 'remediating':
        return <CogIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  // Handle incident status update
  const handleStatusUpdate = async (incidentId, newStatus) => {
    try {
      await fetch(`http://localhost:5000/api/incidents/${incidentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      refetch();
    } catch (error) {
      console.error('Failed to update incident status:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
              <h3 className="text-sm font-medium text-red-800">Error loading incidents</h3>
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
        <h1 className="text-3xl font-bold text-gray-900">Network Incidents</h1>
        <p className="mt-2 text-gray-600">Track and manage network incidents with automated resolution</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { 
            title: 'Total Incidents', 
            value: incidents.length, 
            color: 'blue',
            icon: ExclamationCircleIcon
          },
          { 
            title: 'Investigating', 
            value: incidents.filter(i => i.status === 'investigating').length, 
            color: 'yellow',
            icon: ExclamationCircleIcon
          },
          { 
            title: 'Remediating', 
            value: incidents.filter(i => i.status === 'remediating').length, 
            color: 'blue',
            icon: CogIcon
          },
          { 
            title: 'Resolved', 
            value: incidents.filter(i => i.status === 'resolved').length, 
            color: 'green',
            icon: CheckCircleIcon
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
              placeholder="Search incidents..."
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
              <option value="all">All Incidents</option>
              <option value="investigating">Investigating</option>
              <option value="remediating">Remediating</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents List */}
      <div className="space-y-6">
        {filteredIncidents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <ExclamationCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No incidents</h3>
            <p className="mt-1 text-sm text-gray-500">
              {filter === 'all' ? 'No incidents found' : `No ${filter} incidents found`}
            </p>
          </div>
        ) : (
          filteredIncidents.map((incident) => (
            <div key={incident._id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(incident.status)}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{incident.title}</h3>
                      <p className="text-sm text-gray-600">ID: {incident.incident_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(incident.severity)}`}>
                      {incident.severity}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(incident.status)}`}>
                      {incident.status}
                    </span>
                  </div>
                </div>

                <p className="text-gray-700 mb-4">{incident.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Affected Devices</label>
                    <div className="mt-1 flex items-center">
                      <UserGroupIcon className="h-4 w-4 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-900">
                        {incident.affected_devices?.length || 0} devices
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Created</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(incident.createdAt)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Last Updated</label>
                    <p className="mt-1 text-sm text-gray-900">{formatDate(incident.updatedAt)}</p>
                  </div>
                </div>

                {/* RCA Results */}
                {incident.rca_results && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Root Cause Analysis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-blue-800">Suspected Cause:</span>
                        <p className="text-blue-700">{incident.rca_results.suspected_cause}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">Confidence:</span>
                        <p className="text-blue-700">{Math.round(incident.rca_results.confidence_score * 100)}%</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {incident.affected_devices?.map((device, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {device}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedIncident(incident)}
                      className="text-blue-600 hover:text-blue-500"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    {incident.status === 'investigating' && (
                      <button
                        onClick={() => handleStatusUpdate(incident._id, 'remediating')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Start Remediation
                      </button>
                    )}
                    {incident.status === 'remediating' && (
                      <button
                        onClick={() => handleStatusUpdate(incident._id, 'resolved')}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white max-h-96 overflow-y-auto">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Incident Details</h3>
                <button
                  onClick={() => setSelectedIncident(null)}
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
                      <span className="font-medium">Title:</span> {selectedIncident.title}
                    </div>
                    <div>
                      <span className="font-medium">ID:</span> {selectedIncident.incident_id}
                    </div>
                    <div>
                      <span className="font-medium">Severity:</span> 
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(selectedIncident.severity)}`}>
                        {selectedIncident.severity}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedIncident.status)}`}>
                        {selectedIncident.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                  <p className="text-sm text-gray-600">{selectedIncident.description}</p>
                </div>

                {selectedIncident.rca_results && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Root Cause Analysis</h4>
                    <div className="bg-blue-50 p-4 rounded-lg space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-blue-800">Suspected Cause:</span>
                        <p className="text-blue-700">{selectedIncident.rca_results.suspected_cause}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">Confidence Score:</span>
                        <p className="text-blue-700">{Math.round(selectedIncident.rca_results.confidence_score * 100)}%</p>
                      </div>
                      {selectedIncident.rca_results.contributing_factors && (
                        <div>
                          <span className="font-medium text-blue-800">Contributing Factors:</span>
                          <ul className="text-blue-700 list-disc list-inside">
                            {selectedIncident.rca_results.contributing_factors.map((factor, index) => (
                              <li key={index}>{factor}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedIncident.timeline && selectedIncident.timeline.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Timeline</h4>
                    <div className="space-y-2">
                      {selectedIncident.timeline.map((event, index) => (
                        <div key={index} className="flex items-start space-x-3 text-sm">
                          <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div className="flex-1">
                            <p className="text-gray-900">{event.event}</p>
                            <p className="text-gray-500">{formatDate(event.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={() => setSelectedIncident(null)}
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
