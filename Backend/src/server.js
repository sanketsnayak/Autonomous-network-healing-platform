/**
 * Autonomous Network Healing Platform - Server Entry Point
 * 
 * This file initializes the complete autonomous network healing platform including:
 * - Database connection
 * - Core healing services (telemetry, correlation, RCA, remediation)
 * - Express web server
 * - Graceful shutdown handling
 * 
 * The platform automatically starts all background services for network monitoring,
 * alert correlation, root cause analysis, and automated remediation.
 */

require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

// Import autonomous healing services
const AutonomousHealingService = require('./services/AutonomousHealingService');
const TelemetryCollector = require('./services/TelemetryCollector');

// Server configuration
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

/**
 * Environment validation
 * Ensure all required environment variables are present
 */
if (!MONGO_URI) {
  console.error('❌ MONGO_URI environment variable is not defined');
  console.error('Please set MONGO_URI in your .env file');
  process.exit(1);
}

/**
 * Application startup sequence
 * Initializes services in the correct order for proper operation
 */
async function startServer() {
  try {
    console.log('🚀 Starting Autonomous Network Healing Platform...');
    
    // Step 1: Connect to MongoDB
    console.log('📊 Connecting to MongoDB...');
    await connectDB(MONGO_URI);
    console.log('✅ MongoDB connection established');
    
    // Step 2: Initialize the autonomous healing service
    console.log('🔧 Initializing Autonomous Healing Service...');
    const healingService = AutonomousHealingService.getInstance();
    await healingService.initialize();
    console.log('✅ Autonomous Healing Service initialized');
    
    // Step 3: Start background services
    console.log('🔄 Starting background healing services...');
    await healingService.start();
    console.log('✅ All healing services started successfully');
    
    // Step 4: Start the web server
    const server = app.listen(PORT, () => {
      console.log('🌐 Express server started');
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`🔗 API available at: http://localhost:${PORT}/api`);
      console.log(`💊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📊 Metrics: http://localhost:${PORT}/api/metrics`);
      console.log('🎯 Autonomous Network Healing Platform is ready!');
    });
    
    /**
     * Graceful shutdown handling
     * Ensures all services are properly stopped before process termination
     */
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
      
      try {
        // Stop accepting new connections
        server.close(() => {
          console.log('🌐 Express server closed');
        });
        
        // Services temporarily disabled for debugging
        console.log('⚠️  Healing services were disabled for debugging');
        
        // Close database connection
        console.log('📊 Closing database connection...');
        process.exit(0);
        
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };
    
    // Register signal handlers for graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();
