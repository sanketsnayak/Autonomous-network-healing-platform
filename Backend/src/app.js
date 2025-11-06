/**
 * Network Management System - Express Application
 * 
 * This file configures the Express.js application for the Autonomous Network Healing Platform.
 * It sets up middleware, routes, and exposes health endpoints for the backend services.
 * 
 * Features:
 * - RESTful API routes for devices, alerts, incidents, policies, and topology
 * - Health monitoring endpoints for all autonomous healing services
 * - CORS and JSON middleware for client communication
 * - Request logging with Morgan
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Import API route handlers
const devicesRouter = require('./routes/devices');
const alertsRouter = require('./routes/alerts');
const incidentsRouter = require('./routes/incidents');
const policiesRouter = require('./routes/policies');
const topologyRouter = require('./routes/topology');
const actionsRouter = require('./routes/actions');

// Import autonomous healing service for health endpoints
const AutonomousHealingService = require('./services/AutonomousHealingService');

const app = express();

// Middleware configuration
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON request bodies
app.use(morgan('dev')); // Log HTTP requests in development format

/**
 * API Routes Configuration
 * Each route handles a specific domain of the network management system
 */
app.use('/api/devices', devicesRouter);           // Device management and monitoring
app.use('/api/alerts', alertsRouter);             // Alert handling and notifications
app.use('/api/incidents', incidentsRouter);       // Incident lifecycle management
app.use('/api/policies', policiesRouter);         // Policy-driven automation rules
app.use('/api/topology', topologyRouter);         // Network topology and dependencies
app.use('/api/actions', actionsRouter);           // Remediation action management

/**
 * Health and Monitoring Endpoints
 * These endpoints provide real-time status of the autonomous healing platform
 */

// Main service health endpoint
app.get('/', (req, res) => {
  res.json({ 
    ok: true, 
    service: 'autonomous-network-healing-platform',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Comprehensive health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const healingService = AutonomousHealingService.getInstance();
    const healthStatus = healingService.getStatus();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: healthStatus,
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      uptime: process.uptime()
    });
  }
});

// Service metrics endpoint for monitoring
app.get('/api/metrics', async (req, res) => {
  try {
    const healingService = AutonomousHealingService.getInstance();
    const status = healingService.getStatus();
    
    res.json({
      timestamp: new Date().toISOString(),
      metrics: {
        statistics: status.statistics,
        active_pipelines: status.active_pipelines,
        pipeline_breakdown: status.pipeline_breakdown,
        component_status: status.component_status
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Service configuration endpoint
app.get('/api/config', async (req, res) => {
  try {
    const healingService = AutonomousHealingService.getInstance();
    const config = healingService.getConfiguration();
    
    res.json({
      timestamp: new Date().toISOString(),
      configuration: config
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve configuration',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Error Handling Middleware
 * Provides consistent error responses across the application
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Handle 404 errors for unknown routes
// Note: This must be the last middleware, after all routes are defined
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /api/health',
      'GET /api/metrics', 
      'GET /api/config',
      'GET /api/devices',
      'GET /api/alerts',
      'GET /api/incidents',
      'GET /api/policies',
      'GET /api/topology',
      'GET /api/actions'
    ]
  });
});

module.exports = app;
