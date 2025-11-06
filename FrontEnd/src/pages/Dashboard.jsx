/**
 * Dashboard Page - Main overview of the Autonomous Network Healing Platform
 * Displays real-time metrics, alerts, device status, and system health
 */

import React, { useState } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Database, 
  Shield, 
  TrendingUp, 
  Wifi,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Target,
  Settings
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useDevices, useAlerts, useIncidents, useActions, useSystemHealth } from '../hooks/useApi';
import { formatRelativeTime, getStatusColor, formatPercent } from '../utils/helpers';

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState('24h');
  
  // Fetch data using custom hooks
  const { devices, deviceCount, onlineDevices, offlineDevices, loading: devicesLoading } = useDevices();
  const { alerts, alertStats, loading: alertsLoading } = useAlerts();
  const { incidentStats, loading: incidentsLoading } = useIncidents();
  const { actions, actionStats, loading: actionsLoading } = useActions();
  const { health, loading: healthLoading } = useSystemHealth();

  // Generate trend data based on real device/alert data or placeholder
  const generateTrendData = () => {
    // In a real application, this would come from historical metrics API
    // For now, generate basic data based on current metrics
    const baseLatency = 25;
    const baseThroughput = 85;
    const timePoints = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
    
    return timePoints.map((time) => ({
      time,
      latency: baseLatency + (Math.random() * 10 - 5), // Random variation ±5ms
      throughput: baseThroughput + (Math.random() * 20 - 10), // Random variation ±10%
      errors: Math.floor(Math.random() * (alertStats.total || 5)) // Based on current alerts
    }));
  };

  const networkTrendData = generateTrendData();

  const deviceStatusData = [
    { name: 'Online', value: onlineDevices, color: '#10b981' },
    { name: 'Offline', value: offlineDevices, color: '#ef4444' },
    { name: 'Degraded', value: devices.filter(d => d.status === 'degraded').length, color: '#f59e0b' },
  ];

  const alertSeverityData = [
    { name: 'Critical', value: alertStats.critical, color: '#ef4444' },
    { name: 'Major', value: alertStats.major, color: '#f97316' },
    { name: 'Minor', value: alertStats.minor, color: '#eab308' },
    { name: 'Warning', value: alertStats.warning, color: '#06b6d4' },
  ];

  // Stat cards data
  const statCards = [
    {
      title: 'Total Devices',
      value: deviceCount,
      change: `${onlineDevices} online`,
      changeType: onlineDevices === deviceCount ? 'positive' : offlineDevices > 0 ? 'negative' : 'neutral',
      icon: Database,
      color: 'blue',
      loading: devicesLoading
    },
    {
      title: 'Active Alerts',
      value: alertStats.open,
      change: alertStats.total > 0 ? `-${((alertStats.total - alertStats.open) / alertStats.total * 100).toFixed(1)}%` : '0%',
      changeType: alertStats.open < 5 ? 'positive' : 'negative',
      icon: AlertTriangle,
      color: 'red',
      loading: alertsLoading
    },
    {
      title: 'Open Incidents',
      value: incidentStats.open,
      change: incidentStats.resolved > 0 ? `+${incidentStats.resolved} resolved` : 'No changes',
      changeType: incidentStats.open === 0 ? 'positive' : 'negative',
      icon: Shield,
      color: 'orange',
      loading: incidentsLoading
    },
    {
      title: 'Healing Actions',
      value: actionStats.completed,
      change: `${actionStats.running} running`,
      changeType: 'neutral',
      icon: Activity,
      color: 'green',
      loading: actionsLoading
    },
  ];

  const getStatCardColor = (color) => {
    const colors = {
      blue: 'bg-blue-500',
      red: 'bg-red-500',
      orange: 'bg-orange-500',
      green: 'bg-green-500',
    };
    return colors[color] || 'bg-gray-500';
  };

  if (devicesLoading || alertsLoading || incidentsLoading || healthLoading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Network Overview</h2>
          <p className="text-gray-600">Real-time monitoring and autonomous healing status</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="block w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-3 rounded-md ${getStatCardColor(stat.color)}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">{stat.title}</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {stat.loading ? '...' : stat.value}
                        </div>
                        <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                          stat.changeType === 'positive' ? 'text-green-600' :
                          stat.changeType === 'negative' ? 'text-red-600' :
                          'text-gray-500'
                        }`}>
                          {stat.change}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Performance Trends */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Network Performance</h3>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={networkTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="latency" stroke="#3b82f6" name="Latency (ms)" />
              <Line type="monotone" dataKey="throughput" stroke="#10b981" name="Throughput (%)" />
              <Line type="monotone" dataKey="errors" stroke="#ef4444" name="Error Count" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Device Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Device Status</h3>
            <Wifi className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={deviceStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {deviceStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert Severity Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Alert Severity</h3>
            <AlertTriangle className="h-5 w-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={alertSeverityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill={(entry) => entry.color} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* System Health Components */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
            <Zap className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {health?.components && Object.entries(health.components).map(([name, status]) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center">
                  {status === 'healthy' ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  ) : status === 'error' ? (
                    <XCircle className="h-5 w-5 text-red-500 mr-3" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-500 mr-3" />
                  )}
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {name.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Alerts</h3>
            <AlertTriangle className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                  <p className="text-xs text-gray-500">{alert.device} • {formatRelativeTime(alert.createdAt)}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(alert.severity)}`}>
                  {alert.severity}
                </span>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>No active alerts</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Actions */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Actions</h3>
            <Activity className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {actions.slice(0, 5).map((action) => (
              <div key={action._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{action.action_type}</p>
                  <p className="text-xs text-gray-500">{action.target_device} • {formatRelativeTime(action.executedAt)}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(action.status)}`}>
                  {action.status}
                </span>
              </div>
            ))}
            {actions.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <Settings className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <p>No recent actions</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Autonomous Healing Status */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Autonomous Healing Status</h3>
          <Target className="h-5 w-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{formatPercent(95.2)}</div>
            <div className="text-sm text-gray-500">Network Availability</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{formatPercent(88.7)}</div>
            <div className="text-sm text-gray-500">Auto-Resolution Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">2.3min</div>
            <div className="text-sm text-gray-500">Avg Response Time</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
