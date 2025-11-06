const EventEmitter = require('events');
const TelemetryCollector = require('./TelemetryCollector');
const AlertCorrelationService = require('./AlertCorrelationService');
const RootCauseAnalysisEngine = require('./RootCauseAnalysisEngine');
const RemediationEngine = require('./RemediationEngine');

/**
 * Autonomous Network Healing Service
 * Main orchestrator that coordinates all healing components:
 * - Telemetry collection and alert generation
 * - Alert correlation and incident creation
 * - Root cause analysis
 * - Automated remediation
 */
class AutonomousHealingService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Service configuration
    this.config = {
      enabled: options.enabled !== undefined ? options.enabled : true, // Master enable/disable
      telemetry_enabled: options.telemetry_enabled !== undefined ? options.telemetry_enabled : true,
      correlation_enabled: options.correlation_enabled !== undefined ? options.correlation_enabled : true,
      rca_enabled: options.rca_enabled !== undefined ? options.rca_enabled : true,
      remediation_enabled: options.remediation_enabled !== undefined ? options.remediation_enabled : true,
      auto_remediation: options.auto_remediation !== undefined ? options.auto_remediation : false, // Start with manual approval
      healing_mode: options.healing_mode || 'conservative', // conservative, moderate, aggressive
      max_concurrent_incidents: options.max_concurrent_incidents || 10, // Maximum incidents to process simultaneously
      incident_timeout: options.incident_timeout || 3600000, // 1 hour timeout for incident processing
      health_check_interval: options.health_check_interval || 60000, // Health check every minute
      metrics_collection_interval: options.metrics_collection_interval || 300000 // Metrics every 5 minutes
    };
    
    // Component services
    this.services = {
      telemetryCollector: null,
      alertCorrelation: null,
      rcaEngine: null,
      remediationEngine: null
    };
    
    // Service state
    this.running = false;
    this.startTime = null;
    this.activeIncidents = new Map(); // Track active incident processing
    this.healingPipeline = new Map(); // Track incidents through the healing pipeline
    
    // Overall statistics
    this.stats = {
      service_uptime: 0,
      total_alerts_processed: 0,
      total_incidents_created: 0,
      total_rca_analyses: 0,
      total_actions_executed: 0,
      successful_healings: 0,
      failed_healings: 0,
      average_healing_time: 0,
      component_health: {
        telemetry_collector: 'unknown',
        alert_correlation: 'unknown',
        rca_engine: 'unknown',
        remediation_engine: 'unknown'
      },
      last_reset: Date.now()
    };
    
    // Remove automatic init() call to prevent duplicate initialization
  }
  
  /**
   * Initialize the autonomous healing service
   */
  async initialize() {
    console.log('Initializing Autonomous Network Healing Service...');
    
    // Initialize component services
    this.initializeServices();
    
    // Setup event handlers for service coordination
    this.setupEventHandlers();
    
    // Setup health monitoring
    this.setupHealthMonitoring();
    
    // Setup metrics collection
    this.setupMetricsCollection();
    
    console.log('Autonomous Network Healing Service initialized successfully');
  }

  /**
   * Alias for initialize() for backward compatibility
   */
  async init() {
    return this.initialize();
  }
  
  /**
   * Initialize all component services
   */
  initializeServices() {
    try {
      console.log('Initializing component services...');
      
      // Initialize Telemetry Collector
      if (this.config.telemetry_enabled) {
        try {
          this.services.telemetryCollector = new TelemetryCollector({
            snmp_port: process.env.SNMP_PORT || 1162, // Use alternative port 1162 instead of 162
            syslog_port: process.env.SYSLOG_PORT || 1514, // Use alternative port 1514 instead of 514
            enabled_sources: ['snmp', 'syslog'],
            max_events_per_second: 1000
          });
          console.log('✅ Telemetry Collector initialized');
        } catch (error) {
          console.warn('⚠️  Telemetry Collector initialization failed:', error.message);
          this.services.telemetryCollector = null;
        }
      }
      
      // Initialize Alert Correlation Service
      if (this.config.correlation_enabled) {
        try {
          this.services.alertCorrelation = new AlertCorrelationService({
            correlation_window: 300000, // 5 minutes
            auto_incident_creation: true,
            topology_aware: true
          });
          console.log('✅ Alert Correlation Service initialized');
        } catch (error) {
          console.warn('⚠️  Alert Correlation Service initialization failed:', error.message);
          this.services.alertCorrelation = null;
        }
      }
      
      // Initialize Root Cause Analysis Engine
      if (this.config.rca_enabled) {
        try {
          this.services.rcaEngine = new RootCauseAnalysisEngine({
            analysis_timeout: 30000,
            topology_analysis_enabled: true,
            temporal_analysis_enabled: true,
            historical_analysis_enabled: true
          });
          console.log('✅ Root Cause Analysis Engine initialized');
        } catch (error) {
          console.warn('⚠️  Root Cause Analysis Engine initialization failed:', error.message);
          this.services.rcaEngine = null;
        }
      }
      
      // Initialize Remediation Engine
      if (this.config.remediation_enabled) {
        try {
          this.services.remediationEngine = new RemediationEngine({
            auto_approval_enabled: this.config.auto_remediation,
            dry_run_mode: false,
            rollback_enabled: true,
            max_concurrent_actions: this.getMaxConcurrentActions()
          });
          console.log('✅ Remediation Engine initialized');
        } catch (error) {
          console.warn('⚠️  Remediation Engine initialization failed:', error.message);
          this.services.remediationEngine = null;
        }
      }
      
      console.log('All component services initialized');
      
    } catch (error) {
      console.error('Error initializing services:', error);
      throw error;
    }
  }
  
  /**
   * Get maximum concurrent actions based on healing mode
   */
  getMaxConcurrentActions() {
    switch (this.config.healing_mode) {
      case 'conservative':
        return 2;
      case 'moderate':
        return 5;
      case 'aggressive':
        return 10;
      default:
        return 3;
    }
  }
  
  /**
   * Setup event handlers for inter-service coordination
   */
  setupEventHandlers() {
    // Telemetry Collector -> Alert Correlation
    if (this.services.telemetryCollector && this.services.alertCorrelation) {
      this.services.telemetryCollector.on('alert_created', async (alert) => {
        try {
          console.log(`Processing new alert: ${alert.alert_id} for correlation`);
          this.stats.total_alerts_processed++;
          
          // Send alert to correlation service
          await this.services.alertCorrelation.processAlert(alert);
          
        } catch (error) {
          console.error('Error processing alert for correlation:', error);
        }
      });
    }
    
    // Alert Correlation -> RCA Engine
    if (this.services.alertCorrelation && this.services.rcaEngine) {
      this.services.alertCorrelation.on('incident_created', async (incident) => {
        try {
          console.log(`New incident created: ${incident.incident_id}, starting healing pipeline`);
          this.stats.total_incidents_created++;
          
          // Start incident through healing pipeline
          await this.processIncidentThroughPipeline(incident);
          
        } catch (error) {
          console.error('Error processing incident through pipeline:', error);
        }
      });
      
      this.services.alertCorrelation.on('incident_updated', async (incident) => {
        try {
          console.log(`Incident updated: ${incident.incident_id}, checking if RCA needs update`);
          
          // Check if incident is already in pipeline
          if (this.healingPipeline.has(incident.incident_id)) {
            const pipelineData = this.healingPipeline.get(incident.incident_id);
            
            // If RCA hasn't completed yet, trigger re-analysis
            if (pipelineData.stage === 'correlation' || pipelineData.stage === 'rca') {
              await this.performRootCauseAnalysis(incident);
            }
          }
          
        } catch (error) {
          console.error('Error handling incident update:', error);
        }
      });
    }
    
    // RCA Engine -> Remediation Engine
    if (this.services.rcaEngine && this.services.remediationEngine) {
      this.services.rcaEngine.on('analysis_completed', async (analysisData) => {
        try {
          const { incident, results } = analysisData;
          console.log(`RCA completed for incident: ${incident.incident_id}, triggering remediation`);
          
          // Update pipeline stage
          this.updatePipelineStage(incident.incident_id, 'rca_completed', { rca_results: results });
          
          // Generate and queue remediation action
          await this.generateRemediationAction(incident);
          
        } catch (error) {
          console.error('Error handling RCA completion:', error);
        }
      });
    }
    
    // Remediation Engine events
    if (this.services.remediationEngine) {
      this.services.remediationEngine.on('action_generated', (data) => {
        const { incident, action } = data;
        console.log(`Remediation action generated: ${action.action_id} for incident: ${incident.incident_id}`);
        this.updatePipelineStage(incident.incident_id, 'action_generated', { action: action });
      });
      
      this.services.remediationEngine.on('action_completed', async (data) => {
        const { action, success } = data;
        console.log(`Action completed: ${action.action_id}, success: ${success}`);
        
        this.stats.total_actions_executed++;
        
        if (success) {
          await this.handleSuccessfulHealing(action);
        } else {
          await this.handleFailedHealing(action, data.reason);
        }
      });
      
      this.services.remediationEngine.on('approval_required', (action) => {
        console.log(`Manual approval required for action: ${action.action_id}`);
        this.emit('approval_required', action);
        this.updatePipelineStage(action.incident_id, 'approval_required', { action: action });
      });
    }
    
    // Service health events
    Object.values(this.services).forEach(service => {
      if (service) {
        service.on('service_started', () => {
          this.updateComponentHealth(service.constructor.name, 'healthy');
        });
        
        service.on('service_stopped', () => {
          this.updateComponentHealth(service.constructor.name, 'stopped');
        });
        
        service.on('error', (error) => {
          console.error(`Service error in ${service.constructor.name}:`, error);
          this.updateComponentHealth(service.constructor.name, 'error');
        });
      }
    });
  }
  
  /**
   * Process incident through the complete healing pipeline
   */
  async processIncidentThroughPipeline(incident) {
    const startTime = Date.now();
    
    try {
      console.log(`Starting healing pipeline for incident: ${incident.incident_id}`);
      
      // Add incident to healing pipeline tracking
      this.healingPipeline.set(incident.incident_id, {
        incident: incident,
        start_time: startTime,
        stage: 'correlation',
        events: [],
        current_action: null,
        timeout: setTimeout(() => {
          this.handlePipelineTimeout(incident.incident_id);
        }, this.config.incident_timeout)
      });
      
      // Stage 1: Root Cause Analysis
      await this.performRootCauseAnalysis(incident);
      
    } catch (error) {
      console.error(`Error processing incident ${incident.incident_id} through pipeline:`, error);
      this.handlePipelineError(incident.incident_id, error);
    }
  }
  
  /**
   * Perform root cause analysis for incident
   */
  async performRootCauseAnalysis(incident) {
    try {
      console.log(`Performing RCA for incident: ${incident.incident_id}`);
      
      // Update pipeline stage
      this.updatePipelineStage(incident.incident_id, 'rca', { started_at: new Date() });
      
      // Trigger RCA analysis
      if (this.services.rcaEngine) {
        this.stats.total_rca_analyses++;
        const analysisId = await this.services.rcaEngine.analyzeIncident(incident);
        
        if (analysisId) {
          console.log(`RCA analysis started: ${analysisId} for incident: ${incident.incident_id}`);
        } else {
          console.log(`RCA analysis could not be started for incident: ${incident.incident_id}`);
          // Proceed without detailed RCA
          await this.generateRemediationAction(incident);
        }
      } else {
        console.log('RCA Engine not available, skipping RCA');
        await this.generateRemediationAction(incident);
      }
      
    } catch (error) {
      console.error('Error performing RCA:', error);
      throw error;
    }
  }
  
  /**
   * Generate remediation action for incident
   */
  async generateRemediationAction(incident) {
    try {
      console.log(`Generating remediation action for incident: ${incident.incident_id}`);
      
      // Update pipeline stage
      this.updatePipelineStage(incident.incident_id, 'remediation', { started_at: new Date() });
      
      // Generate remediation action
      if (this.services.remediationEngine) {
        const action = await this.services.remediationEngine.generateRemediationAction(incident);
        
        if (action) {
          console.log(`Remediation action generated: ${action.action_id} for incident: ${incident.incident_id}`);
          this.updatePipelineStage(incident.incident_id, 'action_queued', { action: action });
        } else {
          console.log(`No remediation action could be generated for incident: ${incident.incident_id}`);
          this.completePipeline(incident.incident_id, false, 'No remediation action available');
        }
      } else {
        console.log('Remediation Engine not available, completing pipeline without action');
        this.completePipeline(incident.incident_id, false, 'Remediation engine not available');
      }
      
    } catch (error) {
      console.error('Error generating remediation action:', error);
      throw error;
    }
  }
  
  /**
   * Handle successful healing completion
   */
  async handleSuccessfulHealing(action) {
    try {
      console.log(`Healing completed successfully for action: ${action.action_id}`);
      
      // Find incident for this action
      const pipelineData = Array.from(this.healingPipeline.values())
        .find(data => data.current_action && data.current_action.action_id === action.action_id);
      
      if (pipelineData) {
        this.stats.successful_healings++;
        this.completePipeline(pipelineData.incident.incident_id, true, 'Healing completed successfully');
      }
      
      // Emit healing success event
      this.emit('healing_completed', { action: action, success: true });
      
    } catch (error) {
      console.error('Error handling successful healing:', error);
    }
  }
  
  /**
   * Handle failed healing
   */
  async handleFailedHealing(action, reason) {
    try {
      console.log(`Healing failed for action: ${action.action_id}, reason: ${reason}`);
      
      // Find incident for this action
      const pipelineData = Array.from(this.healingPipeline.values())
        .find(data => data.current_action && data.current_action.action_id === action.action_id);
      
      if (pipelineData) {
        this.stats.failed_healings++;
        
        // Check if we should try alternative remediation
        if (this.shouldRetryHealing(pipelineData.incident, reason)) {
          console.log(`Retrying healing for incident: ${pipelineData.incident.incident_id}`);
          await this.generateRemediationAction(pipelineData.incident);
        } else {
          this.completePipeline(pipelineData.incident.incident_id, false, `Healing failed: ${reason}`);
        }
      }
      
      // Emit healing failure event
      this.emit('healing_failed', { action: action, reason: reason });
      
    } catch (error) {
      console.error('Error handling failed healing:', error);
    }
  }
  
  /**
   * Determine if healing should be retried
   */
  shouldRetryHealing(incident, reason) {
    // Implement retry logic based on incident characteristics and failure reason
    // For now, implement basic retry logic
    
    // Don't retry if it's a safety check failure
    if (reason === 'safety_check_failed') {
      return false;
    }
    
    // Don't retry if already tried multiple times
    const pipelineData = this.healingPipeline.get(incident.incident_id);
    if (pipelineData && pipelineData.events.filter(e => e.stage === 'action_generated').length > 2) {
      return false;
    }
    
    // Don't retry for critical incidents in conservative mode
    if (this.config.healing_mode === 'conservative' && incident.severity === 'critical') {
      return false;
    }
    
    return true;
  }
  
  /**
   * Update pipeline stage for an incident
   */
  updatePipelineStage(incidentId, stage, data = {}) {
    const pipelineData = this.healingPipeline.get(incidentId);
    
    if (pipelineData) {
      pipelineData.stage = stage;
      pipelineData.events.push({
        stage: stage,
        timestamp: new Date(),
        data: data
      });
      
      // Update current action if provided
      if (data.action) {
        pipelineData.current_action = data.action;
      }
      
      console.log(`Pipeline stage updated for incident ${incidentId}: ${stage}`);
    }
  }
  
  /**
   * Complete pipeline processing for an incident
   */
  completePipeline(incidentId, success, reason) {
    const pipelineData = this.healingPipeline.get(incidentId);
    
    if (pipelineData) {
      // Clear timeout
      clearTimeout(pipelineData.timeout);
      
      // Calculate healing time
      const healingTime = Date.now() - pipelineData.start_time;
      this.updateAverageHealingTime(healingTime);
      
      // Update pipeline data
      pipelineData.stage = success ? 'completed' : 'failed';
      pipelineData.completed_at = new Date();
      pipelineData.success = success;
      pipelineData.completion_reason = reason;
      pipelineData.healing_time = healingTime;
      
      console.log(`Pipeline completed for incident ${incidentId}: ${success ? 'SUCCESS' : 'FAILED'} (${healingTime}ms) - ${reason}`);
      
      // Emit pipeline completion event
      this.emit('pipeline_completed', {
        incident: pipelineData.incident,
        success: success,
        reason: reason,
        healing_time: healingTime,
        events: pipelineData.events
      });
      
      // Remove from active pipeline after a delay (for debugging/audit)
      setTimeout(() => {
        this.healingPipeline.delete(incidentId);
      }, 300000); // Keep for 5 minutes
    }
  }
  
  /**
   * Handle pipeline timeout
   */
  handlePipelineTimeout(incidentId) {
    console.log(`Pipeline timeout for incident: ${incidentId}`);
    this.completePipeline(incidentId, false, 'Pipeline timeout');
  }
  
  /**
   * Handle pipeline error
   */
  handlePipelineError(incidentId, error) {
    console.error(`Pipeline error for incident ${incidentId}:`, error);
    this.completePipeline(incidentId, false, `Pipeline error: ${error.message}`);
  }
  
  /**
   * Update component health status
   */
  updateComponentHealth(componentName, status) {
    const normalizedName = componentName.toLowerCase().replace(/service|engine/, '').trim();
    
    if (this.stats.component_health[normalizedName] !== undefined) {
      this.stats.component_health[normalizedName] = status;
    }
    
    console.log(`Component health updated: ${normalizedName} = ${status}`);
  }
  
  /**
   * Setup health monitoring for all components
   */
  setupHealthMonitoring() {
    setInterval(() => {
      this.performHealthCheck();
    }, this.config.health_check_interval);
  }
  
  /**
   * Perform health check on all components
   */
  performHealthCheck() {
    try {
      // Check each service
      Object.entries(this.services).forEach(([name, service]) => {
        if (service) {
          try {
            const status = service.getStatus();
            
            if (status.running) {
              this.updateComponentHealth(name, 'healthy');
            } else {
              this.updateComponentHealth(name, 'stopped');
            }
          } catch (error) {
            console.error(`Health check failed for ${name}:`, error);
            this.updateComponentHealth(name, 'error');
          }
        } else {
          this.updateComponentHealth(name, 'disabled');
        }
      });
      
      // Update service uptime
      if (this.startTime) {
        this.stats.service_uptime = Date.now() - this.startTime;
      }
      
    } catch (error) {
      console.error('Error performing health check:', error);
    }
  }
  
  /**
   * Setup metrics collection
   */
  setupMetricsCollection() {
    setInterval(() => {
      this.collectMetrics();
    }, this.config.metrics_collection_interval);
  }
  
  /**
   * Collect metrics from all components
   */
  collectMetrics() {
    try {
      // Collect metrics from each service
      Object.entries(this.services).forEach(([name, service]) => {
        if (service && service.getStatus) {
          try {
            const serviceStatus = service.getStatus();
            
            // Aggregate service-specific metrics into overall stats
            if (serviceStatus.statistics) {
              this.aggregateServiceMetrics(name, serviceStatus.statistics);
            }
            
          } catch (error) {
            console.error(`Error collecting metrics from ${name}:`, error);
          }
        }
      });
      
      // Log comprehensive metrics
      this.logComprehensiveMetrics();
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }
  
  /**
   * Aggregate metrics from individual services
   */
  aggregateServiceMetrics(serviceName, serviceStats) {
    // This is where you would aggregate specific metrics based on service type
    // For now, we'll just track the basic counts we already have
    
    switch (serviceName) {
      case 'telemetryCollector':
        // Already tracked via events
        break;
      case 'alertCorrelation':
        // Already tracked via events
        break;
      case 'rcaEngine':
        // Already tracked via events
        break;
      case 'remediationEngine':
        // Already tracked via events
        break;
    }
  }
  
  /**
   * Update average healing time statistic
   */
  updateAverageHealingTime(healingTime) {
    const alpha = 0.1; // Exponential moving average factor
    this.stats.average_healing_time = 
      (this.stats.average_healing_time * (1 - alpha)) + (healingTime * alpha);
  }
  
  /**
   * Log comprehensive service metrics
   */
  logComprehensiveMetrics() {
    console.log('=== Autonomous Network Healing Service Metrics ===');
    console.log('Service Status:', {
      running: this.running,
      uptime_hours: this.stats.service_uptime ? (this.stats.service_uptime / (1000 * 60 * 60)).toFixed(2) : 0,
      healing_mode: this.config.healing_mode,
      auto_remediation: this.config.auto_remediation
    });
    
    console.log('Component Health:', this.stats.component_health);
    
    console.log('Processing Statistics:', {
      total_alerts_processed: this.stats.total_alerts_processed,
      total_incidents_created: this.stats.total_incidents_created,
      total_rca_analyses: this.stats.total_rca_analyses,
      total_actions_executed: this.stats.total_actions_executed
    });
    
    console.log('Healing Performance:', {
      successful_healings: this.stats.successful_healings,
      failed_healings: this.stats.failed_healings,
      success_rate: this.stats.total_actions_executed > 0 ? 
        ((this.stats.successful_healings / this.stats.total_actions_executed) * 100).toFixed(2) + '%' : '0%',
      average_healing_time: Math.round(this.stats.average_healing_time)
    });
    
    console.log('Active Processing:', {
      active_incidents: this.healingPipeline.size,
      pipeline_stages: this.getPipelineStageBreakdown()
    });
    
    console.log('================================================');
  }
  
  /**
   * Get breakdown of incidents by pipeline stage
   */
  getPipelineStageBreakdown() {
    const breakdown = {};
    
    for (const [incidentId, pipelineData] of this.healingPipeline) {
      const stage = pipelineData.stage;
      breakdown[stage] = (breakdown[stage] || 0) + 1;
    }
    
    return breakdown;
  }
  
  /**
   * Get current service configuration
   */
  getConfiguration() {
    return {
      ...this.config,
      services_enabled: {
        telemetry_collector: !!this.services.telemetryCollector,
        alert_correlation: !!this.services.alertCorrelation,
        rca_engine: !!this.services.rcaEngine,
        remediation_engine: !!this.services.remediationEngine
      }
    };
  }
  
  /**
   * Update service configuration
   */
  async updateConfiguration(newConfig) {
    try {
      console.log('Updating service configuration:', newConfig);
      
      // Validate configuration
      const validConfig = this.validateConfiguration(newConfig);
      
      // Update configuration
      Object.assign(this.config, validConfig);
      
      // Apply configuration changes to components
      await this.applyConfigurationChanges();
      
      console.log('Service configuration updated successfully');
      this.emit('configuration_updated', this.config);
      
    } catch (error) {
      console.error('Error updating configuration:', error);
      throw error;
    }
  }
  
  /**
   * Validate configuration parameters
   */
  validateConfiguration(config) {
    const validConfig = {};
    
    // Validate boolean flags
    ['enabled', 'telemetry_enabled', 'correlation_enabled', 'rca_enabled', 'remediation_enabled', 'auto_remediation']
      .forEach(key => {
        if (config[key] !== undefined) {
          validConfig[key] = Boolean(config[key]);
        }
      });
    
    // Validate healing mode
    if (config.healing_mode && ['conservative', 'moderate', 'aggressive'].includes(config.healing_mode)) {
      validConfig.healing_mode = config.healing_mode;
    }
    
    // Validate numeric parameters
    ['max_concurrent_incidents', 'incident_timeout', 'health_check_interval', 'metrics_collection_interval']
      .forEach(key => {
        if (config[key] !== undefined && !isNaN(config[key]) && config[key] > 0) {
          validConfig[key] = Number(config[key]);
        }
      });
    
    return validConfig;
  }
  
  /**
   * Apply configuration changes to component services
   */
  async applyConfigurationChanges() {
    // Update remediation engine auto-approval setting
    if (this.services.remediationEngine) {
      this.services.remediationEngine.config.auto_approval_enabled = this.config.auto_remediation;
      this.services.remediationEngine.config.max_concurrent_actions = this.getMaxConcurrentActions();
    }
    
    // Additional configuration propagation can be added here
  }
  
  /**
   * Start the autonomous healing service
   */
  async start() {
    try {
      console.log('Starting Autonomous Network Healing Service...');
      
      if (!this.config.enabled) {
        console.log('Service is disabled in configuration');
        return;
      }
      
      this.running = true;
      this.startTime = Date.now();
      
      // Start component services
      if (this.services.telemetryCollector) {
        this.services.telemetryCollector.start();
      }
      
      if (this.services.alertCorrelation) {
        this.services.alertCorrelation.start();
      }
      
      if (this.services.rcaEngine) {
        this.services.rcaEngine.start();
      }
      
      if (this.services.remediationEngine) {
        this.services.remediationEngine.start();
      }
      
      console.log('Autonomous Network Healing Service started successfully');
      console.log(`Healing mode: ${this.config.healing_mode}`);
      console.log(`Auto-remediation: ${this.config.auto_remediation ? 'enabled' : 'disabled'}`);
      
      this.emit('service_started');
      
    } catch (error) {
      console.error('Error starting Autonomous Network Healing Service:', error);
      throw error;
    }
  }
  
  /**
   * Stop the autonomous healing service
   */
  async stop() {
    try {
      console.log('Stopping Autonomous Network Healing Service...');
      
      this.running = false;
      
      // Stop component services
      if (this.services.remediationEngine) {
        this.services.remediationEngine.stop();
      }
      
      if (this.services.rcaEngine) {
        this.services.rcaEngine.stop();
      }
      
      if (this.services.alertCorrelation) {
        this.services.alertCorrelation.stop();
      }
      
      if (this.services.telemetryCollector) {
        this.services.telemetryCollector.stop();
      }
      
      // Clear active pipelines
      for (const [incidentId, pipelineData] of this.healingPipeline) {
        clearTimeout(pipelineData.timeout);
      }
      this.healingPipeline.clear();
      
      console.log('Autonomous Network Healing Service stopped');
      this.emit('service_stopped');
      
    } catch (error) {
      console.error('Error stopping Autonomous Network Healing Service:', error);
      throw error;
    }
  }
  
  /**
   * Get comprehensive service status
   */
  getStatus() {
    return {
      running: this.running,
      configuration: this.getConfiguration(),
      statistics: this.stats,
      active_pipelines: this.healingPipeline.size,
      pipeline_breakdown: this.getPipelineStageBreakdown(),
      component_status: Object.fromEntries(
        Object.entries(this.services).map(([name, service]) => [
          name,
          service ? (service.getStatus ? service.getStatus() : { available: true }) : { available: false }
        ])
      )
    };
  }
  
  /**
   * Reset service statistics
   */
  resetStatistics() {
    this.stats = {
      service_uptime: this.stats.service_uptime, // Keep uptime
      total_alerts_processed: 0,
      total_incidents_created: 0,
      total_rca_analyses: 0,
      total_actions_executed: 0,
      successful_healings: 0,
      failed_healings: 0,
      average_healing_time: 0,
      component_health: this.stats.component_health, // Keep component health
      last_reset: Date.now()
    };
    
    console.log('Service statistics reset');
    this.emit('statistics_reset');
  }

  /**
   * Singleton pattern implementation
   * Ensures only one instance of the healing service exists
   */
  static getInstance(options = {}) {
    if (!AutonomousHealingService.instance) {
      AutonomousHealingService.instance = new AutonomousHealingService(options);
    }
    return AutonomousHealingService.instance;
  }

  /**
   * Check if singleton instance exists
   */
  static hasInstance() {
    return !!AutonomousHealingService.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance() {
    if (AutonomousHealingService.instance) {
      AutonomousHealingService.instance.stop();
      AutonomousHealingService.instance = null;
    }
  }
}

// Static property to hold the singleton instance
AutonomousHealingService.instance = null;

module.exports = AutonomousHealingService;
