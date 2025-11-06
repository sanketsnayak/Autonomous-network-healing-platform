const EventEmitter = require('events');
const Action = require('../models/Action');
const Incident = require('../models/Incident');
const Device = require('../models/Device');
const Policy = require('../models/Policy');

/**
 * Remediation Engine
 * Automatically executes remediation actions based on incidents and policies
 * Provides safe, auditable, and rollback-capable network healing
 */
class RemediationEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Service configuration
    this.config = {
      execution_timeout: options.execution_timeout || 300000, // 5 minutes max execution time
      max_concurrent_actions: options.max_concurrent_actions || 5, // Maximum parallel actions
      auto_approval_enabled: options.auto_approval_enabled || false, // Auto-approve low-risk actions
      dry_run_mode: options.dry_run_mode || false, // Simulate actions without executing
      rollback_enabled: options.rollback_enabled || true, // Enable automatic rollback
      verification_timeout: options.verification_timeout || 60000, // 1 minute verification timeout
      cooldown_period: options.cooldown_period || 300000, // 5 minutes between actions on same device
      max_retries: options.max_retries || 3, // Maximum retry attempts
      safety_checks_enabled: true // Enable comprehensive safety checks
    };
    
    // Remediation action templates
    this.actionTemplates = new Map();
    this.remediationPolicies = new Map();
    
    // Execution state
    this.running = false;
    this.executionQueue = [];
    this.activeExecutions = new Map();
    this.deviceCooldowns = new Map(); // Track per-device cooldown periods
    
    // Statistics
    this.stats = {
      total_actions: 0,
      successful_actions: 0,
      failed_actions: 0,
      rolled_back_actions: 0,
      auto_approved_actions: 0,
      manual_approval_required: 0,
      safety_check_failures: 0,
      average_execution_time: 0,
      last_reset: Date.now()
    };
    
    this.init();
  }
  
  /**
   * Initialize the remediation engine
   */
  init() {
    console.log('Initializing Remediation Engine...');
    
    // Load action templates
    this.loadActionTemplates();
    
    // Load remediation policies
    this.loadRemediationPolicies();
    
    // Setup execution pipeline
    this.setupExecutionPipeline();
    
    // Setup periodic tasks
    this.setupPeriodicTasks();
    
    console.log('Remediation Engine initialized successfully');
  }
  
  /**
   * Load predefined action templates
   */
  loadActionTemplates() {
    // Template 1: Enable interface
    this.actionTemplates.set('enable_interface', {
      name: 'Enable Network Interface',
      description: 'Bring up a network interface that is administratively down',
      category: 'configuration',
      risk_level: 'low',
      requires_approval: false,
      estimated_duration: 30,
      methods: ['netconf', 'cli'],
      pre_checks: ['verify_interface_exists', 'check_interface_status'],
      verification_steps: ['check_interface_operational', 'verify_connectivity'],
      rollback_plan: {
        description: 'Disable interface if issues occur',
        commands: ['shutdown interface'],
        automatic: true
      }
    });
    
    // Template 2: Restart BGP session
    this.actionTemplates.set('restart_bgp_session', {
      name: 'Restart BGP Session',
      description: 'Clear and restart a BGP session to resolve peering issues',
      category: 'restart',
      risk_level: 'medium',
      requires_approval: true,
      estimated_duration: 120,
      methods: ['netconf', 'cli'],
      pre_checks: ['verify_bgp_neighbor', 'check_routing_table'],
      verification_steps: ['check_bgp_session_state', 'verify_route_count'],
      rollback_plan: {
        description: 'Restore previous BGP configuration if needed',
        automatic: false
      }
    });
    
    // Template 3: Clear interface counters
    this.actionTemplates.set('clear_interface_counters', {
      name: 'Clear Interface Counters',
      description: 'Reset interface error counters and statistics',
      category: 'diagnostic',
      risk_level: 'low',
      requires_approval: false,
      estimated_duration: 15,
      methods: ['cli'],
      pre_checks: ['verify_interface_exists'],
      verification_steps: ['check_counters_reset'],
      rollback_plan: {
        description: 'No rollback needed for counter clearing',
        automatic: false
      }
    });
    
    // Template 4: Restart network service
    this.actionTemplates.set('restart_service', {
      name: 'Restart Network Service',
      description: 'Restart a specific network service or daemon',
      category: 'restart',
      risk_level: 'medium',
      requires_approval: true,
      estimated_duration: 60,
      methods: ['cli'],
      pre_checks: ['verify_service_exists', 'check_service_dependencies'],
      verification_steps: ['check_service_status', 'verify_service_functionality'],
      rollback_plan: {
        description: 'Revert to previous service configuration',
        automatic: true
      }
    });
    
    // Template 5: Update interface configuration
    this.actionTemplates.set('update_interface_config', {
      name: 'Update Interface Configuration',
      description: 'Apply configuration changes to resolve interface issues',
      category: 'configuration',
      risk_level: 'high',
      requires_approval: true,
      estimated_duration: 90,
      methods: ['netconf'],
      pre_checks: ['verify_interface_exists', 'validate_configuration'],
      verification_steps: ['check_interface_config', 'verify_connectivity'],
      rollback_plan: {
        description: 'Restore previous interface configuration',
        automatic: true
      }
    });
    
    // Template 6: Reload device configuration
    this.actionTemplates.set('reload_device_config', {
      name: 'Reload Device Configuration',
      description: 'Reload the device with a known good configuration',
      category: 'configuration',
      risk_level: 'critical',
      requires_approval: true,
      estimated_duration: 300,
      methods: ['cli'],
      pre_checks: ['verify_backup_config', 'check_device_accessibility'],
      verification_steps: ['check_device_online', 'verify_all_services'],
      rollback_plan: {
        description: 'Reload with emergency configuration',
        automatic: false
      }
    });
    
    console.log(`Loaded ${this.actionTemplates.size} action templates`);
  }
  
  /**
   * Load remediation policies from database
   */
  async loadRemediationPolicies() {
    try {
      // Load active policies from database
      const policies = await Policy.find({ 
        category: 'remediation', 
        enabled: true, 
        status: 'active' 
      }).sort({ priority: 1 });
      
      policies.forEach(policy => {
        this.remediationPolicies.set(policy.policy_id, policy);
      });
      
      console.log(`Loaded ${this.remediationPolicies.size} remediation policies`);
      
    } catch (error) {
      console.error('Error loading remediation policies:', error);
    }
  }
  
  /**
   * Setup execution pipeline
   */
  setupExecutionPipeline() {
    // Process execution queue every 10 seconds
    setInterval(() => {
      this.processExecutionQueue();
    }, 10000);
    
    // Check for timed-out executions every 30 seconds
    setInterval(() => {
      this.checkExecutionTimeouts();
    }, 30000);
    
    // Clean up completed executions every 5 minutes
    setInterval(() => {
      this.cleanupCompletedExecutions();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Generate remediation action for an incident
   */
  async generateRemediationAction(incident) {
    try {
      console.log(`Generating remediation action for incident: ${incident.incident_id}`);
      
      // Find matching remediation policies
      const matchingPolicies = await this.findMatchingPolicies(incident);
      
      if (matchingPolicies.length === 0) {
        console.log('No matching remediation policies found for incident');
        return null;
      }
      
      // Select the highest priority policy
      const selectedPolicy = matchingPolicies[0];
      
      // Generate action based on policy
      const action = await this.createActionFromPolicy(incident, selectedPolicy);
      
      if (action) {
        // Add to execution queue
        await this.queueAction(action);
        
        console.log(`Remediation action generated: ${action.action_id}`);
        this.emit('action_generated', { incident: incident, action: action });
        
        return action;
      }
      
      return null;
      
    } catch (error) {
      console.error('Error generating remediation action:', error);
      return null;
    }
  }
  
  /**
   * Find policies that match the incident characteristics
   */
  async findMatchingPolicies(incident) {
    const matchingPolicies = [];
    
    try {
      for (const [policyId, policy] of this.remediationPolicies) {
        // Check if policy conditions match the incident
        const matches = await this.evaluatePolicyConditions(incident, policy);
        
        if (matches) {
          matchingPolicies.push(policy);
        }
      }
      
      // Sort by priority (lower number = higher priority)
      matchingPolicies.sort((a, b) => a.priority - b.priority);
      
    } catch (error) {
      console.error('Error finding matching policies:', error);
    }
    
    return matchingPolicies;
  }
  
  /**
   * Evaluate if a policy's conditions match the incident
   */
  async evaluatePolicyConditions(incident, policy) {
    try {
      // Check trigger conditions
      for (const condition of policy.trigger_conditions) {
        if (!this.evaluateCondition(incident, condition)) {
          return false;
        }
      }
      
      // Check exclude conditions
      for (const condition of policy.exclude_conditions) {
        if (this.evaluateCondition(incident, condition)) {
          return false; // Exclude condition matched, policy doesn't apply
        }
      }
      
      // Check time conditions
      if (!this.evaluateTimeConditions(policy.time_conditions)) {
        return false;
      }
      
      // Check rate limiting
      if (!policy.checkRateLimit()) {
        return false;
      }
      
      return true;
      
    } catch (error) {
      console.error('Error evaluating policy conditions:', error);
      return false;
    }
  }
  
  /**
   * Evaluate a single policy condition
   */
  evaluateCondition(incident, condition) {
    try {
      const fieldValue = this.getFieldValue(incident, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'contains':
          return String(fieldValue).includes(condition.value);
        case 'greater_than':
          return Number(fieldValue) > Number(condition.value);
        case 'less_than':
          return Number(fieldValue) < Number(condition.value);
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        case 'not_in':
          return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        default:
          return false;
      }
      
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  }
  
  /**
   * Get field value from incident object using dot notation
   */
  getFieldValue(incident, fieldPath) {
    const parts = fieldPath.split('.');
    let value = incident;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
  
  /**
   * Evaluate time-based conditions
   */
  evaluateTimeConditions(timeConditions) {
    if (!timeConditions) {
      return true;
    }
    
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentHour = now.getHours();
    
    // Check business hours
    if (timeConditions.business_hours_only) {
      const isWeekday = !['Saturday', 'Sunday'].includes(currentDay);
      const isBusinessHour = currentHour >= 9 && currentHour <= 17;
      
      if (!isWeekday || !isBusinessHour) {
        return false;
      }
    }
    
    // Check allowed days
    if (timeConditions.allowed_days && timeConditions.allowed_days.length > 0) {
      if (!timeConditions.allowed_days.includes(currentDay)) {
        return false;
      }
    }
    
    // Check allowed hours
    if (timeConditions.allowed_hours) {
      const startHour = parseInt(timeConditions.allowed_hours.start);
      const endHour = parseInt(timeConditions.allowed_hours.end);
      
      if (currentHour < startHour || currentHour > endHour) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Create action from policy and incident
   */
  async createActionFromPolicy(incident, policy) {
    try {
      // Get the primary action from policy
      const policyAction = policy.actions[0]; // Use first action for now
      
      if (!policyAction) {
        console.log('No actions defined in policy');
        return null;
      }
      
      // Get action template
      const template = this.actionTemplates.get(policyAction.action_type);
      
      if (!template) {
        console.error(`Action template not found: ${policyAction.action_type}`);
        return null;
      }
      
      // Determine target device (use primary affected device)
      const targetDevice = incident.affected_devices[0];
      
      if (!targetDevice) {
        console.log('No target device found for action');
        return null;
      }
      
      // Get device information
      const device = await Device.findOne({ hostname: targetDevice });
      
      if (!device) {
        console.error(`Device not found: ${targetDevice}`);
        return null;
      }
      
      // Create action object
      const action = new Action({
        name: template.name,
        description: template.description,
        target_device: targetDevice,
        device_ip: device.mgmt_ip,
        category: template.category,
        type: policyAction.action_type,
        method: this.selectExecutionMethod(device, template.methods),
        parameters: { ...template.parameters, ...policyAction.parameters },
        estimated_duration: template.estimated_duration,
        risk_level: policyAction.risk_level || template.risk_level,
        requires_approval: policyAction.requires_approval !== undefined ? 
                          policyAction.requires_approval : template.requires_approval,
        incident_id: incident._id,
        triggering_alert: incident.primary_alert,
        pre_checks: template.pre_checks,
        verification_steps: template.verification_steps,
        rollback_plan: template.rollback_plan,
        execution_context: 'autonomous_healing'
      });
      
      // Generate action steps
      action.action_steps = await this.generateActionSteps(action, template);
      
      await action.save();
      
      return action;
      
    } catch (error) {
      console.error('Error creating action from policy:', error);
      return null;
    }
  }
  
  /**
   * Select best execution method for device
   */
  selectExecutionMethod(device, availableMethods) {
    // Prefer NETCONF if available and enabled
    if (device.netconf_enabled && availableMethods.includes('netconf')) {
      return 'netconf';
    }
    
    // Fall back to CLI if SSH is available
    if (device.ssh_enabled && availableMethods.includes('cli')) {
      return 'cli';
    }
    
    // Try REST API if available
    if (availableMethods.includes('rest_api')) {
      return 'rest_api';
    }
    
    // Default to CLI
    return 'cli';
  }
  
  /**
   * Generate detailed action steps
   */
  async generateActionSteps(action, template) {
    const steps = [];
    
    try {
      let stepNumber = 1;
      
      // Pre-execution steps
      if (template.pre_checks) {
        template.pre_checks.forEach(check => {
          steps.push({
            step_number: stepNumber++,
            description: `Pre-check: ${check}`,
            command: this.generatePreCheckCommand(check, action),
            expected_result: 'Success',
            timeout: 30,
            critical: true
          });
        });
      }
      
      // Main execution steps
      const mainSteps = this.generateMainExecutionSteps(action, template);
      mainSteps.forEach(step => {
        steps.push({
          step_number: stepNumber++,
          ...step
        });
      });
      
      // Post-execution verification steps
      if (template.verification_steps) {
        template.verification_steps.forEach(verification => {
          steps.push({
            step_number: stepNumber++,
            description: `Verification: ${verification}`,
            command: this.generateVerificationCommand(verification, action),
            expected_result: 'Success',
            timeout: 30,
            critical: false
          });
        });
      }
      
    } catch (error) {
      console.error('Error generating action steps:', error);
    }
    
    return steps;
  }
  
  /**
   * Generate pre-check commands
   */
  generatePreCheckCommand(check, action) {
    const commandMap = {
      'verify_interface_exists': `show interface ${action.parameters.interface_name || 'brief'}`,
      'check_interface_status': `show interface ${action.parameters.interface_name || 'brief'} status`,
      'verify_bgp_neighbor': `show bgp summary`,
      'check_routing_table': `show ip route summary`,
      'verify_service_exists': `show running-config | include ${action.parameters.service_name}`,
      'check_service_dependencies': `show processes cpu | include ${action.parameters.service_name}`,
      'verify_backup_config': `show archive config differences`,
      'check_device_accessibility': `show version`,
      'validate_configuration': `show running-config interface ${action.parameters.interface_name}`
    };
    
    return commandMap[check] || `# Pre-check: ${check}`;
  }
  
  /**
   * Generate main execution steps based on action type
   */
  generateMainExecutionSteps(action, template) {
    const steps = [];
    
    switch (action.type) {
      case 'enable_interface':
        steps.push({
          description: `Enable interface ${action.parameters.interface_name}`,
          command: `interface ${action.parameters.interface_name}\nno shutdown`,
          expected_result: 'Interface enabled',
          timeout: 60,
          critical: true
        });
        break;
        
      case 'restart_bgp_session':
        steps.push({
          description: `Clear BGP session ${action.parameters.neighbor_ip}`,
          command: `clear bgp ${action.parameters.neighbor_ip || 'all'}`,
          expected_result: 'BGP session cleared',
          timeout: 120,
          critical: true
        });
        break;
        
      case 'clear_interface_counters':
        steps.push({
          description: `Clear interface counters ${action.parameters.interface_name}`,
          command: `clear counters ${action.parameters.interface_name || 'all'}`,
          expected_result: 'Counters cleared',
          timeout: 30,
          critical: false
        });
        break;
        
      case 'restart_service':
        steps.push({
          description: `Restart service ${action.parameters.service_name}`,
          command: `restart ${action.parameters.service_name}`,
          expected_result: 'Service restarted',
          timeout: 120,
          critical: true
        });
        break;
        
      case 'update_interface_config':
        steps.push({
          description: `Update interface configuration`,
          command: this.generateInterfaceConfigCommands(action.parameters),
          expected_result: 'Configuration updated',
          timeout: 90,
          critical: true
        });
        break;
        
      case 'reload_device_config':
        steps.push({
          description: `Reload device with backup configuration`,
          command: `configure replace ${action.parameters.backup_config_path} force`,
          expected_result: 'Configuration reloaded',
          timeout: 300,
          critical: true
        });
        break;
        
      default:
        steps.push({
          description: `Execute ${action.type}`,
          command: `# Custom action: ${action.type}`,
          expected_result: 'Success',
          timeout: 60,
          critical: true
        });
    }
    
    return steps;
  }
  
  /**
   * Generate verification commands
   */
  generateVerificationCommand(verification, action) {
    const commandMap = {
      'check_interface_operational': `show interface ${action.parameters.interface_name || 'brief'} | include "line protocol"`,
      'verify_connectivity': `ping ${action.parameters.test_ip || '8.8.8.8'} count 5`,
      'check_bgp_session_state': `show bgp summary | include ${action.parameters.neighbor_ip || 'Established'}`,
      'verify_route_count': `show ip route summary`,
      'check_counters_reset': `show interface ${action.parameters.interface_name || 'brief'} | include "Last clearing"`,
      'check_service_status': `show processes | include ${action.parameters.service_name}`,
      'verify_service_functionality': `show ${action.parameters.service_name} status`,
      'check_interface_config': `show running-config interface ${action.parameters.interface_name}`,
      'check_device_online': `show version`,
      'verify_all_services': `show processes cpu sort`
    };
    
    return commandMap[verification] || `# Verification: ${verification}`;
  }
  
  /**
   * Generate interface configuration commands
   */
  generateInterfaceConfigCommands(parameters) {
    const commands = [`interface ${parameters.interface_name}`];
    
    if (parameters.description) {
      commands.push(`description ${parameters.description}`);
    }
    
    if (parameters.ip_address && parameters.subnet_mask) {
      commands.push(`ip address ${parameters.ip_address} ${parameters.subnet_mask}`);
    }
    
    if (parameters.enable_interface) {
      commands.push('no shutdown');
    }
    
    return commands.join('\n');
  }
  
  /**
   * Queue action for execution
   */
  async queueAction(action) {
    try {
      // Check device cooldown
      if (this.isDeviceInCooldown(action.target_device)) {
        console.log(`Device ${action.target_device} is in cooldown period, delaying action`);
        action.status = 'queued';
        action.scheduled_execution = new Date(Date.now() + this.getDeviceCooldownRemaining(action.target_device));
      } else if (action.requires_approval && !this.config.auto_approval_enabled) {
        // Action requires manual approval
        action.status = 'pending_approval';
        this.stats.manual_approval_required++;
        this.emit('approval_required', action);
      } else if (action.requires_approval && this.shouldAutoApprove(action)) {
        // Auto-approve low-risk actions
        action.status = 'approved';
        action.approved_by = 'system';
        action.approval_timestamp = new Date();
        this.stats.auto_approved_actions++;
      } else {
        action.status = 'approved';
        action.approved_by = 'system';
        action.approval_timestamp = new Date();
      }
      
      // Save action status
      await action.save();
      
      // Add to execution queue if approved
      if (action.status === 'approved') {
        this.executionQueue.push({
          action: action,
          queued_at: Date.now()
        });
      }
      
      console.log(`Action queued: ${action.action_id} (status: ${action.status})`);
      
    } catch (error) {
      console.error('Error queueing action:', error);
    }
  }
  
  /**
   * Check if device is in cooldown period
   */
  isDeviceInCooldown(deviceHostname) {
    const cooldown = this.deviceCooldowns.get(deviceHostname);
    
    if (!cooldown) {
      return false;
    }
    
    return Date.now() < cooldown.until;
  }
  
  /**
   * Get remaining cooldown time for device
   */
  getDeviceCooldownRemaining(deviceHostname) {
    const cooldown = this.deviceCooldowns.get(deviceHostname);
    
    if (!cooldown) {
      return 0;
    }
    
    return Math.max(0, cooldown.until - Date.now());
  }
  
  /**
   * Determine if action should be auto-approved
   */
  shouldAutoApprove(action) {
    // Auto-approve only low-risk actions
    if (action.risk_level !== 'low') {
      return false;
    }
    
    // Check if action type is in auto-approval list
    const autoApprovalActions = ['clear_interface_counters', 'enable_interface'];
    
    return autoApprovalActions.includes(action.type);
  }
  
  /**
   * Process the execution queue
   */
  async processExecutionQueue() {
    if (this.executionQueue.length === 0) {
      return;
    }
    
    // Limit concurrent executions
    if (this.activeExecutions.size >= this.config.max_concurrent_actions) {
      return;
    }
    
    // Get next action from queue
    const queueItem = this.executionQueue.shift();
    const action = queueItem.action;
    
    // Check if action is still valid and approved
    if (action.status !== 'approved') {
      return;
    }
    
    // Start execution
    await this.executeAction(action);
  }
  
  /**
   * Execute a remediation action
   */
  async executeAction(action) {
    const startTime = Date.now();
    
    try {
      console.log(`Executing action: ${action.action_id} on device: ${action.target_device}`);
      
      // Update statistics
      this.stats.total_actions++;
      
      // Update action status
      action.status = 'executing';
      action.started_at = new Date();
      await action.save();
      
      // Add to active executions
      this.activeExecutions.set(action.action_id, {
        action: action,
        start_time: startTime,
        timeout: setTimeout(() => {
          this.handleExecutionTimeout(action.action_id);
        }, this.config.execution_timeout)
      });
      
      // Perform safety checks
      const safetyCheckResult = await this.performSafetyChecks(action);
      
      if (!safetyCheckResult.passed) {
        throw new Error(`Safety check failed: ${safetyCheckResult.reason}`);
      }
      
      // Execute action steps
      const executionResult = await this.executeActionSteps(action);
      
      if (executionResult.success) {
        // Perform post-execution verification
        const verificationResult = await this.performVerification(action);
        
        if (verificationResult.success) {
          // Action completed successfully
          await this.handleSuccessfulExecution(action, executionResult);
        } else {
          // Verification failed, initiate rollback
          await this.handleFailedVerification(action, verificationResult);
        }
      } else {
        // Execution failed
        await this.handleFailedExecution(action, executionResult);
      }
      
    } catch (error) {
      console.error(`Error executing action ${action.action_id}:`, error);
      await this.handleExecutionError(action, error);
    } finally {
      // Clean up active execution
      const execution = this.activeExecutions.get(action.action_id);
      if (execution) {
        clearTimeout(execution.timeout);
        this.activeExecutions.delete(action.action_id);
      }
      
      // Set device cooldown
      this.setDeviceCooldown(action.target_device);
      
      // Update average execution time
      const executionTime = Date.now() - startTime;
      this.updateAverageExecutionTime(executionTime);
    }
  }
  
  /**
   * Perform safety checks before execution
   */
  async performSafetyChecks(action) {
    try {
      console.log(`Performing safety checks for action: ${action.action_id}`);
      
      // Check 1: Device accessibility
      const device = await Device.findOne({ hostname: action.target_device });
      
      if (!device) {
        return { passed: false, reason: 'Device not found in database' };
      }
      
      if (device.status !== 'UP') {
        return { passed: false, reason: 'Device is not reachable' };
      }
      
      // Check 2: Maintenance window
      if (device.maintenance_window && !this.isInMaintenanceWindow(device.maintenance_window)) {
        if (action.risk_level === 'high' || action.risk_level === 'critical') {
          return { passed: false, reason: 'High-risk action outside maintenance window' };
        }
      }
      
      // Check 3: Automation enabled
      if (!device.automation_enabled) {
        return { passed: false, reason: 'Automation disabled for this device' };
      }
      
      // Check 4: Method availability
      if (action.method === 'netconf' && !device.netconf_enabled) {
        return { passed: false, reason: 'NETCONF not available on device' };
      }
      
      if (action.method === 'cli' && !device.ssh_enabled) {
        return { passed: false, reason: 'SSH not available on device' };
      }
      
      // Check 5: Concurrent actions on same device
      const deviceActions = Array.from(this.activeExecutions.values())
        .filter(exec => exec.action.target_device === action.target_device);
      
      if (deviceActions.length > 0) {
        return { passed: false, reason: 'Another action is already running on this device' };
      }
      
      // Check 6: Dry run mode
      if (this.config.dry_run_mode) {
        console.log(`DRY RUN: Would execute action ${action.action_id}`);
        return { passed: false, reason: 'Running in dry-run mode' };
      }
      
      return { passed: true, reason: 'All safety checks passed' };
      
    } catch (error) {
      console.error('Error performing safety checks:', error);
      this.stats.safety_check_failures++;
      return { passed: false, reason: `Safety check error: ${error.message}` };
    }
  }
  
  /**
   * Check if current time is within maintenance window
   */
  isInMaintenanceWindow(maintenanceWindow) {
    if (!maintenanceWindow || !maintenanceWindow.start_time || !maintenanceWindow.end_time) {
      return false;
    }
    
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM format
    
    // Check if today is in allowed days
    if (maintenanceWindow.days && !maintenanceWindow.days.includes(currentDay)) {
      return false;
    }
    
    // Parse time strings (assuming HHMM format)
    const startTime = parseInt(maintenanceWindow.start_time.replace(':', ''));
    const endTime = parseInt(maintenanceWindow.end_time.replace(':', ''));
    
    // Check if current time is within window
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Window crosses midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }
  
  /**
   * Execute action steps sequentially
   */
  async executeActionSteps(action) {
    const results = {
      success: true,
      completed_steps: 0,
      failed_step: null,
      execution_log: [],
      step_results: []
    };
    
    try {
      console.log(`Executing ${action.action_steps.length} steps for action: ${action.action_id}`);
      
      for (const step of action.action_steps) {
        try {
          console.log(`Executing step ${step.step_number}: ${step.description}`);
          
          // Update step status
          step.status = 'executing';
          step.executed_at = new Date();
          
          // Execute the step based on method
          const stepResult = await this.executeStep(action, step);
          
          if (stepResult.success) {
            step.status = 'completed';
            step.completed_at = new Date();
            step.result = stepResult.result;
            results.completed_steps++;
            
            results.execution_log.push(`Step ${step.step_number} completed: ${step.description}`);
          } else {
            step.status = 'failed';
            step.error_message = stepResult.error;
            step.result = stepResult.result;
            
            results.execution_log.push(`Step ${step.step_number} failed: ${stepResult.error}`);
            
            if (step.critical) {
              results.success = false;
              results.failed_step = step.step_number;
              break;
            } else {
              // Non-critical step failed, continue
              results.execution_log.push(`Non-critical step failed, continuing execution`);
            }
          }
          
          results.step_results.push({
            step_number: step.step_number,
            success: stepResult.success,
            result: stepResult.result,
            error: stepResult.error
          });
          
        } catch (error) {
          step.status = 'failed';
          step.error_message = error.message;
          
          results.execution_log.push(`Step ${step.step_number} error: ${error.message}`);
          
          if (step.critical) {
            results.success = false;
            results.failed_step = step.step_number;
            break;
          }
        }
      }
      
      // Update action with execution results
      action.execution_log = results.execution_log;
      await action.save();
      
    } catch (error) {
      console.error('Error executing action steps:', error);
      results.success = false;
      results.execution_log.push(`Execution error: ${error.message}`);
    }
    
    return results;
  }
  
  /**
   * Execute a single action step
   */
  async executeStep(action, step) {
    try {
      // Simulate step execution based on method
      switch (action.method) {
        case 'netconf':
          return await this.executeNETCONFStep(action, step);
        case 'cli':
          return await this.executeCLIStep(action, step);
        case 'rest_api':
          return await this.executeRESTStep(action, step);
        default:
          throw new Error(`Unsupported execution method: ${action.method}`);
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        result: null
      };
    }
  }
  
  /**
   * Execute NETCONF step (simulated)
   */
  async executeNETCONFStep(action, step) {
    try {
      console.log(`NETCONF execution: ${step.command}`);
      
      // In a real implementation, this would use ncclient or similar
      // For now, simulate the execution
      await this.simulateDelay(step.timeout * 100); // Simulate network delay
      
      // Simulate success/failure based on step criticality
      const simulatedSuccess = Math.random() > 0.1; // 90% success rate
      
      if (simulatedSuccess) {
        return {
          success: true,
          result: `NETCONF command executed successfully: ${step.command}`,
          method: 'netconf'
        };
      } else {
        throw new Error('NETCONF command failed');
      }
      
    } catch (error) {
      return {
        success: false,
        error: `NETCONF error: ${error.message}`,
        result: null
      };
    }
  }
  
  /**
   * Execute CLI step (simulated)
   */
  async executeCLIStep(action, step) {
    try {
      console.log(`CLI execution: ${step.command}`);
      
      // In a real implementation, this would use SSH/Paramiko
      // For now, simulate the execution
      await this.simulateDelay(step.timeout * 50); // Simulate command execution
      
      // Simulate success/failure
      const simulatedSuccess = Math.random() > 0.05; // 95% success rate
      
      if (simulatedSuccess) {
        return {
          success: true,
          result: `CLI command executed successfully: ${step.command}`,
          method: 'cli'
        };
      } else {
        throw new Error('CLI command failed');
      }
      
    } catch (error) {
      return {
        success: false,
        error: `CLI error: ${error.message}`,
        result: null
      };
    }
  }
  
  /**
   * Execute REST API step (simulated)
   */
  async executeRESTStep(action, step) {
    try {
      console.log(`REST API execution: ${step.command}`);
      
      // In a real implementation, this would make HTTP requests
      // For now, simulate the execution
      await this.simulateDelay(step.timeout * 20); // Simulate API call
      
      // Simulate success/failure
      const simulatedSuccess = Math.random() > 0.08; // 92% success rate
      
      if (simulatedSuccess) {
        return {
          success: true,
          result: `REST API call executed successfully: ${step.command}`,
          method: 'rest_api'
        };
      } else {
        throw new Error('REST API call failed');
      }
      
    } catch (error) {
      return {
        success: false,
        error: `REST API error: ${error.message}`,
        result: null
      };
    }
  }
  
  /**
   * Simulate execution delay
   */
  async simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Perform post-execution verification
   */
  async performVerification(action) {
    try {
      console.log(`Performing verification for action: ${action.action_id}`);
      
      const verificationResults = {
        success: true,
        checks_passed: 0,
        checks_failed: 0,
        verification_log: [],
        details: {}
      };
      
      // Execute verification steps
      for (const verification of action.verification_steps) {
        try {
          const verifyResult = await this.executeVerificationCheck(action, verification);
          
          if (verifyResult.success) {
            verificationResults.checks_passed++;
            verificationResults.verification_log.push(`✓ ${verification}: ${verifyResult.result}`);
          } else {
            verificationResults.checks_failed++;
            verificationResults.verification_log.push(`✗ ${verification}: ${verifyResult.error}`);
            verificationResults.success = false;
          }
          
          verificationResults.details[verification] = verifyResult;
          
        } catch (error) {
          verificationResults.checks_failed++;
          verificationResults.verification_log.push(`✗ ${verification}: ${error.message}`);
          verificationResults.success = false;
        }
      }
      
      // Update action with verification results
      action.verification_results = verificationResults.details;
      action.verified = verificationResults.success;
      action.verified_at = new Date();
      await action.save();
      
      return verificationResults;
      
    } catch (error) {
      console.error('Error performing verification:', error);
      return {
        success: false,
        error: error.message,
        verification_log: [`Verification error: ${error.message}`]
      };
    }
  }
  
  /**
   * Execute a verification check
   */
  async executeVerificationCheck(action, verification) {
    try {
      // Generate verification command
      const command = this.generateVerificationCommand(verification, action);
      
      // Execute verification based on method
      switch (action.method) {
        case 'netconf':
        case 'cli':
        case 'rest_api':
          // Simulate verification execution
          await this.simulateDelay(1000); // 1 second delay
          
          // Simulate verification success/failure
          const success = Math.random() > 0.1; // 90% success rate
          
          if (success) {
            return {
              success: true,
              result: `Verification passed: ${verification}`,
              command: command
            };
          } else {
            throw new Error(`Verification failed: ${verification}`);
          }
          
        default:
          throw new Error(`Unsupported verification method: ${action.method}`);
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        command: null
      };
    }
  }
  
  /**
   * Handle successful action execution
   */
  async handleSuccessfulExecution(action, executionResult) {
    try {
      console.log(`Action executed successfully: ${action.action_id}`);
      
      // Update action status
      action.status = 'completed';
      action.completed_at = new Date();
      action.success = true;
      action.result = executionResult;
      
      await action.save();
      
      // Update statistics
      this.stats.successful_actions++;
      
      // Emit success event
      this.emit('action_completed', { action: action, success: true });
      
      console.log(`Action ${action.action_id} completed successfully`);
      
    } catch (error) {
      console.error('Error handling successful execution:', error);
    }
  }
  
  /**
   * Handle failed verification
   */
  async handleFailedVerification(action, verificationResult) {
    try {
      console.log(`Verification failed for action: ${action.action_id}`);
      
      // Check if rollback is enabled and automatic
      if (this.config.rollback_enabled && action.rollback_plan.automatic) {
        console.log(`Initiating automatic rollback for action: ${action.action_id}`);
        await this.performRollback(action);
      } else {
        // Mark action as failed
        action.status = 'failed';
        action.completed_at = new Date();
        action.success = false;
        action.error_message = 'Post-execution verification failed';
        
        await action.save();
        
        // Update statistics
        this.stats.failed_actions++;
      }
      
      // Emit failure event
      this.emit('action_completed', { 
        action: action, 
        success: false, 
        reason: 'verification_failed',
        details: verificationResult 
      });
      
    } catch (error) {
      console.error('Error handling failed verification:', error);
    }
  }
  
  /**
   * Handle failed execution
   */
  async handleFailedExecution(action, executionResult) {
    try {
      console.log(`Action execution failed: ${action.action_id}`);
      
      // Check if retry is possible
      if (action.retry_count < action.max_retries) {
        console.log(`Retrying action: ${action.action_id} (attempt ${action.retry_count + 1})`);
        
        action.retry_count++;
        action.status = 'queued';
        
        // Schedule retry with delay
        setTimeout(() => {
          this.queueAction(action);
        }, action.retry_delay * 1000);
        
      } else {
        // No more retries, mark as failed
        action.status = 'failed';
        action.completed_at = new Date();
        action.success = false;
        action.error_message = executionResult.error || 'Execution failed';
        
        // Update statistics
        this.stats.failed_actions++;
      }
      
      await action.save();
      
      // Emit failure event
      this.emit('action_completed', { 
        action: action, 
        success: false, 
        reason: 'execution_failed',
        details: executionResult 
      });
      
    } catch (error) {
      console.error('Error handling failed execution:', error);
    }
  }
  
  /**
   * Handle execution error
   */
  async handleExecutionError(action, error) {
    try {
      console.error(`Action execution error: ${action.action_id} - ${error.message}`);
      
      action.status = 'failed';
      action.completed_at = new Date();
      action.success = false;
      action.error_message = error.message;
      
      await action.save();
      
      // Update statistics
      this.stats.failed_actions++;
      
      // Emit error event
      this.emit('action_error', { action: action, error: error });
      
    } catch (saveError) {
      console.error('Error saving failed action:', saveError);
    }
  }
  
  /**
   * Perform rollback operation
   */
  async performRollback(action) {
    try {
      console.log(`Performing rollback for action: ${action.action_id}`);
      
      // Update action status
      action.rollback_required = true;
      action.status = 'rolling_back';
      
      // Execute rollback commands
      if (action.rollback_plan.commands && action.rollback_plan.commands.length > 0) {
        for (const command of action.rollback_plan.commands) {
          try {
            // Execute rollback command (simulated)
            console.log(`Rollback command: ${command}`);
            await this.simulateDelay(1000);
            
          } catch (rollbackError) {
            console.error(`Rollback command failed: ${rollbackError.message}`);
          }
        }
      }
      
      // Restore configuration backup if available
      if (action.rollback_plan.config_backup) {
        console.log(`Restoring configuration backup: ${action.rollback_plan.config_backup}`);
        // In real implementation, restore the backup configuration
        await this.simulateDelay(2000);
      }
      
      // Update action status
      action.status = 'rolled_back';
      action.rollback_plan.executed = true;
      action.rollback_plan.executed_at = new Date();
      action.rollback_plan.success = true;
      
      await action.save();
      
      // Update statistics
      this.stats.rolled_back_actions++;
      
      console.log(`Rollback completed for action: ${action.action_id}`);
      this.emit('action_rolled_back', action);
      
    } catch (error) {
      console.error('Error performing rollback:', error);
      
      action.rollback_plan.executed = true;
      action.rollback_plan.success = false;
      action.status = 'rollback_failed';
      
      await action.save();
    }
  }
  
  /**
   * Handle execution timeout
   */
  async handleExecutionTimeout(actionId) {
    try {
      const execution = this.activeExecutions.get(actionId);
      
      if (execution) {
        const action = execution.action;
        
        console.log(`Action execution timed out: ${actionId}`);
        
        action.status = 'failed';
        action.completed_at = new Date();
        action.success = false;
        action.error_message = 'Execution timed out';
        
        await action.save();
        
        // Clean up
        this.activeExecutions.delete(actionId);
        
        // Update statistics
        this.stats.failed_actions++;
        
        // Emit timeout event
        this.emit('action_timeout', action);
      }
      
    } catch (error) {
      console.error('Error handling execution timeout:', error);
    }
  }
  
  /**
   * Check for timed-out executions
   */
  checkExecutionTimeouts() {
    const now = Date.now();
    
    for (const [actionId, execution] of this.activeExecutions) {
      const elapsedTime = now - execution.start_time;
      
      if (elapsedTime > this.config.execution_timeout) {
        this.handleExecutionTimeout(actionId);
      }
    }
  }
  
  /**
   * Set device cooldown period
   */
  setDeviceCooldown(deviceHostname) {
    this.deviceCooldowns.set(deviceHostname, {
      until: Date.now() + this.config.cooldown_period,
      set_at: Date.now()
    });
  }
  
  /**
   * Clean up completed executions
   */
  cleanupCompletedExecutions() {
    const cutoffTime = Date.now() - 3600000; // 1 hour ago
    
    for (const [actionId, execution] of this.activeExecutions) {
      if (execution.start_time < cutoffTime) {
        clearTimeout(execution.timeout);
        this.activeExecutions.delete(actionId);
      }
    }
    
    // Clean up device cooldowns
    for (const [device, cooldown] of this.deviceCooldowns) {
      if (Date.now() > cooldown.until) {
        this.deviceCooldowns.delete(device);
      }
    }
  }
  
  /**
   * Update average execution time statistic
   */
  updateAverageExecutionTime(executionTime) {
    const alpha = 0.1;
    this.stats.average_execution_time = 
      (this.stats.average_execution_time * (1 - alpha)) + (executionTime * alpha);
  }
  
  /**
   * Setup periodic maintenance tasks
   */
  setupPeriodicTasks() {
    // Log statistics every 15 minutes
    setInterval(() => {
      this.logStatistics();
    }, 15 * 60 * 1000);
    
    // Reset statistics every hour
    setInterval(() => {
      this.resetStatistics();
    }, 60 * 60 * 1000);
    
    // Reload policies every 30 minutes
    setInterval(() => {
      this.loadRemediationPolicies();
    }, 30 * 60 * 1000);
  }
  
  /**
   * Log remediation statistics
   */
  logStatistics() {
    console.log('Remediation Engine Statistics:', {
      total_actions: this.stats.total_actions,
      successful_actions: this.stats.successful_actions,
      failed_actions: this.stats.failed_actions,
      success_rate: this.stats.total_actions > 0 ? 
        (this.stats.successful_actions / this.stats.total_actions * 100).toFixed(2) + '%' : '0%',
      rolled_back_actions: this.stats.rolled_back_actions,
      auto_approved_actions: this.stats.auto_approved_actions,
      manual_approval_required: this.stats.manual_approval_required,
      safety_check_failures: this.stats.safety_check_failures,
      average_execution_time: Math.round(this.stats.average_execution_time),
      active_executions: this.activeExecutions.size,
      queue_size: this.executionQueue.length,
      devices_in_cooldown: this.deviceCooldowns.size
    });
  }
  
  /**
   * Reset statistics counters
   */
  resetStatistics() {
    this.stats = {
      total_actions: 0,
      successful_actions: 0,
      failed_actions: 0,
      rolled_back_actions: 0,
      auto_approved_actions: 0,
      manual_approval_required: 0,
      safety_check_failures: 0,
      average_execution_time: 0,
      last_reset: Date.now()
    };
  }
  
  /**
   * Approve a pending action
   */
  async approveAction(actionId, approvedBy) {
    try {
      const action = await Action.findOne({ action_id: actionId });
      
      if (!action) {
        throw new Error('Action not found');
      }
      
      if (action.status !== 'pending_approval') {
        throw new Error('Action is not pending approval');
      }
      
      action.status = 'approved';
      action.approved_by = approvedBy;
      action.approval_timestamp = new Date();
      
      await action.save();
      
      // Add to execution queue
      this.executionQueue.push({
        action: action,
        queued_at: Date.now()
      });
      
      console.log(`Action approved: ${actionId} by ${approvedBy}`);
      this.emit('action_approved', { action: action, approved_by: approvedBy });
      
      return action;
      
    } catch (error) {
      console.error('Error approving action:', error);
      throw error;
    }
  }
  
  /**
   * Reject a pending action
   */
  async rejectAction(actionId, rejectedBy, reason) {
    try {
      const action = await Action.findOne({ action_id: actionId });
      
      if (!action) {
        throw new Error('Action not found');
      }
      
      if (action.status !== 'pending_approval') {
        throw new Error('Action is not pending approval');
      }
      
      action.status = 'cancelled';
      action.error_message = `Rejected by ${rejectedBy}: ${reason}`;
      action.completed_at = new Date();
      
      await action.save();
      
      console.log(`Action rejected: ${actionId} by ${rejectedBy} - ${reason}`);
      this.emit('action_rejected', { action: action, rejected_by: rejectedBy, reason: reason });
      
      return action;
      
    } catch (error) {
      console.error('Error rejecting action:', error);
      throw error;
    }
  }
  
  /**
   * Start the remediation engine
   */
  start() {
    this.running = true;
    console.log('Remediation Engine started');
    this.emit('service_started');
  }
  
  /**
   * Stop the remediation engine
   */
  stop() {
    this.running = false;
    
    // Cancel all active executions
    for (const [actionId, execution] of this.activeExecutions) {
      clearTimeout(execution.timeout);
    }
    
    this.activeExecutions.clear();
    this.executionQueue = [];
    
    console.log('Remediation Engine stopped');
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
      queue_size: this.executionQueue.length,
      active_executions: this.activeExecutions.size,
      action_templates: this.actionTemplates.size,
      remediation_policies: this.remediationPolicies.size,
      devices_in_cooldown: this.deviceCooldowns.size
    };
  }
}

module.exports = RemediationEngine;
