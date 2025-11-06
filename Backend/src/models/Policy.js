const mongoose = require('mongoose');

// Condition schema for policy rules
const ConditionSchema = new mongoose.Schema({
  field: String,                                            // Field to evaluate (alert.type, device.vendor, etc.)
  operator: { type: String, enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'in', 'not_in'], required: true },
  value: mongoose.Schema.Types.Mixed,                       // Value to compare against
  logical_operator: { type: String, enum: ['AND', 'OR'], default: 'AND' } // How to combine with next condition
}, { _id: false });

// Action template schema for policy-driven responses
const ActionTemplateSchema = new mongoose.Schema({
  action_type: String,                                      // Type of action to execute
  parameters: { type: Object, default: {} },               // Default parameters for action
  risk_level: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  requires_approval: { type: Boolean, default: true },     // Whether action needs approval
  delay_seconds: { type: Number, default: 0 },             // Delay before executing action
  max_attempts: { type: Number, default: 3 }               // Maximum execution attempts
}, { _id: false });

// Enhanced policy schema for autonomous healing decisions
const PolicySchema = new mongoose.Schema({
  // Policy identification
  policy_id: { type: String, unique: true, required: true }, // Unique policy identifier
  name: { type: String, required: true },                   // Human-readable policy name
  description: String,                                      // Detailed policy description
  version: { type: String, default: '1.0' },               // Policy version
  
  // Policy classification and scope
  category: { type: String, enum: ['remediation', 'escalation', 'suppression', 'notification'], default: 'remediation' },
  scope: { type: String, enum: ['global', 'site', 'device_type', 'service'], default: 'global' }, // Policy application scope
  target_devices: [String],                                 // Specific devices (if scope is device-specific)
  target_sites: [String],                                   // Specific sites (if scope is site-specific)
  target_services: [String],                                // Specific services (if scope is service-specific)
  
  // Policy rule conditions
  trigger_conditions: [ConditionSchema],                    // Conditions that trigger this policy
  exclude_conditions: [ConditionSchema],                    // Conditions that exclude this policy
  time_conditions: {                                        // Time-based conditions
    business_hours_only: { type: Boolean, default: false },
    maintenance_window_only: { type: Boolean, default: false },
    allowed_days: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }],
    allowed_hours: { start: String, end: String }
  },
  
  // Policy actions and responses
  actions: [ActionTemplateSchema],                          // Actions to execute when policy matches
  escalation_rules: {                                       // Escalation configuration
    auto_escalate: { type: Boolean, default: false },
    escalation_delay: { type: Number, default: 3600 },     // Delay in seconds before escalation
    escalation_levels: [String],                           // Escalation hierarchy
    max_escalations: { type: Number, default: 3 }
  },
  
  // Policy behavior controls
  priority: { type: Number, default: 100 },                // Policy priority (lower number = higher priority)
  enabled: { type: Boolean, default: true },               // Whether policy is active
  auto_approve: { type: Boolean, default: false },         // Whether to auto-approve actions
  stop_on_match: { type: Boolean, default: true },         // Whether to stop processing other policies after match
  
  // Rate limiting and safety controls
  rate_limit: {                                             // Rate limiting configuration
    enabled: { type: Boolean, default: true },
    max_executions: { type: Number, default: 5 },          // Maximum executions per time window
    time_window: { type: Number, default: 3600 },          // Time window in seconds
    current_count: { type: Number, default: 0 },           // Current execution count in window
    window_start: Date                                      // Start of current time window
  },
  cooldown_period: { type: Number, default: 300 },         // Cooldown period in seconds between executions
  
  // Policy effectiveness tracking
  statistics: {                                             // Policy execution statistics
    total_matches: { type: Number, default: 0 },           // Total number of matches
    successful_executions: { type: Number, default: 0 },   // Successful action executions
    failed_executions: { type: Number, default: 0 },       // Failed action executions
    average_resolution_time: { type: Number, default: 0 }, // Average time to resolution
    last_execution: Date,                                   // Last time policy was executed
    effectiveness_score: { type: Number, default: 0 }      // Calculated effectiveness score (0-1)
  },
  
  // Policy validation and testing
  test_mode: { type: Boolean, default: false },            // Whether policy is in test mode
  dry_run: { type: Boolean, default: false },              // Whether to simulate actions without executing
  validation_rules: [String],                              // Validation rules to check before execution
  
  // Audit and compliance
  created_by: String,                                       // User who created the policy
  approved_by: String,                                      // User who approved the policy
  approval_date: Date,                                      // Date when policy was approved
  last_modified_by: String,                                // User who last modified the policy
  compliance_notes: String,                                // Compliance and regulatory notes
  
  // Policy lifecycle
  status: { type: String, enum: ['draft', 'pending_approval', 'active', 'inactive', 'deprecated'], default: 'draft' },
  effective_date: Date,                                     // When policy becomes effective
  expiry_date: Date,                                        // When policy expires
  review_date: Date,                                        // Next scheduled review date
  
  // Change tracking
  change_log: [{                                            // History of policy changes
    timestamp: { type: Date, default: Date.now },
    changed_by: String,
    change_type: String,
    change_description: String,
    previous_version: String
  }],
  
  // Metadata and tagging
  tags: [String],                                           // Custom tags for categorization
  custom_fields: { type: Object, default: {} },            // Extensible custom data
  documentation_url: String,                               // Link to policy documentation
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },            // Policy creation timestamp
  updatedAt: { type: Date, default: Date.now }             // Last update timestamp
});

// Indexes for efficient querying
PolicySchema.index({ category: 1, enabled: 1 });          // Query by category and status
PolicySchema.index({ priority: 1 });                      // Sort by priority
PolicySchema.index({ 'trigger_conditions.field': 1 });    // Query by trigger conditions
PolicySchema.index({ target_devices: 1 });                // Query by target devices

// Generate policy ID automatically
PolicySchema.pre('save', function() {
  if (!this.policy_id) {
    // Generate unique policy ID (POL-YYYYMMDD-NNNN format)
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    this.policy_id = `POL-${dateStr}-${randomNum}`;
  }
  
  // Update the updatedAt timestamp
  this.updatedAt = new Date();
});

// Add change log entry on modifications
PolicySchema.pre('save', function() {
  if (this.isModified() && !this.isNew) {
    this.change_log.push({
      changed_by: this.last_modified_by || 'system',
      change_type: 'modification',
      change_description: 'Policy updated',
      previous_version: this.version
    });
  }
});

// Reset rate limiting window if expired
PolicySchema.methods.checkRateLimit = function() {
  const now = new Date();
  const windowExpired = !this.rate_limit.window_start || 
                       (now - this.rate_limit.window_start) > (this.rate_limit.time_window * 1000);
  
  if (windowExpired) {
    this.rate_limit.window_start = now;
    this.rate_limit.current_count = 0;
  }
  
  return this.rate_limit.current_count < this.rate_limit.max_executions;
};

// Increment rate limit counter
PolicySchema.methods.incrementRateLimit = function() {
  this.rate_limit.current_count += 1;
  this.statistics.last_execution = new Date();
  return this.save();
};

module.exports = mongoose.model('Policy', PolicySchema);
