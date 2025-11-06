/**
 * Main Application Component - Autonomous Network Healing Platform
 * Handles routing and overall application structure
 */

import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Simple hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || '/';
      const page = hash.split('/')[1] || 'dashboard';
      setCurrentPage(page);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Set initial page

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Render the appropriate page component
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'devices':
        return <Devices />;
      case 'topology':
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Network Topology</h2>
            <p className="text-gray-600">Topology visualization coming soon...</p>
          </div>
        );
      case 'alerts':
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Alert Management</h2>
            <p className="text-gray-600">Alert management interface coming soon...</p>
          </div>
        );
      case 'incidents':
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Incident Management</h2>
            <p className="text-gray-600">Incident management interface coming soon...</p>
          </div>
        );
      case 'actions':
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Remediation Actions</h2>
            <p className="text-gray-600">Action management interface coming soon...</p>
          </div>
        );
      case 'policies':
        return (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Automation Policies</h2>
            <p className="text-gray-600">Policy management interface coming soon...</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="App">
      <Layout currentPage={currentPage}>
        {renderCurrentPage()}
      </Layout>
      
      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#10b981',
            },
          },
          error: {
            style: {
              background: '#ef4444',
            },
          },
        }}
      />
    </div>
  );
}

export default App;
