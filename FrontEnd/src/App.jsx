/**
 * Main Application Component - Autonomous Network Healing Platform
 * Handles routing and overall application structure
 */

import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Topology from './pages/Topology';
import Alerts from './pages/Alerts';
import Incidents from './pages/Incidents';
import Actions from './pages/Actions';
import Policies from './pages/Policies';

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
        return <Topology />;
      case 'alerts':
        return <Alerts />;
      case 'incidents':
        return <Incidents />;
      case 'actions':
        return <Actions />;
      case 'policies':
        return <Policies />;
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
