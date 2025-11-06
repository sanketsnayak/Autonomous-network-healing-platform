const EventEmitter = require('events');
const dgram = require('dgram');
const net = require('net');
const Alert = require('../models/Alert');
const Device = require('../models/Device');

/**
 * Telemetry Collector Service
 * Collects network telemetry from multiple sources (SNMP traps, syslog, streaming telemetry)
 * and normalizes events into a common format for correlation and analysis
 */
class TelemetryCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Service configuration
    this.config = {
      snmp_port: options.snmp_port || 162,          // SNMP trap listener port
      syslog_port: options.syslog_port || 514,      // Syslog listener port
      enabled_sources: options.enabled_sources || ['snmp', 'syslog'], // Enabled telemetry sources
      max_events_per_second: options.max_events_per_second || 1000,   // Rate limiting
      buffer_size: options.buffer_size || 10000,    // Event buffer size
      normalization_enabled: true,                  // Enable event normalization
      correlation_window: 30000                     // Correlation time window in ms
    };
    
    // Internal state
    this.running = false;                           // Service running state
    this.eventBuffer = [];                          // Event buffer for batch processing
    this.eventCount = 0;                            // Event counter for rate limiting
    this.lastReset = Date.now();                    // Last rate limit reset time
    this.servers = new Map();                       // Network servers (SNMP, syslog)
    
    // Event processing statistics
    this.stats = {
      total_events: 0,                              // Total events processed
      events_per_source: {},                        // Events by source type
      normalization_errors: 0,                     // Normalization failures
      correlation_hits: 0,                          // Successful correlations
      buffer_overflows: 0,                          // Buffer overflow count
      last_reset: Date.now()                        // Last statistics reset
    };
    
    this.init();
  }
  
  /**
   * Initialize the telemetry collector service
   */
  init() {
    console.log('Initializing Telemetry Collector Service...');
    
    // Initialize event processing pipeline
    this.setupEventProcessing();
    
    // Initialize telemetry sources
    if (this.config.enabled_sources.includes('snmp')) {
      this.initSNMPTrapListener();
    }
    
    if (this.config.enabled_sources.includes('syslog')) {
      this.initSyslogListener();
    }
    
    // Setup periodic tasks
    this.setupPeriodicTasks();
    
    console.log('Telemetry Collector Service initialized successfully');
  }
  
  /**
   * Setup event processing pipeline with rate limiting and buffering
   */
  setupEventProcessing() {
    // Process event buffer every second
    setInterval(() => {
      this.processEventBuffer();
    }, 1000);
    
    // Reset rate limiting counter every second
    setInterval(() => {
      const now = Date.now();
      if (now - this.lastReset >= 1000) {
        this.eventCount = 0;
        this.lastReset = now;
      }
    }, 1000);
  }
  
  /**
   * Initialize SNMP trap listener for receiving device alerts
   */
  initSNMPTrapListener() {
    try {
      const snmpServer = dgram.createSocket('udp4');
      
      // Handle incoming SNMP traps
      snmpServer.on('message', (msg, rinfo) => {
        this.handleSNMPTrap(msg, rinfo);
      });
      
      // Handle server errors
      snmpServer.on('error', (err) => {
        console.error('SNMP trap listener error:', err);
        this.emit('error', { source: 'snmp', error: err });
      });
      
      // Start listening for SNMP traps
      snmpServer.bind(this.config.snmp_port, () => {
        console.log(`SNMP trap listener started on port ${this.config.snmp_port}`);
      });
      
      this.servers.set('snmp', snmpServer);
      
    } catch (error) {
      console.error('Failed to initialize SNMP trap listener:', error);
    }
  }
  
  /**
   * Initialize syslog listener for receiving system logs
   */
  initSyslogListener() {
    try {
      const syslogServer = dgram.createSocket('udp4');
      
      // Handle incoming syslog messages
      syslogServer.on('message', (msg, rinfo) => {
        this.handleSyslogMessage(msg, rinfo);
      });
      
      // Handle server errors
      syslogServer.on('error', (err) => {
        console.error('Syslog listener error:', err);
        this.emit('error', { source: 'syslog', error: err });
      });
      
      // Start listening for syslog messages
      syslogServer.bind(this.config.syslog_port, () => {
        console.log(`Syslog listener started on port ${this.config.syslog_port}`);
      });
      
      this.servers.set('syslog', syslogServer);
      
    } catch (error) {
      console.error('Failed to initialize syslog listener:', error);
    }
  }
  
  /**
   * Handle incoming SNMP trap messages
   */
  handleSNMPTrap(message, remoteInfo) {
    try {
      // Check rate limiting
      if (!this.checkRateLimit()) {
        return;
      }
      
      // Parse SNMP trap (simplified parsing - in production use proper SNMP library)
      const rawEvent = {
        source: 'snmp',
        timestamp: new Date(),
        device_ip: remoteInfo.address,
        raw_data: message.toString('hex'),
        size: message.length
      };
      
      // Add to event buffer for processing
      this.addToBuffer(rawEvent);
      
      // Update statistics
      this.updateStats('snmp');
      
    } catch (error) {
      console.error('Error handling SNMP trap:', error);
      this.stats.normalization_errors++;
    }
  }
  
  /**
   * Handle incoming syslog messages
   */
  handleSyslogMessage(message, remoteInfo) {
    try {
      // Check rate limiting
      if (!this.checkRateLimit()) {
        return;
      }
      
      // Parse syslog message
      const syslogText = message.toString();
      const parsedSyslog = this.parseSyslogMessage(syslogText);
      
      const rawEvent = {
        source: 'syslog',
        timestamp: new Date(),
        device_ip: remoteInfo.address,
        message: syslogText,
        parsed_data: parsedSyslog
      };
      
      // Add to event buffer for processing
      this.addToBuffer(rawEvent);
      
      // Update statistics
      this.updateStats('syslog');
      
    } catch (error) {
      console.error('Error handling syslog message:', error);
      this.stats.normalization_errors++;
    }
  }
  
  /**
   * Parse syslog message into structured format
   */
  parseSyslogMessage(message) {
    try {
      // Basic syslog parsing (RFC3164/RFC5424)
      const syslogRegex = /<(\d+)>(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(.+)/;
      const match = message.match(syslogRegex);
      
      if (match) {
        const priority = parseInt(match[1]);
        const facility = Math.floor(priority / 8);
        const severity = priority % 8;
        
        return {
          priority: priority,
          facility: facility,
          severity: severity,
          timestamp: match[2],
          hostname: match[3],
          message: match[4],
          severity_text: this.getSyslogSeverityText(severity)
        };
      }
      
      // If parsing fails, return basic structure
      return {
        message: message,
        severity: 6, // info level
        severity_text: 'info'
      };
      
    } catch (error) {
      console.error('Error parsing syslog message:', error);
      return { message: message, parse_error: true };
    }
  }
  
  /**
   * Convert syslog severity number to text
   */
  getSyslogSeverityText(severity) {
    const severityMap = {
      0: 'emergency',
      1: 'alert',
      2: 'critical',
      3: 'error',
      4: 'warning',
      5: 'notice',
      6: 'info',
      7: 'debug'
    };
    return severityMap[severity] || 'unknown';
  }
  
  /**
   * Check if we're within rate limiting bounds
   */
  checkRateLimit() {
    if (this.eventCount >= this.config.max_events_per_second) {
      // Rate limit exceeded
      return false;
    }
    this.eventCount++;
    return true;
  }
  
  /**
   * Add event to processing buffer
   */
  addToBuffer(event) {
    if (this.eventBuffer.length >= this.config.buffer_size) {
      // Buffer overflow - remove oldest event
      this.eventBuffer.shift();
      this.stats.buffer_overflows++;
    }
    
    this.eventBuffer.push(event);
  }
  
  /**
   * Process events in the buffer
   */
  async processEventBuffer() {
    if (this.eventBuffer.length === 0) {
      return;
    }
    
    // Process events in batches
    const batchSize = Math.min(100, this.eventBuffer.length);
    const batch = this.eventBuffer.splice(0, batchSize);
    
    for (const event of batch) {
      try {
        // Normalize event to common format
        const normalizedEvent = await this.normalizeEvent(event);
        
        if (normalizedEvent) {
          // Emit normalized event for further processing
          this.emit('telemetry_event', normalizedEvent);
          
          // Check if event should generate an alert
          await this.checkAlertConditions(normalizedEvent);
        }
        
      } catch (error) {
        console.error('Error processing event:', error);
        this.stats.normalization_errors++;
      }
    }
  }
  
  /**
   * Normalize raw telemetry events into common format
   */
  async normalizeEvent(rawEvent) {
    try {
      const normalizedEvent = {
        event_id: this.generateEventId(),
        timestamp: rawEvent.timestamp,
        source_system: rawEvent.source,
        device_ip: rawEvent.device_ip,
        device_hostname: null, // Will be enriched
        event_type: 'unknown',
        severity: 'info',
        message: '',
        raw_payload: rawEvent,
        normalized_data: {},
        tags: []
      };
      
      // Enrich with device information
      await this.enrichWithDeviceInfo(normalizedEvent);
      
      // Source-specific normalization
      if (rawEvent.source === 'syslog') {
        this.normalizeSyslogEvent(normalizedEvent, rawEvent);
      } else if (rawEvent.source === 'snmp') {
        this.normalizeSNMPEvent(normalizedEvent, rawEvent);
      }
      
      return normalizedEvent;
      
    } catch (error) {
      console.error('Error normalizing event:', error);
      return null;
    }
  }
  
  /**
   * Normalize syslog events
   */
  normalizeSyslogEvent(normalizedEvent, rawEvent) {
    if (rawEvent.parsed_data) {
      normalizedEvent.severity = this.mapSyslogSeverity(rawEvent.parsed_data.severity_text);
      normalizedEvent.message = rawEvent.parsed_data.message;
      normalizedEvent.normalized_data = {
        facility: rawEvent.parsed_data.facility,
        syslog_severity: rawEvent.parsed_data.severity,
        hostname: rawEvent.parsed_data.hostname
      };
      
      // Determine event type from message content
      normalizedEvent.event_type = this.classifySyslogEvent(rawEvent.parsed_data.message);
    } else {
      normalizedEvent.message = rawEvent.message;
    }
  }
  
  /**
   * Normalize SNMP trap events
   */
  normalizeSNMPEvent(normalizedEvent, rawEvent) {
    // Basic SNMP trap normalization (would use proper SNMP library in production)
    normalizedEvent.event_type = 'snmp_trap';
    normalizedEvent.severity = 'warning';
    normalizedEvent.message = `SNMP trap received from ${rawEvent.device_ip}`;
    normalizedEvent.normalized_data = {
      trap_size: rawEvent.size,
      raw_hex: rawEvent.raw_data.substring(0, 100) // First 100 chars
    };
  }
  
  /**
   * Map syslog severity to normalized severity levels
   */
  mapSyslogSeverity(syslogSeverity) {
    const severityMap = {
      'emergency': 'critical',
      'alert': 'critical',
      'critical': 'critical',
      'error': 'major',
      'warning': 'minor',
      'notice': 'info',
      'info': 'info',
      'debug': 'info'
    };
    return severityMap[syslogSeverity] || 'info';
  }
  
  /**
   * Classify syslog event type based on message content
   */
  classifySyslogEvent(message) {
    const lowerMessage = message.toLowerCase();
    
    // Interface events
    if (lowerMessage.includes('interface') && lowerMessage.includes('down')) {
      return 'interface_down';
    }
    if (lowerMessage.includes('interface') && lowerMessage.includes('up')) {
      return 'interface_up';
    }
    
    // BGP events
    if (lowerMessage.includes('bgp') && lowerMessage.includes('down')) {
      return 'bgp_peer_down';
    }
    if (lowerMessage.includes('bgp') && lowerMessage.includes('up')) {
      return 'bgp_peer_up';
    }
    
    // System events
    if (lowerMessage.includes('cpu') && lowerMessage.includes('high')) {
      return 'high_cpu';
    }
    if (lowerMessage.includes('memory') && lowerMessage.includes('high')) {
      return 'high_memory';
    }
    
    // Authentication events
    if (lowerMessage.includes('login') || lowerMessage.includes('authentication')) {
      return 'authentication_event';
    }
    
    // Configuration events
    if (lowerMessage.includes('config') && lowerMessage.includes('changed')) {
      return 'config_change';
    }
    
    return 'system_message';
  }
  
  /**
   * Enrich event with device information from database
   */
  async enrichWithDeviceInfo(event) {
    try {
      // Find device by IP address
      const device = await Device.findOne({ mgmt_ip: event.device_ip });
      
      if (device) {
        event.device_hostname = device.hostname;
        event.device_vendor = device.vendor;
        event.device_model = device.model;
        event.device_site = device.site;
        event.tags.push(`vendor:${device.vendor}`);
        event.tags.push(`site:${device.site}`);
        
        // Add device-specific context
        event.normalized_data.device_info = {
          hostname: device.hostname,
          vendor: device.vendor,
          model: device.model,
          os_version: device.os_version,
          device_type: device.device_type
        };
      }
      
    } catch (error) {
      console.error('Error enriching event with device info:', error);
    }
  }
  
  /**
   * Check if event should generate an alert
   */
  async checkAlertConditions(event) {
    try {
      // Define alert-worthy event types
      const alertEventTypes = [
        'interface_down',
        'bgp_peer_down',
        'high_cpu',
        'high_memory',
        'device_unreachable',
        'authentication_failure'
      ];
      
      // Check if event type should generate alert
      if (alertEventTypes.includes(event.event_type)) {
        await this.createAlert(event);
      }
      
      // Check severity-based alerting
      if (['critical', 'major'].includes(event.severity)) {
        await this.createAlert(event);
      }
      
    } catch (error) {
      console.error('Error checking alert conditions:', error);
    }
  }
  
  /**
   * Create alert from telemetry event
   */
  async createAlert(event) {
    try {
      // Check for existing similar alert (deduplication)
      const existingAlert = await Alert.findOne({
        device: event.device_hostname || event.device_ip,
        type: event.event_type,
        status: 'open',
        createdAt: { $gte: new Date(Date.now() - this.config.correlation_window) }
      });
      
      if (existingAlert) {
        // Update existing alert occurrence count
        existingAlert.occurrence_count += 1;
        existingAlert.last_occurrence = new Date();
        await existingAlert.save();
        return;
      }
      
      // Create new alert
      const alert = new Alert({
        alert_id: this.generateAlertId(),
        device: event.device_hostname || event.device_ip,
        device_ip: event.device_ip,
        type: event.event_type,
        category: this.getAlertCategory(event.event_type),
        severity: event.severity,
        message: event.message,
        raw_payload: event.raw_payload,
        normalized_data: event.normalized_data,
        source_system: event.source_system,
        telemetry_data: {
          custom_metrics: event.normalized_data
        },
        tags: event.tags
      });
      
      await alert.save();
      
      // Emit alert created event
      this.emit('alert_created', alert);
      
      console.log(`Alert created: ${alert.alert_id} - ${alert.message}`);
      
    } catch (error) {
      console.error('Error creating alert:', error);
    }
  }
  
  /**
   * Get alert category based on event type
   */
  getAlertCategory(eventType) {
    const categoryMap = {
      'interface_down': 'network',
      'interface_up': 'network',
      'bgp_peer_down': 'network',
      'bgp_peer_up': 'network',
      'high_cpu': 'performance',
      'high_memory': 'performance',
      'authentication_event': 'security',
      'authentication_failure': 'security',
      'config_change': 'system',
      'system_message': 'system'
    };
    return categoryMap[eventType] || 'network';
  }
  
  /**
   * Generate unique event ID
   */
  generateEventId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `EVT-${timestamp}-${random}`;
  }
  
  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `ALT-${timestamp}-${random}`;
  }
  
  /**
   * Update processing statistics
   */
  updateStats(source) {
    this.stats.total_events++;
    this.stats.events_per_source[source] = (this.stats.events_per_source[source] || 0) + 1;
  }
  
  /**
   * Setup periodic maintenance tasks
   */
  setupPeriodicTasks() {
    // Log statistics every 5 minutes
    setInterval(() => {
      this.logStatistics();
    }, 5 * 60 * 1000);
    
    // Reset statistics every hour
    setInterval(() => {
      this.resetStatistics();
    }, 60 * 60 * 1000);
  }
  
  /**
   * Log processing statistics
   */
  logStatistics() {
    console.log('Telemetry Collector Statistics:', {
      total_events: this.stats.total_events,
      events_per_source: this.stats.events_per_source,
      buffer_size: this.eventBuffer.length,
      normalization_errors: this.stats.normalization_errors,
      buffer_overflows: this.stats.buffer_overflows
    });
  }
  
  /**
   * Reset statistics counters
   */
  resetStatistics() {
    this.stats = {
      total_events: 0,
      events_per_source: {},
      normalization_errors: 0,
      correlation_hits: 0,
      buffer_overflows: 0,
      last_reset: Date.now()
    };
  }
  
  /**
   * Start the telemetry collector service
   */
  start() {
    this.running = true;
    console.log('Telemetry Collector Service started');
    this.emit('service_started');
  }
  
  /**
   * Stop the telemetry collector service
   */
  stop() {
    this.running = false;
    
    // Close all network servers
    this.servers.forEach((server, name) => {
      server.close();
      console.log(`${name} listener stopped`);
    });
    
    this.servers.clear();
    console.log('Telemetry Collector Service stopped');
    this.emit('service_stopped');
  }
  
  /**
   * Get service status and statistics
   */
  getStatus() {
    return {
      running: this.running,
      config: this.config,
      statistics: this.stats,
      buffer_size: this.eventBuffer.length,
      active_servers: Array.from(this.servers.keys())
    };
  }
}

module.exports = TelemetryCollector;
