import React, { useState } from 'react';
import { 
  MapIcon,
  ServerIcon,
  LinkIcon,
  BuildingOfficeIcon,
  EyeIcon,
  CpuChipIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useTopology } from '../hooks/useApi';
import { formatRelativeTime } from '../utils/helpers';

/**
 * Topology page component for viewing network topology
 * Shows network devices, links, sites, and services with interactive visualization
 */
export default function Topology() {
  const { topology, loading, error } = useTopology();
  const [activeTab, setActiveTab] = useState('overview');

  // Get the main topology data
  const mainTopology = topology || null;

  // Get link status color
  const getLinkStatusColor = (status) => {
    switch (status) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'degraded':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  // Get device role icon
  const getDeviceRoleIcon = (role) => {
    switch (role) {
      case 'core':
        return <CpuChipIcon className="h-5 w-5 text-blue-600" />;
      case 'access':
        return <ServerIcon className="h-5 w-5 text-green-600" />;
      case 'security':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <ServerIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
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
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading topology</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!mainTopology) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <MapIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No topology data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Network topology information is not available yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Network Topology</h1>
        <p className="mt-2 text-gray-600">
          Visualize and manage your network infrastructure topology
        </p>
      </div>

      {/* Topology Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { 
            title: 'Total Devices', 
            value: mainTopology.devices?.length || 0, 
            color: 'blue',
            icon: ServerIcon
          },
          { 
            title: 'Network Links', 
            value: mainTopology.links?.length || 0, 
            color: 'green',
            icon: LinkIcon
          },
          { 
            title: 'Sites', 
            value: mainTopology.sites?.length || 0, 
            color: 'purple',
            icon: BuildingOfficeIcon
          },
          { 
            title: 'Health Score', 
            value: `${Math.round((mainTopology.health_score || 0) * 100)}%`, 
            color: 'orange',
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

      {/* Topology Details */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'overview', name: 'Overview', icon: MapIcon },
              { id: 'devices', name: 'Devices', icon: ServerIcon },
              { id: 'links', name: 'Links', icon: LinkIcon },
              { id: 'sites', name: 'Sites', icon: BuildingOfficeIcon },
              { id: 'services', name: 'Services', icon: CpuChipIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Topology Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Name</dt>
                        <dd className="text-sm text-gray-900">{mainTopology.name}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Topology ID</dt>
                        <dd className="text-sm text-gray-900">{mainTopology.topology_id}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Version</dt>
                        <dd className="text-sm text-gray-900">{mainTopology.version}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Discovery Method</dt>
                        <dd className="text-sm text-gray-900">{mainTopology.discovery_method}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Last Discovery</dt>
                        <dd className="text-sm text-gray-900">
                          {mainTopology.last_discovery ? formatRelativeTime(mainTopology.last_discovery) : 'Never'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Validation Status</dt>
                        <dd className="text-sm text-gray-900">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            mainTopology.validation_status === 'valid' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {mainTopology.validation_status}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Monitoring Coverage</dt>
                        <dd className="text-sm text-gray-900">{mainTopology.monitoring_coverage}%</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Auto Update</dt>
                        <dd className="text-sm text-gray-900">
                          {mainTopology.auto_update ? 'Enabled' : 'Disabled'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              {mainTopology.performance_metrics && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500">Devices Up</div>
                      <div className="text-2xl font-semibold text-gray-900">
                        {mainTopology.performance_metrics.devices_up}/{mainTopology.performance_metrics.total_devices}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500">Links Up</div>
                      <div className="text-2xl font-semibold text-gray-900">
                        {mainTopology.performance_metrics.links_up}/{mainTopology.performance_metrics.total_links}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500">Avg Utilization</div>
                      <div className="text-2xl font-semibold text-gray-900">
                        {mainTopology.performance_metrics.average_utilization}%
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-500">Health Score</div>
                      <div className="text-2xl font-semibold text-gray-900">
                        {Math.round((mainTopology.health_score || 0) * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'devices' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Network Devices</h3>
              <div className="space-y-4">
                {Object.entries(mainTopology.device_roles || {}).map(([device, role]) => (
                  <div key={device} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getDeviceRoleIcon(role)}
                      <div>
                        <div className="font-medium text-gray-900">{device}</div>
                        <div className="text-sm text-gray-500">Role: {role}</div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      role === 'core' ? 'bg-blue-100 text-blue-800' :
                      role === 'access' ? 'bg-green-100 text-green-800' :
                      role === 'security' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Network Links</h3>
              <div className="space-y-4">
                {mainTopology.links?.map((link, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <LinkIcon className={`h-5 w-5 ${getLinkStatusColor(link.status)}`} />
                        <div>
                          <div className="font-medium text-gray-900">
                            {link.source_device} → {link.destination_device}
                          </div>
                          <div className="text-sm text-gray-500">
                            {link.source_interface} → {link.destination_interface}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${getLinkStatusColor(link.status)}`}>
                          {link.status}
                        </div>
                        <div className="text-xs text-gray-500">
                          {link.bandwidth} | {link.utilization}% util
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sites' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Network Sites</h3>
              <div className="space-y-4">
                {mainTopology.sites?.map((site, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <BuildingOfficeIcon className="h-5 w-5 text-purple-600 mt-1" />
                        <div>
                          <div className="font-medium text-gray-900">{site.name}</div>
                          <div className="text-sm text-gray-500">ID: {site.site_id}</div>
                          {site.location && (
                            <div className="text-sm text-gray-500 mt-1">
                              {site.location.city}, {site.location.country}
                            </div>
                          )}
                          {site.contact_info && (
                            <div className="text-sm text-gray-500 mt-1">
                              Contact: {site.contact_info.primary_contact}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        site.criticality === 'critical' ? 'bg-red-100 text-red-800' :
                        site.criticality === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {site.criticality}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Network Services</h3>
              <div className="space-y-4">
                {mainTopology.services?.map((service, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <CpuChipIcon className="h-5 w-5 text-blue-600 mt-1" />
                        <div>
                          <div className="font-medium text-gray-900">{service.service_name}</div>
                          <div className="text-sm text-gray-500">Type: {service.service_type}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            Dependent devices: {service.dependent_devices?.join(', ')}
                          </div>
                          {service.sla_requirements && (
                            <div className="text-sm text-gray-500 mt-1">
                              SLA: {service.sla_requirements.availability}% availability
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        service.business_impact === 'critical' ? 'bg-red-100 text-red-800' :
                        service.business_impact === 'high' ? 'bg-orange-100 text-orange-800' :
                        service.business_impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {service.business_impact}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
