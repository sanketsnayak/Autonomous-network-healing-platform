const mongoose = require('mongoose');

// Action step schema for complex multi-step remediation actions
const ActionStepSchema = new mongoose.Schema({
  step_number: Number,                                       // Order of execution
  description: String,                                       // Human-readable step description
  command: String,                                          // Actual command to execute
  expected_result: String,                                  // Expected outcome
  timeout: { type: Number, default: 30 },                  // Timeout in seconds
  critical: { type: Boolean, default: false },             // Whether failure should abort entire action
  retry_count: { type: Number, default: 0 },               // Number of retry attempts
  max_retries: { type: Number, default: 3 },               // Maximum retry attempts
  status: { type: String, enum: ['pending', 'executing', 'completed', 'failed', 'skipped'], default: 'pending' },
  executed_at: Date,                                        // When step was executed
  completed_at: Date,                                       // When step completed
  result: Object,                                           // Step execution result
  error_message: String                                     // Error message if step failed
}, { _id: false });

// Rollback plan schema for safely undoing changes
const RollbackPlanSchema = new mongoose.Schema({
  description: String,                                      // Description of rollback action
  commands: [String],                                       // Commands to execute for rollback
  config_backup: String,                                    // Configuration backup to restore
  verification_steps: [String],                            // Steps to verify rollback success
  automatic: { type: Boolean, default: true },             // Whether rollback should be automatic
  executed: { type: Boolean, default: false },             // Whether rollback was executed
  executed_at: Date,                                        // When rollback was executed
  success: { type: Boolean, default: false }               // Whether rollback succeeded
}, { _id: false });

// Enhanced action schema for autonomous remediation
const ActionSchema = new mongoose.Schema({
  // Action identification
  action_id: { type: String, unique: true, required: true }, // Unique action identifier
  name: String,                                             // Human-readable action name
  description: String,                                      // Detailed action description
  
  // Target device and scope
  target_device: { type: String, required: true },         // Target device hostname
  device_ip: String,                                        // Target device IP address
  target_interface: String,                                 // Specific interface if applicable
  target_service: String,                                   // Specific service if applicable
  
  // Action classification
  category: { type: String, enum: ['configuration', 'restart', 'diagnostic', 'cleanup', 'security'], default: 'configuration' },
  type: { type: String, required: true },                  // Specific action type (enable_interface, restart_bgp, etc.)
  method: { type: String, enum: ['netconf', 'cli', 'rest_api', 'snmp'], default: 'cli' }, // Execution method
  
  // Action parameters and configuration
  parameters: { type: Object, default: {} },               // Action-specific parameters
  action_steps: [ActionStepSchema],                        // Detailed execution steps
  estimated_duration: { type: Number, default: 30 },      // Estimated execution time in seconds
  
  // Safety and approval controls
  risk_level: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }, // Risk assessment
  requires_approval: { type: Boolean, default: true },     // Whether human approval is required
  approved_by: String,                                     // User who approved the action
  approval_timestamp: Date,                                // When action was approved
  approval_expiry: Date,                                   // When approval expires
  
  // Pre-execution checks
  pre_checks: [String],                                    // List of pre-execution validation checks
  pre_check_results: { type: Object, default: {} },       // Results of pre-execution checks
  maintenance_window_required: { type: Boolean, default: false }, // Whether maintenance window is needed
  impact_assessment: String,                               // Assessment of potential impact
  
  // Execution tracking
  status: { type: String, enum: ['draft', 'pending_approval', 'approved', 'queued', 'executing', 'completed', 'failed', 'cancelled', 'rolled_back'], default: 'draft' },
  execution_mode: { type: String, enum: ['automatic', 'manual', 'scheduled'], default: 'automatic' }, // How action is triggered
  scheduled_execution: Date,                               // Scheduled execution time
  started_at: Date,                                        // When execution started
  completed_at: Date,                                      // When execution completed
  
  // Results and verification
  execution_log: [String],                                 // Detailed execution log
  result: { type: Object, default: {} },                  // Action execution results
  success: { type: Boolean, default: false },             // Whether action succeeded
  error_message: String,                                   // Error message if action failed
  
  // Post-execution verification
  verification_required: { type: Boolean, default: true }, // Whether post-execution verification is needed
  verification_steps: [String],                           // Steps to verify action success
  verification_results: { type: Object, default: {} },    // Results of verification checks
  verified: { type: Boolean, default: false },            // Whether action was verified successful
  verified_at: Date,                                       // When verification was completed
  
  // Rollback and recovery
  rollback_plan: RollbackPlanSchema,                      // Plan for rolling back changes
  rollback_required: { type: Boolean, default: false },   // Whether rollback is needed
  config_backup: String,                                   // Configuration backup before action
  
  // Incident and alert correlation
  incident_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident' }, // Associated incident
  triggering_alert: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert' }, // Alert that triggered action
  correlation_id: String,                                  // ID for correlating related actions
  
  // Retry and failure handling
  retry_count: { type: Number, default: 0 },              // Number of retry attempts
  max_retries: { type: Number, default: 3 },              // Maximum retry attempts
  retry_delay: { type: Number, default: 60 },             // Delay between retries in seconds
  
  // Audit and compliance
  executed_by: { type: String, default: 'system' },       // User or system that executed action
  execution_context: String,                              // Context of execution (incident, scheduled, manual)
  compliance_checks: [String],                            // Compliance validations performed
  audit_trail: [{                                         // Audit trail of action lifecycle
    timestamp: { type: Date, default: Date.now },
    action: String,
    user: String,
    details: String
  }],
  
  // Metadata and tagging
  tags: [String],                                         // Custom tags for categorization
  custom_fields: { type: Object, default: {} },          // Extensible custom data
  notes: String,                                          // Additional notes about the action
  
  // Timing and performance metrics
  createdAt: { type: Date, default: Date.now },          // Action creation timestamp
  updatedAt: { type: Date, default: Date.now }           // Last update timestamp
});

// Indexes for efficient querying
ActionSchema.index({ target_device: 1, status: 1 });     // Query actions by device and status
ActionSchema.index({ incident_id: 1 });                  // Query actions by incident
ActionSchema.index({ createdAt: -1 });                   // Sort by creation time
ActionSchema.index({ scheduled_execution: 1 });          // Query scheduled actions

// Generate action ID automatically
ActionSchema.pre('save', function() {
  if (!this.action_id) {
    // Generate unique action ID (ACT-YYYYMMDD-NNNN format)
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    this.action_id = `ACT-${dateStr}-${randomNum}`;
  }
  
  // Update the updatedAt timestamp
  this.updatedAt = new Date();
});

// Add audit trail entry on status changes
ActionSchema.pre('save', function() {
  if (this.isModified('status')) {
    this.audit_trail.push({
      action: `Status changed to ${this.status}`,
      user: this.executed_by || 'system',
      details: `Action status updated from previous state to ${this.status}`
    });
  }
});

module.exports = mongoose.model('Action', ActionSchema);
