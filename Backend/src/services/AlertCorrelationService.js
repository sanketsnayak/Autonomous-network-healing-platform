const EventEmitter = require('events');
const Alert = require('../models/Alert');
const Incident = require('../models/Incident');
const Device = require('../models/Device');
const Topology = require('../models/Topology');

/**
 * Alert Correlation Service
 * Groups related alerts into incidents using rule-based and temporal correlation
 * Identifies patterns and reduces alert noise by finding root causes
 */
class AlertCorrelationService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Service configuration
    this.config = {
      correlation_window: options.correlation_window || 300000, // 5 minutes correlation window
      max_alerts_per_incident: options.max_alerts_per_incident || 50, // Maximum alerts per incident
      min_correlation_confidence: options.min_correlation_confidence || 0.6, // Minimum confidence for correlation
      auto_incident_creation: options.auto_incident_creation || true, // Automatically create incidents
      deduplication_enabled: options.deduplication_enabled || true, // Enable alert deduplication
      topology_aware: options.topology_aware || true, // Use topology for correlation
      temporal_correlation_enabled: true, // Enable time-based correlation
      max_correlation_distance: 3 // Maximum network hops for topology correlation
    };
    
    // Correlation rules and patterns
    this.correlationRules = new Map();
    this.alertPatterns = new Map();
    this.activeCorrelations = new Map(); // Active correlation sessions
    
    // Processing state
    this.running = false;
    this.processingQueue = [];
    this.correlationCache = new Map(); // Cache for recent correlations
    
    // Statistics
    this.stats = {
      total_alerts_processed: 0,
      incidents_created: 0,
      alerts_correlated: 0,
      deduplication_hits: 0,
      correlation_errors: 0,
      average_correlation_time: 0,
      last_reset: Date.now()
    };
    
    this.init();
  }
  
  /**
   * Initialize the alert correlation service
   */
  init() {
    console.log('Initializing Alert Correlation Service...');
    
    // Load correlation rules
    this.loadCorrelationRules();
    
    // Setup processing pipeline
    this.setupProcessingPipeline();
    
    // Setup periodic tasks
    this.setupPeriodicTasks();
    
    console.log('Alert Correlation Service initialized successfully');
  }
  
  /**
   * Load predefined correlation rules
   */
  loadCorrelationRules() {
    // Rule 1: Interface down cascade - when interface goes down, correlated alerts follow
    this.correlationRules.set('interface_cascade', {
      name: 'Interface Down Cascade',
      description: 'Correlates alerts caused by interface failures',
      trigger_types: ['interface_down'],
      correlated_types: ['bgp_peer_down', 'service_unreachable', 'high_latency'],
      time_window: 120000, // 2 minutes
      topology_dependent: true,
      confidence_score: 0.9
    });
    
    // Rule 2: Device failure cascade - when device fails, all dependent services fail
    this.correlationRules.set('device_failure_cascade', {
      name: 'Device Failure Cascade',
      description: 'Correlates alerts when entire device becomes unreachable',
      trigger_types: ['device_unreachable', 'snmp_timeout'],
      correlated_types: ['interface_down', 'service_unreachable', 'bgp_peer_down'],
      time_window: 180000, // 3 minutes
      topology_dependent: true,
      confidence_score: 0.95
    });
    
    // Rule 3: BGP session flapping - correlate BGP related alerts
    this.correlationRules.set('bgp_flapping', {
      name: 'BGP Session Flapping',
      description: 'Correlates BGP session instability alerts',
      trigger_types: ['bgp_peer_down'],
      correlated_types: ['bgp_peer_up', 'routing_table_change', 'packet_loss'],
      time_window: 300000, // 5 minutes
      topology_dependent: false,
      confidence_score: 0.8
    });
    
    // Rule 4: Performance degradation cluster - high CPU/memory/utilization
    this.correlationRules.set('performance_degradation', {
      name: 'Performance Degradation Cluster',
      description: 'Correlates performance-related alerts',
      trigger_types: ['high_cpu', 'high_memory'],
      correlated_types: ['high_utilization', 'slow_response', 'packet_drops'],
      time_window: 600000, // 10 minutes
      topology_dependent: false,
      confidence_score: 0.7
    });
    
    // Rule 5: Security incident cluster - authentication and security alerts
    this.correlationRules.set('security_incident', {
      name: 'Security Incident Cluster',
      description: 'Correlates security-related alerts',
      trigger_types: ['authentication_failure', 'unauthorized_access'],
      correlated_types: ['config_change', 'unusual_traffic', 'port_scan'],
      time_window: 900000, // 15 minutes
      topology_dependent: false,
      confidence_score: 0.85
    });
    
    console.log(`Loaded ${this.correlationRules.size} correlation rules`);
  }
  
  /**
   * Setup alert processing pipeline
   */
  setupProcessingPipeline() {
    // Process correlation queue every 5 seconds
    setInterval(() => {
      this.processCorrelationQueue();
    }, 5000);
    
    // Clean up old correlations every minute
    setInterval(() => {
      this.cleanupOldCorrelations();
    }, 60000);
  }
  
  /**
   * Process a new alert for correlation
   */
  async processAlert(alert) {
    const startTime = Date.now();
    
    try {
      console.log(`Processing alert for correlation: ${alert.alert_id}`);
      
      // Update statistics
      this.stats.total_alerts_processed++;
      
      // Check for deduplication first
      if (this.config.deduplication_enabled) {
        const isDuplicate = await this.checkForDuplication(alert);
        if (isDuplicate) {
          this.stats.deduplication_hits++;
          return;
        }
      }
      
      // Add to processing queue
      this.processingQueue.push({
        alert: alert,
        timestamp: Date.now(),
        processed: false
      });
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      this.updateAverageCorrelationTime(processingTime);
      
    } catch (error) {
      console.error('Error processing alert for correlation:', error);
      this.stats.correlation_errors++;
    }
  }
  
  /**
   * Check if alert is a duplicate of recent alerts
   */
  async checkForDuplication(alert) {
    try {
      // Look for similar alert within deduplication window
      const duplicateWindow = 60000; // 1 minute
      const existingAlert = await Alert.findOne({
        device: alert.device,
        type: alert.type,
        status: { $in: ['open', 'acknowledged'] },
        createdAt: { $gte: new Date(Date.now() - duplicateWindow) },
        _id: { $ne: alert._id }
      });
      
      if (existingAlert) {
        // Update existing alert occurrence count
        existingAlert.occurrence_count = (existingAlert.occurrence_count || 1) + 1;
        existingAlert.last_occurrence = new Date();
        await existingAlert.save();
        
        // Mark new alert as duplicate
        alert.status = 'suppressed';
        alert.parent_alert = existingAlert._id;
        await alert.save();
        
        console.log(`Alert ${alert.alert_id} marked as duplicate of ${existingAlert.alert_id}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Error checking for alert duplication:', error);
      return false;
    }
  }
  
  /**
   * Process the correlation queue
   */
  async processCorrelationQueue() {
    if (this.processingQueue.length === 0) {
      return;
    }
    
    // Process alerts in batches
    const batchSize = 10;
    const batch = this.processingQueue.splice(0, batchSize);
    
    for (const item of batch) {
      if (!item.processed) {
        await this.performCorrelation(item.alert);
        item.processed = true;
      }
    }
  }
  
  /**
   * Perform correlation analysis for an alert
   */
  async performCorrelation(alert) {
    try {
      console.log(`Performing correlation analysis for alert: ${alert.alert_id}`);
      
      // Find matching correlation rules
      const matchingRules = this.findMatchingRules(alert);
      
      if (matchingRules.length === 0) {
        // No correlation rules match - check for existing incident by device
        await this.checkDeviceIncident(alert);
        return;
      }
      
      // Process each matching rule
      for (const rule of matchingRules) {
        await this.processCorrelationRule(alert, rule);
      }
      
    } catch (error) {
      console.error('Error performing correlation:', error);
      this.stats.correlation_errors++;
    }
  }
  
  /**
   * Find correlation rules that match the alert
   */
  findMatchingRules(alert) {
    const matchingRules = [];
    
    for (const [ruleId, rule] of this.correlationRules) {
      // Check if alert type matches rule trigger types
      if (rule.trigger_types.includes(alert.type)) {
        matchingRules.push({ id: ruleId, ...rule });
      }
    }
    
    return matchingRules;
  }
  
  /**
   * Process a specific correlation rule for an alert
   */
  async processCorrelationRule(alert, rule) {
    try {
      // Find related alerts based on the rule
      const relatedAlerts = await this.findRelatedAlerts(alert, rule);
      
      if (relatedAlerts.length === 0) {
        console.log(`No related alerts found for rule: ${rule.name}`);
        return;
      }
      
      // Calculate correlation confidence
      const confidence = this.calculateCorrelationConfidence(alert, relatedAlerts, rule);
      
      if (confidence < this.config.min_correlation_confidence) {
        console.log(`Correlation confidence too low: ${confidence} < ${this.config.min_correlation_confidence}`);
        return;
      }
      
      // Check for existing incident or create new one
      await this.createOrUpdateIncident(alert, relatedAlerts, rule, confidence);
      
    } catch (error) {
      console.error('Error processing correlation rule:', error);
    }
  }
  
  /**
   * Find alerts related to the current alert based on correlation rule
   */
  async findRelatedAlerts(alert, rule) {
    try {
      const relatedAlerts = [];
      const timeWindow = rule.time_window || this.config.correlation_window;
      const windowStart = new Date(alert.createdAt.getTime() - timeWindow);
      const windowEnd = new Date(alert.createdAt.getTime() + timeWindow);
      
      // Build query for related alerts
      const query = {
        type: { $in: rule.correlated_types },
        status: { $in: ['open', 'acknowledged'] },
        createdAt: { $gte: windowStart, $lte: windowEnd },
        _id: { $ne: alert._id }
      };
      
      // If rule is topology dependent, find topologically related devices
      if (rule.topology_dependent && this.config.topology_aware) {
        const relatedDevices = await this.findTopologicallyRelatedDevices(alert.device);
        if (relatedDevices.length > 0) {
          query.device = { $in: [alert.device, ...relatedDevices] };
        } else {
          query.device = alert.device;
        }
      } else {
        query.device = alert.device;
      }
      
      // Find related alerts
      const alerts = await Alert.find(query).sort({ createdAt: 1 });
      relatedAlerts.push(...alerts);
      
      console.log(`Found ${relatedAlerts.length} related alerts for rule: ${rule.name}`);
      return relatedAlerts;
      
    } catch (error) {
      console.error('Error finding related alerts:', error);
      return [];
    }
  }
  
  /**
   * Find devices that are topologically related to the given device
   */
  async findTopologicallyRelatedDevices(deviceHostname) {
    try {
      if (!this.config.topology_aware) {
        return [];
      }
      
      // Get topology information
      const topology = await Topology.findOne({}).populate('devices');
      if (!topology) {
        return [];
      }
      
      // Find the device in topology
      const device = await Device.findOne({ hostname: deviceHostname });
      if (!device) {
        return [];
      }
      
      // Find directly connected devices
      const connectedDevices = new Set();
      
      // Check topology links
      topology.links.forEach(link => {
        if (link.source_device === deviceHostname) {
          connectedDevices.add(link.destination_device);
        } else if (link.destination_device === deviceHostname) {
          connectedDevices.add(link.source_device);
        }
      });
      
      // Add devices from the same site
      if (device.site) {
        const siteDevices = await Device.find({ 
          site: device.site, 
          hostname: { $ne: deviceHostname } 
        }).limit(10);
        siteDevices.forEach(d => connectedDevices.add(d.hostname));
      }
      
      return Array.from(connectedDevices).slice(0, this.config.max_correlation_distance);
      
    } catch (error) {
      console.error('Error finding topologically related devices:', error);
      return [];
    }
  }
  
  /**
   * Calculate correlation confidence score
   */
  calculateCorrelationConfidence(primaryAlert, relatedAlerts, rule) {
    if (relatedAlerts.length === 0) {
      return 0;
    }
    
    let confidence = rule.confidence_score || 0.5;
    
    // Boost confidence based on number of related alerts
    const alertCountBoost = Math.min(relatedAlerts.length * 0.1, 0.3);
    confidence += alertCountBoost;
    
    // Boost confidence for temporal proximity
    const avgTimeDiff = this.calculateAverageTimeDifference(primaryAlert, relatedAlerts);
    const maxTimeDiff = rule.time_window || this.config.correlation_window;
    const temporalBoost = Math.max(0, (1 - avgTimeDiff / maxTimeDiff) * 0.2);
    confidence += temporalBoost;
    
    // Boost confidence for same device/site
    const sameDeviceCount = relatedAlerts.filter(a => a.device === primaryAlert.device).length;
    const sameDeviceBoost = (sameDeviceCount / relatedAlerts.length) * 0.15;
    confidence += sameDeviceBoost;
    
    // Cap confidence at 1.0
    return Math.min(confidence, 1.0);
  }
  
  /**
   * Calculate average time difference between primary alert and related alerts
   */
  calculateAverageTimeDifference(primaryAlert, relatedAlerts) {
    if (relatedAlerts.length === 0) {
      return 0;
    }
    
    const primaryTime = primaryAlert.createdAt.getTime();
    const totalDiff = relatedAlerts.reduce((sum, alert) => {
      return sum + Math.abs(alert.createdAt.getTime() - primaryTime);
    }, 0);
    
    return totalDiff / relatedAlerts.length;
  }
  
  /**
   * Create new incident or update existing incident with correlated alerts
   */
  async createOrUpdateIncident(primaryAlert, relatedAlerts, rule, confidence) {
    try {
      // Check if any related alerts are already part of an incident
      const existingIncidentAlert = relatedAlerts.find(alert => alert.incident_id);
      
      if (existingIncidentAlert) {
        // Update existing incident
        await this.updateExistingIncident(existingIncidentAlert.incident_id, primaryAlert, relatedAlerts, confidence);
      } else {
        // Create new incident
        await this.createNewIncident(primaryAlert, relatedAlerts, rule, confidence);
      }
      
      this.stats.incidents_created++;
      this.stats.alerts_correlated += relatedAlerts.length + 1;
      
    } catch (error) {
      console.error('Error creating/updating incident:', error);
    }
  }
  
  /**
   * Create a new incident from correlated alerts
   */
  async createNewIncident(primaryAlert, relatedAlerts, rule, confidence) {
    try {
      // Determine incident severity (highest among correlated alerts)
      const allAlerts = [primaryAlert, ...relatedAlerts];
      const severityLevels = { 'critical': 4, 'major': 3, 'minor': 2, 'warning': 1, 'info': 0 };
      const highestSeverity = allAlerts.reduce((max, alert) => {
        return severityLevels[alert.severity] > severityLevels[max] ? alert.severity : max;
      }, 'info');
      
      // Create incident
      const incident = new Incident({
        title: this.generateIncidentTitle(primaryAlert, rule),
        description: this.generateIncidentDescription(primaryAlert, relatedAlerts, rule),
        alerts: allAlerts.map(a => a._id),
        primary_alert: primaryAlert._id,
        alert_count: allAlerts.length,
        affected_devices: [...new Set(allAlerts.map(a => a.device))],
        affected_services: this.extractAffectedServices(allAlerts),
        category: primaryAlert.category,
        severity: highestSeverity,
        priority: this.calculateIncidentPriority(highestSeverity, allAlerts.length),
        first_alert_time: allAlerts.reduce((earliest, alert) => {
          return alert.createdAt < earliest ? alert.createdAt : earliest;
        }, allAlerts[0].createdAt),
        rca_results: [{
          suspected_cause: rule.description,
          confidence_score: confidence,
          analysis_method: 'rule_based',
          rule_matches: [rule.name],
          evidence: [`Matched correlation rule: ${rule.name}`, `${allAlerts.length} related alerts found`]
        }]
      });
      
      await incident.save();
      
      // Update all alerts with incident reference
      await Alert.updateMany(
        { _id: { $in: allAlerts.map(a => a._id) } },
        { 
          $set: { 
            incident_id: incident._id, 
            is_correlated: true,
            correlation_key: incident.incident_id 
          } 
        }
      );
      
      console.log(`Created new incident: ${incident.incident_id} with ${allAlerts.length} alerts`);
      this.emit('incident_created', incident);
      
    } catch (error) {
      console.error('Error creating new incident:', error);
    }
  }
  
  /**
   * Update existing incident with new correlated alerts
   */
  async updateExistingIncident(incidentId, newAlert, relatedAlerts, confidence) {
    try {
      const incident = await Incident.findById(incidentId);
      if (!incident) {
        console.error('Incident not found:', incidentId);
        return;
      }
      
      // Add new alerts to incident
      const newAlerts = [newAlert, ...relatedAlerts.filter(a => !a.incident_id)];
      incident.alerts.push(...newAlerts.map(a => a._id));
      incident.alert_count += newAlerts.length;
      
      // Update affected devices
      const newDevices = newAlerts.map(a => a.device);
      incident.affected_devices = [...new Set([...incident.affected_devices, ...newDevices])];
      
      // Update affected services
      const newServices = this.extractAffectedServices(newAlerts);
      incident.affected_services = [...new Set([...incident.affected_services, ...newServices])];
      
      // Update RCA results
      incident.rca_results.push({
        suspected_cause: 'Additional correlated alerts found',
        confidence_score: confidence,
        analysis_method: 'rule_based',
        evidence: [`${newAlerts.length} additional alerts correlated`]
      });
      
      await incident.save();
      
      // Update new alerts with incident reference
      await Alert.updateMany(
        { _id: { $in: newAlerts.map(a => a._id) } },
        { 
          $set: { 
            incident_id: incident._id, 
            is_correlated: true,
            correlation_key: incident.incident_id 
          } 
        }
      );
      
      console.log(`Updated incident: ${incident.incident_id} with ${newAlerts.length} new alerts`);
      this.emit('incident_updated', incident);
      
    } catch (error) {
      console.error('Error updating existing incident:', error);
    }
  }
  
  /**
   * Check if alert should be added to existing device incident
   */
  async checkDeviceIncident(alert) {
    try {
      // Look for recent incidents for the same device
      const recentIncident = await Incident.findOne({
        affected_devices: alert.device,
        state: { $in: ['open', 'investigating', 'in_progress'] },
        createdAt: { $gte: new Date(Date.now() - this.config.correlation_window) }
      });
      
      if (recentIncident) {
        // Add alert to existing incident
        recentIncident.alerts.push(alert._id);
        recentIncident.alert_count += 1;
        await recentIncident.save();
        
        // Update alert with incident reference
        alert.incident_id = recentIncident._id;
        alert.is_correlated = true;
        alert.correlation_key = recentIncident.incident_id;
        await alert.save();
        
        console.log(`Added alert ${alert.alert_id} to existing incident ${recentIncident.incident_id}`);
      }
      
    } catch (error) {
      console.error('Error checking device incident:', error);
    }
  }
  
  /**
   * Generate incident title based on primary alert and rule
   */
  generateIncidentTitle(primaryAlert, rule) {
    const deviceName = primaryAlert.device || 'Unknown Device';
    const alertType = primaryAlert.type.replace(/_/g, ' ').toUpperCase();
    return `${alertType} - ${deviceName} (${rule.name})`;
  }
  
  /**
   * Generate incident description
   */
  generateIncidentDescription(primaryAlert, relatedAlerts, rule) {
    const deviceCount = new Set([primaryAlert.device, ...relatedAlerts.map(a => a.device)]).size;
    const alertCount = relatedAlerts.length + 1;
    
    return `Incident identified by correlation rule "${rule.name}". ` +
           `Primary alert: ${primaryAlert.type} on ${primaryAlert.device}. ` +
           `${alertCount} total alerts affecting ${deviceCount} device(s). ` +
           `${rule.description}`;
  }
  
  /**
   * Extract affected services from alerts
   */
  extractAffectedServices(alerts) {
    const services = new Set();
    alerts.forEach(alert => {
      if (alert.affected_services) {
        alert.affected_services.forEach(service => services.add(service));
      }
    });
    return Array.from(services);
  }
  
  /**
   * Calculate incident priority based on severity and scope
   */
  calculateIncidentPriority(severity, alertCount) {
    const severityPriority = {
      'critical': 'p1',
      'major': 'p2',
      'minor': 'p3',
      'warning': 'p4',
      'info': 'p4'
    };
    
    let priority = severityPriority[severity] || 'p4';
    
    // Escalate priority for incidents with many alerts
    if (alertCount >= 20 && priority === 'p2') {
      priority = 'p1';
    } else if (alertCount >= 10 && priority === 'p3') {
      priority = 'p2';
    }
    
    return priority;
  }
  
  /**
   * Clean up old correlations and cache entries
   */
  cleanupOldCorrelations() {
    const now = Date.now();
    const maxAge = this.config.correlation_window * 2; // Keep for 2x correlation window
    
    // Clean up correlation cache
    for (const [key, data] of this.correlationCache) {
      if (now - data.timestamp > maxAge) {
        this.correlationCache.delete(key);
      }
    }
    
    // Clean up active correlations
    for (const [key, data] of this.activeCorrelations) {
      if (now - data.timestamp > maxAge) {
        this.activeCorrelations.delete(key);
      }
    }
  }
  
  /**
   * Update average correlation time statistic
   */
  updateAverageCorrelationTime(processingTime) {
    const alpha = 0.1; // Exponential moving average factor
    this.stats.average_correlation_time = 
      (this.stats.average_correlation_time * (1 - alpha)) + (processingTime * alpha);
  }
  
  /**
   * Setup periodic maintenance tasks
   */
  setupPeriodicTasks() {
    // Log statistics every 10 minutes
    setInterval(() => {
      this.logStatistics();
    }, 10 * 60 * 1000);
    
    // Reset statistics every hour
    setInterval(() => {
      this.resetStatistics();
    }, 60 * 60 * 1000);
  }
  
  /**
   * Log correlation statistics
   */
  logStatistics() {
    console.log('Alert Correlation Statistics:', {
      total_alerts_processed: this.stats.total_alerts_processed,
      incidents_created: this.stats.incidents_created,
      alerts_correlated: this.stats.alerts_correlated,
      deduplication_hits: this.stats.deduplication_hits,
      correlation_errors: this.stats.correlation_errors,
      average_correlation_time: Math.round(this.stats.average_correlation_time),
      queue_size: this.processingQueue.length,
      cache_size: this.correlationCache.size
    });
  }
  
  /**
   * Reset statistics counters
   */
  resetStatistics() {
    this.stats = {
      total_alerts_processed: 0,
      incidents_created: 0,
      alerts_correlated: 0,
      deduplication_hits: 0,
      correlation_errors: 0,
      average_correlation_time: 0,
      last_reset: Date.now()
    };
  }
  
  /**
   * Start the correlation service
   */
  start() {
    this.running = true;
    console.log('Alert Correlation Service started');
    this.emit('service_started');
  }
  
  /**
   * Stop the correlation service
   */
  stop() {
    this.running = false;
    this.processingQueue = [];
    this.correlationCache.clear();
    this.activeCorrelations.clear();
    console.log('Alert Correlation Service stopped');
    this.emit('service_stopped');
  }
  
  /**
   * Get service status
   */
  getStatus() {
    return {
      running: this.running,
      config: this.config,
      statistics: this.stats,
      queue_size: this.processingQueue.length,
      correlation_rules: this.correlationRules.size,
      cache_size: this.correlationCache.size
    };
  }
}

module.exports = AlertCorrelationService;
