const EventEmitter = require('events');
const Incident = require('../models/Incident');
const Alert = require('../models/Alert');
const Device = require('../models/Device');
const Topology = require('../models/Topology');

/**
 * Root Cause Analysis Engine
 * Analyzes incidents to determine probable root causes using rule-based analysis,
 * topology information, and temporal correlation patterns
 */
class RootCauseAnalysisEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Service configuration
    this.config = {
      analysis_timeout: options.analysis_timeout || 30000, // 30 seconds max analysis time
      min_confidence_threshold: options.min_confidence_threshold || 0.5, // Minimum confidence for RCA
      max_root_causes: options.max_root_causes || 5, // Maximum root causes to return
      topology_analysis_enabled: options.topology_analysis_enabled || true, // Use topology for analysis
      temporal_analysis_enabled: options.temporal_analysis_enabled || true, // Use time-based analysis
      historical_analysis_enabled: options.historical_analysis_enabled || true, // Use historical patterns
      dependency_analysis_depth: options.dependency_analysis_depth || 3 // Maximum dependency analysis depth
    };
    
    // RCA rules and patterns
    this.rcaRules = new Map();
    this.historicalPatterns = new Map();
    this.dependencyGraph = new Map();
    
    // Analysis state
    this.running = false;
    this.analysisQueue = [];
    this.activeAnalyses = new Map();
    
    // Statistics
    this.stats = {
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      average_analysis_time: 0,
      high_confidence_results: 0,
      topology_analyses: 0,
      temporal_analyses: 0,
      last_reset: Date.now()
    };
    
    this.init();
  }
  
  /**
   * Initialize the RCA engine
   */
  init() {
    console.log('Initializing Root Cause Analysis Engine...');
    
    // Load RCA rules
    this.loadRCARules();
    
    // Setup analysis pipeline
    this.setupAnalysisPipeline();
    
    // Load dependency graph
    this.loadDependencyGraph();
    
    // Setup periodic tasks
    this.setupPeriodicTasks();
    
    console.log('Root Cause Analysis Engine initialized successfully');
  }
  
  /**
   * Load predefined RCA rules
   */
  loadRCARules() {
    // Rule 1: Interface failure leading to service outages
    this.rcaRules.set('interface_failure_cascade', {
      name: 'Interface Failure Cascade',
      description: 'Interface failure causing downstream service failures',
      conditions: {
        primary_alert_types: ['interface_down'],
        secondary_alert_types: ['service_unreachable', 'bgp_peer_down', 'high_latency'],
        temporal_sequence: true, // Primary must occur before secondary
        topology_dependent: true
      },
      analysis_logic: this.analyzeInterfaceFailureCascade.bind(this),
      confidence_base: 0.85,
      impact_assessment: 'high'
    });
    
    // Rule 2: Device hardware failure
    this.rcaRules.set('device_hardware_failure', {
      name: 'Device Hardware Failure',
      description: 'Hardware failure causing multiple system alerts',
      conditions: {
        primary_alert_types: ['high_temperature', 'power_supply_failure', 'fan_failure'],
        secondary_alert_types: ['device_unreachable', 'high_cpu', 'interface_down'],
        device_scope: 'single', // All alerts from same device
        temporal_window: 300000 // 5 minutes
      },
      analysis_logic: this.analyzeDeviceHardwareFailure.bind(this),
      confidence_base: 0.9,
      impact_assessment: 'critical'
    });
    
    // Rule 3: BGP routing convergence issues
    this.rcaRules.set('bgp_convergence_issue', {
      name: 'BGP Convergence Issue',
      description: 'BGP routing convergence causing connectivity problems',
      conditions: {
        primary_alert_types: ['bgp_peer_down', 'routing_table_change'],
        secondary_alert_types: ['packet_loss', 'high_latency', 'service_unreachable'],
        scope: 'network_wide',
        temporal_pattern: 'oscillating' // Flapping pattern
      },
      analysis_logic: this.analyzeBGPConvergenceIssue.bind(this),
      confidence_base: 0.75,
      impact_assessment: 'high'
    });
    
    // Rule 4: Performance degradation cascade
    this.rcaRules.set('performance_degradation', {
      name: 'Performance Degradation Cascade',
      description: 'Performance issues leading to service degradation',
      conditions: {
        primary_alert_types: ['high_cpu', 'high_memory', 'disk_full'],
        secondary_alert_types: ['slow_response', 'timeout', 'service_degraded'],
        correlation_pattern: 'performance_metrics',
        temporal_window: 600000 // 10 minutes
      },
      analysis_logic: this.analyzePerformanceDegradation.bind(this),
      confidence_base: 0.7,
      impact_assessment: 'medium'
    });
    
    // Rule 5: Security incident pattern
    this.rcaRules.set('security_incident', {
      name: 'Security Incident',
      description: 'Security breach causing system instability',
      conditions: {
        primary_alert_types: ['authentication_failure', 'unauthorized_access', 'unusual_traffic'],
        secondary_alert_types: ['config_change', 'service_restart', 'high_cpu'],
        scope: 'security_related',
        temporal_clustering: true
      },
      analysis_logic: this.analyzeSecurityIncident.bind(this),
      confidence_base: 0.8,
      impact_assessment: 'critical'
    });
    
    // Rule 6: Configuration change impact
    this.rcaRules.set('config_change_impact', {
      name: 'Configuration Change Impact',
      description: 'Configuration change causing operational issues',
      conditions: {
        primary_alert_types: ['config_change'],
        secondary_alert_types: ['service_down', 'connectivity_lost', 'authentication_failure'],
        temporal_sequence: true,
        time_proximity: 1800000 // 30 minutes after config change
      },
      analysis_logic: this.analyzeConfigChangeImpact.bind(this),
      confidence_base: 0.85,
      impact_assessment: 'medium'
    });
    
    console.log(`Loaded ${this.rcaRules.size} RCA rules`);
  }
  
  /**
   * Setup analysis processing pipeline
   */
  setupAnalysisPipeline() {
    // Process analysis queue every 10 seconds
    setInterval(() => {
      this.processAnalysisQueue();
    }, 10000);
    
    // Clean up completed analyses every 5 minutes
    setInterval(() => {
      this.cleanupCompletedAnalyses();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Load dependency graph from topology
   */
  async loadDependencyGraph() {
    try {
      console.log('Loading dependency graph from topology...');
      
      const topology = await Topology.findOne({}).populate('devices');
      if (!topology) {
        console.log('No topology found, dependency graph will be limited');
        return;
      }
      
      // Build dependency graph from topology links
      topology.links.forEach(link => {
        // Add bidirectional dependencies
        this.addDependency(link.source_device, link.destination_device, 'network_link');
        this.addDependency(link.destination_device, link.source_device, 'network_link');
      });
      
      // Add service dependencies
      topology.services.forEach(service => {
        service.dependent_devices.forEach(device => {
          this.addDependency(service.service_name, device, 'service_dependency');
        });
        
        service.critical_devices.forEach(device => {
          this.addDependency(service.service_name, device, 'critical_dependency');
        });
      });
      
      console.log(`Loaded dependency graph with ${this.dependencyGraph.size} nodes`);
      
    } catch (error) {
      console.error('Error loading dependency graph:', error);
    }
  }
  
  /**
   * Add dependency relationship to the graph
   */
  addDependency(source, target, type) {
    if (!this.dependencyGraph.has(source)) {
      this.dependencyGraph.set(source, []);
    }
    
    this.dependencyGraph.get(source).push({
      target: target,
      type: type,
      weight: type === 'critical_dependency' ? 1.0 : type === 'service_dependency' ? 0.8 : 0.6
    });
  }
  
  /**
   * Analyze an incident to determine root cause
   */
  async analyzeIncident(incident) {
    const startTime = Date.now();
    
    try {
      console.log(`Starting RCA for incident: ${incident.incident_id}`);
      
      // Update statistics
      this.stats.total_analyses++;
      
      // Add to analysis queue
      const analysisId = this.generateAnalysisId();
      this.analysisQueue.push({
        id: analysisId,
        incident: incident,
        timestamp: Date.now(),
        status: 'queued'
      });
      
      return analysisId;
      
    } catch (error) {
      console.error('Error starting incident analysis:', error);
      this.stats.failed_analyses++;
      return null;
    }
  }
  
  /**
   * Process the analysis queue
   */
  async processAnalysisQueue() {
    if (this.analysisQueue.length === 0) {
      return;
    }
    
    // Process one analysis at a time to avoid overwhelming the system
    const analysis = this.analysisQueue.shift();
    
    if (analysis.status === 'queued') {
      await this.performAnalysis(analysis);
    }
  }
  
  /**
   * Perform RCA analysis for an incident
   */
  async performAnalysis(analysis) {
    const startTime = Date.now();
    
    try {
      console.log(`Performing RCA analysis: ${analysis.id}`);
      
      analysis.status = 'analyzing';
      this.activeAnalyses.set(analysis.id, analysis);
      
      const incident = analysis.incident;
      
      // Get all alerts for the incident
      const alerts = await Alert.find({ incident_id: incident._id }).sort({ createdAt: 1 });
      
      if (alerts.length === 0) {
        console.log('No alerts found for incident, skipping analysis');
        analysis.status = 'completed';
        return;
      }
      
      // Perform different types of analysis
      const analysisResults = [];
      
      // 1. Rule-based analysis
      const ruleResults = await this.performRuleBasedAnalysis(incident, alerts);
      analysisResults.push(...ruleResults);
      
      // 2. Topology-based analysis
      if (this.config.topology_analysis_enabled) {
        const topologyResults = await this.performTopologyAnalysis(incident, alerts);
        analysisResults.push(...topologyResults);
        this.stats.topology_analyses++;
      }
      
      // 3. Temporal analysis
      if (this.config.temporal_analysis_enabled) {
        const temporalResults = await this.performTemporalAnalysis(incident, alerts);
        analysisResults.push(...temporalResults);
        this.stats.temporal_analyses++;
      }
      
      // 4. Historical pattern analysis
      if (this.config.historical_analysis_enabled) {
        const historicalResults = await this.performHistoricalAnalysis(incident, alerts);
        analysisResults.push(...historicalResults);
      }
      
      // Merge and rank results
      const finalResults = this.mergeAndRankResults(analysisResults);
      
      // Update incident with RCA results
      await this.updateIncidentWithResults(incident, finalResults);
      
      // Update statistics
      const analysisTime = Date.now() - startTime;
      this.updateAverageAnalysisTime(analysisTime);
      this.stats.successful_analyses++;
      
      if (finalResults.length > 0 && finalResults[0].confidence_score >= 0.8) {
        this.stats.high_confidence_results++;
      }
      
      analysis.status = 'completed';
      analysis.results = finalResults;
      
      console.log(`RCA analysis completed: ${analysis.id} (${analysisTime}ms)`);
      this.emit('analysis_completed', { analysisId: analysis.id, incident: incident, results: finalResults });
      
    } catch (error) {
      console.error('Error performing RCA analysis:', error);
      analysis.status = 'failed';
      analysis.error = error.message;
      this.stats.failed_analyses++;
    }
  }
  
  /**
   * Perform rule-based analysis
   */
  async performRuleBasedAnalysis(incident, alerts) {
    const results = [];
    
    try {
      // Group alerts by type
      const alertsByType = this.groupAlertsByType(alerts);
      
      // Check each RCA rule
      for (const [ruleId, rule] of this.rcaRules) {
        const ruleResult = await rule.analysis_logic(incident, alerts, alertsByType);
        
        if (ruleResult && ruleResult.confidence_score >= this.config.min_confidence_threshold) {
          results.push({
            ...ruleResult,
            rule_id: ruleId,
            rule_name: rule.name,
            analysis_method: 'rule_based',
            impact_assessment: rule.impact_assessment
          });
        }
      }
      
    } catch (error) {
      console.error('Error in rule-based analysis:', error);
    }
    
    return results;
  }
  
  /**
   * Analyze interface failure cascade pattern
   */
  async analyzeInterfaceFailureCascade(incident, alerts, alertsByType) {
    try {
      const interfaceDownAlerts = alertsByType['interface_down'] || [];
      const serviceAlerts = alertsByType['service_unreachable'] || [];
      const bgpAlerts = alertsByType['bgp_peer_down'] || [];
      
      if (interfaceDownAlerts.length === 0) {
        return null;
      }
      
      // Find the earliest interface down alert
      const primaryAlert = interfaceDownAlerts.sort((a, b) => a.createdAt - b.createdAt)[0];
      
      // Check for subsequent service failures
      const subsequentAlerts = [...serviceAlerts, ...bgpAlerts].filter(
        alert => alert.createdAt > primaryAlert.createdAt
      );
      
      if (subsequentAlerts.length === 0) {
        return null;
      }
      
      // Calculate confidence based on temporal proximity and affected services
      let confidence = 0.7;
      
      // Boost confidence for quick succession of alerts
      const avgTimeDiff = subsequentAlerts.reduce((sum, alert) => {
        return sum + (alert.createdAt - primaryAlert.createdAt);
      }, 0) / subsequentAlerts.length;
      
      if (avgTimeDiff < 60000) { // Less than 1 minute
        confidence += 0.15;
      } else if (avgTimeDiff < 300000) { // Less than 5 minutes
        confidence += 0.1;
      }
      
      // Boost confidence for topology-related alerts
      const sameDeviceAlerts = subsequentAlerts.filter(alert => alert.device === primaryAlert.device);
      confidence += (sameDeviceAlerts.length / subsequentAlerts.length) * 0.1;
      
      return {
        suspected_cause: `Interface failure on ${primaryAlert.device}`,
        confidence_score: Math.min(confidence, 1.0),
        contributing_factors: [
          `Primary interface: ${primaryAlert.device}`,
          `Affected services: ${subsequentAlerts.length}`,
          `Average cascade time: ${Math.round(avgTimeDiff / 1000)} seconds`
        ],
        evidence: [
          `Interface down alert at ${primaryAlert.createdAt}`,
          `${subsequentAlerts.length} subsequent service failures`,
          `Cascade pattern detected`
        ],
        timeline: this.buildTimeline([primaryAlert, ...subsequentAlerts])
      };
      
    } catch (error) {
      console.error('Error analyzing interface failure cascade:', error);
      return null;
    }
  }
  
  /**
   * Analyze device hardware failure pattern
   */
  async analyzeDeviceHardwareFailure(incident, alerts, alertsByType) {
    try {
      const hardwareAlerts = [
        ...(alertsByType['high_temperature'] || []),
        ...(alertsByType['power_supply_failure'] || []),
        ...(alertsByType['fan_failure'] || [])
      ];
      
      if (hardwareAlerts.length === 0) {
        return null;
      }
      
      // Check if all alerts are from the same device
      const devices = new Set(alerts.map(alert => alert.device));
      if (devices.size > 1) {
        return null; // Multiple devices involved, not a single hardware failure
      }
      
      const device = Array.from(devices)[0];
      
      // Calculate confidence based on hardware alert types and timing
      let confidence = 0.8;
      
      // Boost confidence for multiple hardware alerts
      confidence += Math.min(hardwareAlerts.length * 0.05, 0.15);
      
      // Boost confidence for critical hardware alerts
      const criticalAlerts = hardwareAlerts.filter(alert => 
        ['power_supply_failure', 'high_temperature'].includes(alert.type)
      );
      confidence += criticalAlerts.length * 0.05;
      
      return {
        suspected_cause: `Hardware failure on device ${device}`,
        confidence_score: Math.min(confidence, 1.0),
        contributing_factors: [
          `Device: ${device}`,
          `Hardware alerts: ${hardwareAlerts.length}`,
          `Critical alerts: ${criticalAlerts.length}`
        ],
        evidence: [
          `${hardwareAlerts.length} hardware-related alerts`,
          `All alerts from single device: ${device}`,
          'Hardware failure pattern detected'
        ],
        timeline: this.buildTimeline(alerts)
      };
      
    } catch (error) {
      console.error('Error analyzing device hardware failure:', error);
      return null;
    }
  }
  
  /**
   * Analyze BGP convergence issues
   */
  async analyzeBGPConvergenceIssue(incident, alerts, alertsByType) {
    try {
      const bgpAlerts = [
        ...(alertsByType['bgp_peer_down'] || []),
        ...(alertsByType['bgp_peer_up'] || []),
        ...(alertsByType['routing_table_change'] || [])
      ];
      
      if (bgpAlerts.length < 3) {
        return null; // Not enough BGP events for convergence issue
      }
      
      // Check for flapping pattern (up/down cycles)
      const flappingPattern = this.detectFlappingPattern(bgpAlerts);
      
      let confidence = 0.6;
      
      if (flappingPattern.detected) {
        confidence += 0.2;
      }
      
      // Boost confidence for multiple affected peers
      const affectedPeers = new Set(bgpAlerts.map(alert => alert.device));
      confidence += Math.min(affectedPeers.size * 0.05, 0.15);
      
      return {
        suspected_cause: 'BGP routing convergence issue',
        confidence_score: Math.min(confidence, 1.0),
        contributing_factors: [
          `BGP events: ${bgpAlerts.length}`,
          `Affected peers: ${affectedPeers.size}`,
          `Flapping detected: ${flappingPattern.detected}`
        ],
        evidence: [
          `${bgpAlerts.length} BGP-related alerts`,
          `Multiple peer devices affected`,
          flappingPattern.detected ? 'Flapping pattern detected' : 'Multiple BGP state changes'
        ],
        timeline: this.buildTimeline(bgpAlerts)
      };
      
    } catch (error) {
      console.error('Error analyzing BGP convergence issue:', error);
      return null;
    }
  }
  
  /**
   * Analyze performance degradation pattern
   */
  async analyzePerformanceDegradation(incident, alerts, alertsByType) {
    try {
      const perfAlerts = [
        ...(alertsByType['high_cpu'] || []),
        ...(alertsByType['high_memory'] || []),
        ...(alertsByType['disk_full'] || [])
      ];
      
      if (perfAlerts.length === 0) {
        return null;
      }
      
      // Check for gradual increase in performance alerts
      const timeProgression = this.analyzeTimeProgression(perfAlerts);
      
      let confidence = 0.65;
      
      if (timeProgression.gradual_increase) {
        confidence += 0.15;
      }
      
      // Boost confidence for multiple performance metrics
      const metricTypes = new Set(perfAlerts.map(alert => alert.type));
      confidence += Math.min(metricTypes.size * 0.05, 0.1);
      
      return {
        suspected_cause: 'Performance degradation cascade',
        confidence_score: Math.min(confidence, 1.0),
        contributing_factors: [
          `Performance alerts: ${perfAlerts.length}`,
          `Affected metrics: ${Array.from(metricTypes).join(', ')}`,
          `Pattern: ${timeProgression.gradual_increase ? 'gradual increase' : 'sudden spike'}`
        ],
        evidence: [
          `${perfAlerts.length} performance-related alerts`,
          'Performance metrics exceeding thresholds',
          timeProgression.gradual_increase ? 'Gradual degradation pattern' : 'Sudden performance spike'
        ],
        timeline: this.buildTimeline(perfAlerts)
      };
      
    } catch (error) {
      console.error('Error analyzing performance degradation:', error);
      return null;
    }
  }
  
  /**
   * Analyze security incident pattern
   */
  async analyzeSecurityIncident(incident, alerts, alertsByType) {
    try {
      const securityAlerts = [
        ...(alertsByType['authentication_failure'] || []),
        ...(alertsByType['unauthorized_access'] || []),
        ...(alertsByType['unusual_traffic'] || [])
      ];
      
      if (securityAlerts.length === 0) {
        return null;
      }
      
      // Check for clustering of security events
      const clustering = this.analyzeTemporalClustering(securityAlerts);
      
      let confidence = 0.7;
      
      if (clustering.high_frequency) {
        confidence += 0.15;
      }
      
      // Boost confidence for multiple security alert types
      const securityTypes = new Set(securityAlerts.map(alert => alert.type));
      confidence += Math.min(securityTypes.size * 0.05, 0.1);
      
      return {
        suspected_cause: 'Security incident',
        confidence_score: Math.min(confidence, 1.0),
        contributing_factors: [
          `Security alerts: ${securityAlerts.length}`,
          `Alert types: ${Array.from(securityTypes).join(', ')}`,
          `Frequency: ${clustering.high_frequency ? 'high' : 'normal'}`
        ],
        evidence: [
          `${securityAlerts.length} security-related alerts`,
          'Multiple security event types detected',
          clustering.high_frequency ? 'High frequency security events' : 'Security event cluster'
        ],
        timeline: this.buildTimeline(securityAlerts)
      };
      
    } catch (error) {
      console.error('Error analyzing security incident:', error);
      return null;
    }
  }
  
  /**
   * Analyze configuration change impact
   */
  async analyzeConfigChangeImpact(incident, alerts, alertsByType) {
    try {
      const configAlerts = alertsByType['config_change'] || [];
      
      if (configAlerts.length === 0) {
        return null;
      }
      
      // Find the earliest config change
      const configChange = configAlerts.sort((a, b) => a.createdAt - b.createdAt)[0];
      
      // Find alerts that occurred after the config change
      const subsequentAlerts = alerts.filter(
        alert => alert.type !== 'config_change' && 
                alert.createdAt > configChange.createdAt &&
                alert.createdAt - configChange.createdAt < 1800000 // Within 30 minutes
      );
      
      if (subsequentAlerts.length === 0) {
        return null;
      }
      
      let confidence = 0.75;
      
      // Boost confidence for quick succession after config change
      const avgTimeDiff = subsequentAlerts.reduce((sum, alert) => {
        return sum + (alert.createdAt - configChange.createdAt);
      }, 0) / subsequentAlerts.length;
      
      if (avgTimeDiff < 300000) { // Less than 5 minutes
        confidence += 0.15;
      }
      
      // Boost confidence for same device
      const sameDeviceAlerts = subsequentAlerts.filter(alert => alert.device === configChange.device);
      confidence += (sameDeviceAlerts.length / subsequentAlerts.length) * 0.1;
      
      return {
        suspected_cause: `Configuration change on ${configChange.device}`,
        confidence_score: Math.min(confidence, 1.0),
        contributing_factors: [
          `Config change at: ${configChange.createdAt}`,
          `Subsequent alerts: ${subsequentAlerts.length}`,
          `Average delay: ${Math.round(avgTimeDiff / 1000)} seconds`
        ],
        evidence: [
          `Configuration change detected on ${configChange.device}`,
          `${subsequentAlerts.length} alerts followed within 30 minutes`,
          'Temporal correlation with config change'
        ],
        timeline: this.buildTimeline([configChange, ...subsequentAlerts])
      };
      
    } catch (error) {
      console.error('Error analyzing config change impact:', error);
      return null;
    }
  }
  
  /**
   * Perform topology-based analysis
   */
  async performTopologyAnalysis(incident, alerts) {
    const results = [];
    
    try {
      // Analyze device dependencies
      const dependencyAnalysis = await this.analyzeDependencies(alerts);
      if (dependencyAnalysis) {
        results.push(dependencyAnalysis);
      }
      
      // Analyze network path failures
      const pathAnalysis = await this.analyzeNetworkPaths(alerts);
      if (pathAnalysis) {
        results.push(pathAnalysis);
      }
      
    } catch (error) {
      console.error('Error in topology analysis:', error);
    }
    
    return results;
  }
  
  /**
   * Analyze device dependencies
   */
  async analyzeDependencies(alerts) {
    try {
      // Find potential root devices (devices that other devices depend on)
      const affectedDevices = [...new Set(alerts.map(alert => alert.device))];
      const dependencyScores = new Map();
      
      for (const device of affectedDevices) {
        let score = 0;
        
        // Check how many other affected devices depend on this device
        for (const otherDevice of affectedDevices) {
          if (device !== otherDevice && this.isDependentOn(otherDevice, device)) {
            score += 1;
          }
        }
        
        if (score > 0) {
          dependencyScores.set(device, score);
        }
      }
      
      if (dependencyScores.size === 0) {
        return null;
      }
      
      // Find device with highest dependency score
      const rootDevice = Array.from(dependencyScores.entries())
        .sort((a, b) => b[1] - a[1])[0];
      
      const confidence = Math.min(0.6 + (rootDevice[1] * 0.1), 0.9);
      
      return {
        suspected_cause: `Dependency failure - root device: ${rootDevice[0]}`,
        confidence_score: confidence,
        analysis_method: 'topology_based',
        contributing_factors: [
          `Root device: ${rootDevice[0]}`,
          `Dependent devices: ${rootDevice[1]}`,
          `Total affected: ${affectedDevices.length}`
        ],
        evidence: [
          `Device ${rootDevice[0]} has ${rootDevice[1]} dependent devices affected`,
          'Topology dependency analysis indicates cascading failure',
          'Multiple dependent devices showing alerts'
        ]
      };
      
    } catch (error) {
      console.error('Error analyzing dependencies:', error);
      return null;
    }
  }
  
  /**
   * Perform temporal analysis
   */
  async performTemporalAnalysis(incident, alerts) {
    const results = [];
    
    try {
      // Analyze alert sequence patterns
      const sequenceAnalysis = this.analyzeAlertSequence(alerts);
      if (sequenceAnalysis) {
        results.push(sequenceAnalysis);
      }
      
      // Analyze time-based clustering
      const clusterAnalysis = this.analyzeTemporalClusters(alerts);
      if (clusterAnalysis) {
        results.push(clusterAnalysis);
      }
      
    } catch (error) {
      console.error('Error in temporal analysis:', error);
    }
    
    return results;
  }
  
  /**
   * Helper methods
   */
  
  groupAlertsByType(alerts) {
    const grouped = {};
    alerts.forEach(alert => {
      if (!grouped[alert.type]) {
        grouped[alert.type] = [];
      }
      grouped[alert.type].push(alert);
    });
    return grouped;
  }
  
  buildTimeline(alerts) {
    return alerts
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(alert => ({
        timestamp: alert.createdAt,
        event: `${alert.type} on ${alert.device}`
      }));
  }
  
  detectFlappingPattern(alerts) {
    // Simple flapping detection - alternating up/down states
    let flaps = 0;
    for (let i = 1; i < alerts.length; i++) {
      const prev = alerts[i - 1];
      const curr = alerts[i];
      
      if (prev.device === curr.device) {
        if ((prev.type.includes('down') && curr.type.includes('up')) ||
            (prev.type.includes('up') && curr.type.includes('down'))) {
          flaps++;
        }
      }
    }
    
    return {
      detected: flaps >= 2,
      flap_count: flaps
    };
  }
  
  analyzeTimeProgression(alerts) {
    if (alerts.length < 3) {
      return { gradual_increase: false };
    }
    
    // Check if alerts are increasing in frequency over time
    const sortedAlerts = alerts.sort((a, b) => a.createdAt - b.createdAt);
    const intervals = [];
    
    for (let i = 1; i < sortedAlerts.length; i++) {
      intervals.push(sortedAlerts[i].createdAt - sortedAlerts[i - 1].createdAt);
    }
    
    // Check if intervals are decreasing (increasing frequency)
    let decreasingIntervals = 0;
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i] < intervals[i - 1]) {
        decreasingIntervals++;
      }
    }
    
    return {
      gradual_increase: decreasingIntervals > intervals.length / 2
    };
  }
  
  analyzeTemporalClustering(alerts) {
    if (alerts.length < 3) {
      return { high_frequency: false };
    }
    
    const sortedAlerts = alerts.sort((a, b) => a.createdAt - b.createdAt);
    const timeSpan = sortedAlerts[sortedAlerts.length - 1].createdAt - sortedAlerts[0].createdAt;
    const frequency = alerts.length / (timeSpan / 60000); // alerts per minute
    
    return {
      high_frequency: frequency > 1, // More than 1 alert per minute
      frequency: frequency
    };
  }
  
  isDependentOn(dependent, dependency) {
    const deps = this.dependencyGraph.get(dependent);
    if (!deps) {
      return false;
    }
    
    return deps.some(dep => dep.target === dependency);
  }
  
  mergeAndRankResults(analysisResults) {
    // Remove duplicates and sort by confidence
    const uniqueResults = analysisResults.filter((result, index, self) =>
      index === self.findIndex(r => r.suspected_cause === result.suspected_cause)
    );
    
    // Sort by confidence score descending
    uniqueResults.sort((a, b) => b.confidence_score - a.confidence_score);
    
    // Return top results
    return uniqueResults.slice(0, this.config.max_root_causes);
  }
  
  async updateIncidentWithResults(incident, results) {
    try {
      // Update incident with RCA results
      incident.rca_results = results;
      
      if (results.length > 0) {
        const topResult = results[0];
        incident.final_root_cause = topResult.suspected_cause;
        incident.root_cause_confidence = topResult.confidence_score;
      }
      
      await incident.save();
      
    } catch (error) {
      console.error('Error updating incident with RCA results:', error);
    }
  }
  
  /**
   * Additional helper and utility methods
   */
  
  updateAverageAnalysisTime(analysisTime) {
    const alpha = 0.1;
    this.stats.average_analysis_time = 
      (this.stats.average_analysis_time * (1 - alpha)) + (analysisTime * alpha);
  }
  
  cleanupCompletedAnalyses() {
    const cutoffTime = Date.now() - 3600000; // 1 hour ago
    
    for (const [id, analysis] of this.activeAnalyses) {
      if (analysis.timestamp < cutoffTime && 
          ['completed', 'failed'].includes(analysis.status)) {
        this.activeAnalyses.delete(id);
      }
    }
  }
  
  generateAnalysisId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `RCA-${timestamp}-${random}`;
  }
  
  setupPeriodicTasks() {
    // Log statistics every 15 minutes
    setInterval(() => {
      this.logStatistics();
    }, 15 * 60 * 1000);
    
    // Reset statistics every hour
    setInterval(() => {
      this.resetStatistics();
    }, 60 * 60 * 1000);
  }
  
  logStatistics() {
    console.log('RCA Engine Statistics:', {
      total_analyses: this.stats.total_analyses,
      successful_analyses: this.stats.successful_analyses,
      failed_analyses: this.stats.failed_analyses,
      success_rate: this.stats.total_analyses > 0 ? 
        (this.stats.successful_analyses / this.stats.total_analyses * 100).toFixed(2) + '%' : '0%',
      average_analysis_time: Math.round(this.stats.average_analysis_time),
      high_confidence_results: this.stats.high_confidence_results,
      active_analyses: this.activeAnalyses.size,
      queue_size: this.analysisQueue.length
    });
  }
  
  resetStatistics() {
    this.stats = {
      total_analyses: 0,
      successful_analyses: 0,
      failed_analyses: 0,
      average_analysis_time: 0,
      high_confidence_results: 0,
      topology_analyses: 0,
      temporal_analyses: 0,
      last_reset: Date.now()
    };
  }
  
  start() {
    this.running = true;
    console.log('Root Cause Analysis Engine started');
    this.emit('service_started');
  }
  
  stop() {
    this.running = false;
    this.analysisQueue = [];
    this.activeAnalyses.clear();
    console.log('Root Cause Analysis Engine stopped');
    this.emit('service_stopped');
  }
  
  getStatus() {
    return {
      running: this.running,
      config: this.config,
      statistics: this.stats,
      queue_size: this.analysisQueue.length,
      active_analyses: this.activeAnalyses.size,
      rca_rules: this.rcaRules.size,
      dependency_graph_size: this.dependencyGraph.size
    };
  }
}

module.exports = RootCauseAnalysisEngine;
