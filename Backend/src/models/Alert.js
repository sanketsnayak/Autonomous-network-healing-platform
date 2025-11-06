const mongoose = require('mongoose');

// Enhanced alert schema for autonomous network healing
const AlertSchema = new mongoose.Schema({
  // Alert identification and source
  alert_id: { type: String, unique: true, required: true }, // Unique alert identifier
  device: { type: String, required: true },                 // Device hostname that generated alert
  device_ip: String,                                        // Device IP address
  
  // Alert classification
  type: { type: String, required: true },                   // Alert type (interface_down, high_cpu, bgp_peer_down, etc.)
  category: { type: String, enum: ['network', 'system', 'security', 'performance'], default: 'network' }, // Alert category
  severity: { type: String, enum: ['critical', 'major', 'minor', 'warning', 'info'], default: 'major' }, // Alert severity level
  
  // Alert content and context
  message: { type: String, required: true },                // Human-readable alert message
  raw_payload: { type: Object, default: {} },               // Original raw alert data from device
  normalized_data: { type: Object, default: {} },           // Processed/normalized alert data
  
  // Alert lifecycle management
  status: { type: String, enum: ['open', 'acknowledged', 'in_progress', 'resolved', 'suppressed'], default: 'open' }, // Alert status
  acknowledged_by: String,                                   // User who acknowledged the alert
  assigned_to: String,                                       // User assigned to handle alert
  
  // Correlation and incident tracking
  incident_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident' }, // Associated incident
  correlation_key: String,                                   // Key for grouping related alerts
  is_correlated: { type: Boolean, default: false },         // Whether alert is part of an incident
  parent_alert: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }, // Parent alert if this is a child
  
  // Automation and healing context
  auto_remediation_attempted: { type: Boolean, default: false }, // Whether auto-healing was tried
  remediation_action: { type: mongoose.Schema.Types.ObjectId, ref: 'Action' }, // Associated remediation action
  suppression_rule: String,                                  // Rule that suppressed this alert
  
  // Timing information
  first_occurrence: { type: Date, default: Date.now },      // First time this alert occurred
  last_occurrence: { type: Date, default: Date.now },       // Most recent occurrence
  occurrence_count: { type: Number, default: 1 },           // Number of times alert has occurred
  createdAt: { type: Date, default: Date.now },             // Alert creation timestamp
  acknowledgedAt: Date,                                      // Alert acknowledgment timestamp
  resolvedAt: Date,                                          // Alert resolution timestamp
  
  // Source and telemetry data
  source_system: { type: String, default: 'NMS' },          // System that generated alert (SNMP, syslog, etc.)
  telemetry_data: {                                          // Associated telemetry at time of alert
    cpu: Number,
    memory: Number,
    interface_stats: Object,
    custom_metrics: Object
  },
  
  // Alert enrichment
  impact_level: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }, // Business impact
  affected_services: [String],                               // Services impacted by this alert
  escalation_level: { type: Number, default: 0 },          // Number of escalations
  
  // Metadata
  tags: [String],                                           // Custom tags for filtering/grouping
  custom_fields: { type: Object, default: {} }             // Extensible custom data
});

// Index for efficient querying
AlertSchema.index({ device: 1, type: 1, status: 1 });     // Query alerts by device, type, and status
AlertSchema.index({ createdAt: -1 });                     // Sort by creation time
AlertSchema.index({ incident_id: 1 });                    // Query alerts by incident
AlertSchema.index({ correlation_key: 1 });                // Group correlated alerts

// Update last_occurrence on save if alert is recurring
AlertSchema.pre('save', function() {
  if (this.isModified('occurrence_count') && this.occurrence_count > 1) {
    this.last_occurrence = new Date();
  }
});

module.exports = mongoose.model('Alert', AlertSchema);
