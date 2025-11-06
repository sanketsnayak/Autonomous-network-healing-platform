/**
 * Main Layout Component for Autonomous Network Healing Platform
 * Provides navigation, header, and overall page structure
 */

import React, { useState } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Settings, 
  Shield, 
  Wifi, 
  Database,
  BarChart3,
  Menu,
  X,
  Bell,
  RefreshCw,
  Heart
} from 'lucide-react';
import { useSystemHealth } from '../hooks/useApi';

const Layout = ({ children, currentPage = 'dashboard' }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { health } = useSystemHealth();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: BarChart3, current: currentPage === 'dashboard' },
    { name: 'Devices', href: '/devices', icon: Database, current: currentPage === 'devices' },
    { name: 'Topology', href: '/topology', icon: Wifi, current: currentPage === 'topology' },
    { name: 'Alerts', href: '/alerts', icon: AlertTriangle, current: currentPage === 'alerts' },
    { name: 'Incidents', href: '/incidents', icon: Shield, current: currentPage === 'incidents' },
    { name: 'Actions', href: '/actions', icon: Activity, current: currentPage === 'actions' },
    { name: 'Policies', href: '/policies', icon: Settings, current: currentPage === 'policies' },
  ];

  const handleNavigation = (href) => {
    // For now, we'll just update the URL fragment
    window.location.hash = href;
    setSidebarOpen(false);
  };

  const getHealthStatus = () => {
    if (!health?.overall_status) return { status: 'unknown', color: 'gray' };
    
    const status = health.overall_status.toLowerCase();
    const colors = {
      healthy: 'green',
      degraded: 'yellow',
      unhealthy: 'red',
      error: 'red',
      unknown: 'gray'
    };
    
    return { status, color: colors[status] || 'gray' };
  };

  const healthStatus = getHealthStatus();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Sidebar */}
      <div className={`w-64 bg-white shadow-lg flex-shrink-0 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto`}>
        <div className="flex items-center justify-between h-16 px-6 bg-blue-600">
          <div className="flex items-center">
            <Heart className="h-8 w-8 text-white" />
            <span className="ml-2 text-white text-lg font-semibold">NetHealing</span>
          </div>
          <button
            className="lg:hidden text-white hover:text-gray-200"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* System Health Status */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">System Health</span>
            <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              healthStatus.color === 'green' ? 'bg-green-100 text-green-800' :
              healthStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
              healthStatus.color === 'red' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-1 ${
                healthStatus.color === 'green' ? 'bg-green-400' :
                healthStatus.color === 'yellow' ? 'bg-yellow-400' :
                healthStatus.color === 'red' ? 'bg-red-400' :
                'bg-gray-400'
              }`} />
              {healthStatus.status}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={`group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    item.current
                      ? 'bg-blue-100 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 flex-shrink-0 ${
                    item.current ? 'text-blue-500' : 'text-gray-500 group-hover:text-gray-700'
                  }`} />
                  {item.name}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Quick Stats */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Services:</span>
              <span className="font-medium">{health?.components ? Object.keys(health.components).length : 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span className="font-medium">{health?.uptime || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center">
              <button
                className="lg:hidden text-gray-500 hover:text-gray-700"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </button>
              <h1 className="ml-4 lg:ml-0 text-2xl font-semibold text-gray-900 capitalize">
                {currentPage.replace('-', ' ')}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full relative">
                <Bell className="h-5 w-5" />
                {health?.alerts_count > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {health.alerts_count > 9 ? '9+' : health.alerts_count}
                  </span>
                )}
              </button>

              {/* Refresh */}
              <button 
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                onClick={() => window.location.reload()}
                title="Refresh"
              >
                <RefreshCw className="h-5 w-5" />
              </button>

              {/* User menu placeholder */}
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">A</span>
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
