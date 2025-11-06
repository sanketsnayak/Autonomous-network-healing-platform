const mongoose = require('mongoose');

// Root cause analysis results schema
const RCAResultSchema = new mongoose.Schema({
  suspected_cause: String,                                    // Primary suspected root cause
  confidence_score: { type: Number, min: 0, max: 1 },       // Confidence level (0-1)
  contributing_factors: [String],                            // Additional contributing factors
  evidence: [String],                                        // Evidence supporting this RCA
  analysis_method: { type: String, enum: ['rule_based', 'ml_based', 'hybrid'], default: 'rule_based' }, // Analysis method used
  rule_matches: [String],                                    // Specific rules that matched
  topology_impact: Object,                                   // Topology analysis results
  timeline: [{ timestamp: Date, event: String }]            // Timeline of events leading to incident
}, { _id: false });

// Remediation tracking schema
const RemediationSchema = new mongoose.Schema({
  action_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Action' }, // Associated remediation action
  status: { type: String, enum: ['pending', 'approved', 'executing', 'completed', 'failed', 'rolled_back'], default: 'pending' },
  approval_required: { type: Boolean, default: true },      // Whether human approval is needed
  approved_by: String,                                       // User who approved the action
  executed_at: Date,                                         // When remediation was executed
  execution_log: [String],                                   // Log of execution steps
  success: { type: Boolean, default: false },               // Whether remediation succeeded
  rollback_performed: { type: Boolean, default: false },    // Whether rollback was executed
  post_verification: {                                       // Post-remediation verification results
    verified: Boolean,
    verification_time: Date,
    verification_results: Object
  }
}, { _id: false });

// Enhanced incident schema for autonomous healing
const IncidentSchema = new mongoose.Schema({
  // Incident identification
  incident_id: { type: String, unique: true, required: true }, // Unique incident identifier
  title: String,                                             // Human-readable incident title
  description: String,                                       // Detailed incident description
  
  // Alert correlation and grouping
  alerts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }], // Associated alerts
  primary_alert: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }, // Main triggering alert
  alert_count: { type: Number, default: 0 },                // Number of correlated alerts
  
  // Affected infrastructure
  affected_devices: [String],                                // List of impacted device hostnames
  affected_services: [String],                               // List of impacted services
  affected_sites: [String],                                  // List of impacted sites/locations
  impact_scope: { type: String, enum: ['device', 'site', 'service', 'network'], default: 'device' }, // Scope of impact
  
  // Incident classification
  category: { type: String, enum: ['network', 'system', 'security', 'performance'], default: 'network' },
  severity: { type: String, enum: ['critical', 'major', 'minor', 'warning'], default: 'major' },
  priority: { type: String, enum: ['p1', 'p2', 'p3', 'p4'], default: 'p3' }, // Business priority
  
  // Incident lifecycle
  state: { type: String, enum: ['open', 'investigating', 'in_progress', 'resolved', 'closed', 'escalated'], default: 'open' },
  assigned_to: String,                                       // User assigned to incident
  escalation_level: { type: Number, default: 0 },          // Number of escalations
  
  // Root cause analysis
  rca_results: [RCAResultSchema],                           // Array of RCA analysis results
  final_root_cause: String,                                 // Confirmed root cause after investigation
  root_cause_confidence: { type: Number, min: 0, max: 1 }, // Confidence in final root cause
  
  // Autonomous healing and remediation
  auto_healing_enabled: { type: Boolean, default: true },   // Whether auto-healing is allowed
  remediation_attempts: [RemediationSchema],                // History of remediation attempts
  current_remediation: RemediationSchema,                   // Current active remediation
  manual_intervention_required: { type: Boolean, default: false }, // Whether human intervention is needed
  
  // Timing and SLA tracking
  createdAt: { type: Date, default: Date.now },            // Incident creation time
  first_alert_time: Date,                                   // Time of first related alert
  acknowledged_at: Date,                                     // When incident was acknowledged
  investigation_started_at: Date,                           // When investigation began
  remediation_started_at: Date,                             // When remediation began
  resolvedAt: Date,                                         // When incident was resolved
  closedAt: Date,                                           // When incident was closed
  
  // SLA metrics
  time_to_detect: Number,                                   // Minutes from problem to detection
  time_to_acknowledge: Number,                              // Minutes from detection to acknowledgment
  time_to_resolve: Number,                                  // Minutes from detection to resolution
  sla_breach: { type: Boolean, default: false },           // Whether SLA was breached
  
  // Communication and notifications
  notifications_sent: [{ recipient: String, method: String, timestamp: Date }], // Notification history
  stakeholders_notified: [String],                          // List of notified stakeholders
  communication_log: [{ timestamp: Date, user: String, message: String }], // Communication history
  
  // Post-incident analysis
  lessons_learned: String,                                  // Post-incident lessons learned
  action_items: [{ description: String, assigned_to: String, due_date: Date, completed: Boolean }], // Follow-up actions
  prevention_measures: [String],                            // Measures to prevent recurrence
  
  // Metadata and custom fields
  tags: [String],                                           // Custom tags for categorization
  custom_fields: { type: Object, default: {} },            // Extensible custom data
  external_ticket_id: String,                              // External ticketing system reference
  
  // Audit trail
  status_history: [{                                        // History of status changes
    status: String,
    changed_by: String,
    changed_at: { type: Date, default: Date.now },
    reason: String
  }]
});

// Indexes for efficient querying
IncidentSchema.index({ state: 1, severity: 1 });          // Query by state and severity
IncidentSchema.index({ createdAt: -1 });                  // Sort by creation time
IncidentSchema.index({ affected_devices: 1 });            // Query by affected devices
IncidentSchema.index({ affected_services: 1 });           // Query by affected services

// Generate incident ID automatically
IncidentSchema.pre('save', function() {
  if (!this.incident_id) {
    // Generate unique incident ID (INC-YYYYMMDD-NNNN format)
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    this.incident_id = `INC-${dateStr}-${randomNum}`;
  }
});

// Calculate SLA metrics on save
IncidentSchema.pre('save', function() {
  if (this.isModified('acknowledgedAt') && this.first_alert_time) {
    this.time_to_acknowledge = Math.floor((this.acknowledgedAt - this.first_alert_time) / (1000 * 60)); // in minutes
  }
  if (this.isModified('resolvedAt') && this.first_alert_time) {
    this.time_to_resolve = Math.floor((this.resolvedAt - this.first_alert_time) / (1000 * 60)); // in minutes
  }
});

module.exports = mongoose.model('Incident', IncidentSchema);
