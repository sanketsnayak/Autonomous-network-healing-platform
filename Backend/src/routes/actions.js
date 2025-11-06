/**
 * Action Management API Routes
 * 
 * This module provides RESTful endpoints for managing remediation actions.
 * Actions represent automated or manual interventions that can be executed
 * to resolve network issues and incidents.
 * 
 * Endpoints:
 * - GET /api/actions - List all actions with filtering
 * - GET /api/actions/:id - Get specific action details
 * - POST /api/actions - Create new action
 * - PUT /api/actions/:id - Update existing action
 * - DELETE /api/actions/:id - Delete action
 * - POST /api/actions/:id/execute - Execute action
 * - POST /api/actions/:id/rollback - Rollback action
 * - GET /api/actions/:id/history - Get action execution history
 * - GET /api/actions/templates - Get action templates
 */

const express = require('express');
const router = express.Router();
const Action = require('../models/Action');

/**
 * GET /api/actions
 * Retrieve all actions with optional filtering and pagination
 * 
 * Query parameters:
 * - status: Filter by action status (pending, running, completed, failed, rolled_back)
 * - type: Filter by action type (configuration, restart, failover, etc.)
 * - deviceId: Filter by target device
 * - incidentId: Filter by associated incident
 * - automated: Filter by execution mode (true/false)
 * - page: Page number for pagination
 * - limit: Number of items per page
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      type,
      deviceId,
      incidentId,
      automated,
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (deviceId) filter.targetDevice = deviceId;
    if (incidentId) filter.incidentId = incidentId;
    if (automated !== undefined) filter.automated = automated === 'true';
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'commands.command': { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Action.countDocuments(filter);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Fetch actions with pagination and population
    const actions = await Action.find(filter)
      .populate('targetDevice', 'name type ipAddress')
      .populate('incidentId', 'title severity status')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Calculate statistics
    const stats = await Action.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalActions: { $sum: 1 },
          pendingActions: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          runningActions: { $sum: { $cond: [{ $eq: ['$status', 'running'] }, 1, 0] } },
          completedActions: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          failedActions: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          automatedActions: { $sum: { $cond: ['$automated', 1, 0] } },
          manualActions: { $sum: { $cond: [{ $not: '$automated' }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      data: actions,
      statistics: stats[0] || {
        totalActions: 0,
        pendingActions: 0,
        runningActions: 0,
        completedActions: 0,
        failedActions: 0,
        automatedActions: 0,
        manualActions: 0
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching actions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch actions',
      message: error.message
    });
  }
});

/**
 * GET /api/actions/history
 * Get all actions as history (for backward compatibility)
 */
router.get('/history', async (req, res) => {
  try {
    const actions = await Action.find()
      .populate('targetDevice', 'name type ipAddress')
      .populate('incidentId', 'title severity status')
      .sort({ createdAt: -1 })
      .limit(100); // Limit to last 100 actions

    res.json({
      success: true,
      data: actions
    });

  } catch (error) {
    console.error('Error fetching action history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch action history',
      message: error.message
    });
  }
});

/**
 * GET /api/actions/:id
 * Retrieve a specific action by ID with detailed information
 */
router.get('/:id', async (req, res) => {
  try {
    const action = await Action.findById(req.params.id)
      .populate('targetDevice', 'name type ipAddress location')
      .populate('incidentId', 'title description severity status')
      .populate('executedBy', 'name email role');
    
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found',
        message: `Action with ID ${req.params.id} does not exist`
      });
    }

    res.json({
      success: true,
      data: action
    });

  } catch (error) {
    console.error('Error fetching action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch action',
      message: error.message
    });
  }
});

/**
 * POST /api/actions
 * Create a new remediation action
 * 
 * Required fields: name, type, targetDevice, commands
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      targetDevice,
      commands,
      automated = false,
      requiresApproval = false,
      incidentId,
      priority = 5,
      timeout = 300,
      rollbackCommands
    } = req.body;

    // Validate required fields
    if (!name || !type || !targetDevice || !commands) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'name, type, targetDevice, and commands are required'
      });
    }

    // Validate commands structure
    if (!Array.isArray(commands) || commands.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid commands',
        message: 'Commands must be a non-empty array'
      });
    }

    // Validate command objects
    for (const command of commands) {
      if (!command.command || !command.protocol) {
        return res.status(400).json({
          success: false,
          error: 'Invalid command structure',
          message: 'Each command must have command and protocol fields'
        });
      }
    }

    // Create new action
    const action = new Action({
      name,
      description,
      type,
      targetDevice,
      commands,
      automated,
      requiresApproval,
      incidentId,
      priority,
      timeout,
      rollbackCommands: rollbackCommands || [],
      status: requiresApproval ? 'pending_approval' : 'pending'
    });

    await action.save();

    // Populate the response
    await action.populate('targetDevice', 'name type ipAddress');
    if (incidentId) {
      await action.populate('incidentId', 'title severity status');
    }

    res.status(201).json({
      success: true,
      data: action,
      message: 'Action created successfully'
    });

  } catch (error) {
    console.error('Error creating action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create action',
      message: error.message
    });
  }
});

/**
 * PUT /api/actions/:id
 * Update an existing action (only if not executed)
 */
router.put('/:id', async (req, res) => {
  try {
    const action = await Action.findById(req.params.id);
    
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found',
        message: `Action with ID ${req.params.id} does not exist`
      });
    }

    // Prevent updates to executed actions
    if (['running', 'completed', 'failed'].includes(action.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot update executed action',
        message: 'Actions that have been executed cannot be modified'
      });
    }

    // Update action
    const updatedAction = await Action.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate('targetDevice', 'name type ipAddress')
     .populate('incidentId', 'title severity status');

    res.json({
      success: true,
      data: updatedAction,
      message: 'Action updated successfully'
    });

  } catch (error) {
    console.error('Error updating action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update action',
      message: error.message
    });
  }
});

/**
 * DELETE /api/actions/:id
 * Delete an action (only if not executed)
 */
router.delete('/:id', async (req, res) => {
  try {
    const action = await Action.findById(req.params.id);
    
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found',
        message: `Action with ID ${req.params.id} does not exist`
      });
    }

    // Prevent deletion of executed actions
    if (['running', 'completed', 'failed'].includes(action.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete executed action',
        message: 'Actions that have been executed cannot be deleted'
      });
    }

    await Action.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Action deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete action',
      message: error.message
    });
  }
});

/**
 * POST /api/actions/:id/execute
 * Execute an action
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const { executedBy, parameters = {} } = req.body;
    
    const action = await Action.findById(req.params.id);
    
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found',
        message: `Action with ID ${req.params.id} does not exist`
      });
    }

    // Check if action can be executed
    if (!['pending', 'pending_approval'].includes(action.status)) {
      return res.status(400).json({
        success: false,
        error: 'Action cannot be executed',
        message: `Action is in ${action.status} status and cannot be executed`
      });
    }

    // Check approval requirement
    if (action.requiresApproval && action.status === 'pending_approval' && !req.body.approved) {
      return res.status(400).json({
        success: false,
        error: 'Action requires approval',
        message: 'This action requires approval before execution'
      });
    }

    // Update action status to running
    action.status = 'running';
    action.executedBy = executedBy;
    action.executedAt = new Date();
    action.executionParameters = parameters;

    // Add execution log entry
    action.executionLog.push({
      timestamp: new Date(),
      action: 'execution_started',
      message: 'Action execution initiated',
      executedBy: executedBy
    });

    await action.save();

    // In a real implementation, this would trigger the RemediationEngine
    // For now, we'll simulate execution with a timeout
    setTimeout(async () => {
      try {
        // Simulate command execution
        const executionResults = [];
        let allSuccessful = true;

        for (const command of action.commands) {
          const result = {
            command: command.command,
            protocol: command.protocol,
            status: Math.random() > 0.1 ? 'success' : 'failed', // 90% success rate
            output: `Command executed successfully`,
            timestamp: new Date()
          };

          if (result.status === 'failed') {
            allSuccessful = false;
            result.output = 'Command execution failed';
          }

          executionResults.push(result);
        }

        // Update action with results
        const updatedAction = await Action.findById(req.params.id);
        updatedAction.status = allSuccessful ? 'completed' : 'failed';
        updatedAction.executionResults = executionResults;
        updatedAction.completedAt = new Date();

        updatedAction.executionLog.push({
          timestamp: new Date(),
          action: allSuccessful ? 'execution_completed' : 'execution_failed',
          message: allSuccessful ? 'Action executed successfully' : 'Action execution failed',
          details: { totalCommands: action.commands.length, successfulCommands: executionResults.filter(r => r.status === 'success').length }
        });

        await updatedAction.save();

      } catch (error) {
        console.error('Error during action execution simulation:', error);
        // Update action status to failed
        const failedAction = await Action.findById(req.params.id);
        failedAction.status = 'failed';
        failedAction.executionLog.push({
          timestamp: new Date(),
          action: 'execution_error',
          message: 'Action execution encountered an error',
          error: error.message
        });
        await failedAction.save();
      }
    }, 2000); // Simulate 2 second execution time

    res.json({
      success: true,
      data: action,
      message: 'Action execution started'
    });

  } catch (error) {
    console.error('Error executing action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute action',
      message: error.message
    });
  }
});

/**
 * POST /api/actions/:id/rollback
 * Rollback an executed action
 */
router.post('/:id/rollback', async (req, res) => {
  try {
    const { executedBy, reason } = req.body;
    
    const action = await Action.findById(req.params.id);
    
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found',
        message: `Action with ID ${req.params.id} does not exist`
      });
    }

    // Check if action can be rolled back
    if (action.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Action cannot be rolled back',
        message: 'Only completed actions can be rolled back'
      });
    }

    // Check if rollback commands are available
    if (!action.rollbackCommands || action.rollbackCommands.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No rollback commands available',
        message: 'This action does not have rollback commands defined'
      });
    }

    // Update action status
    action.status = 'rolling_back';
    action.rollbackInitiatedBy = executedBy;
    action.rollbackInitiatedAt = new Date();
    action.rollbackReason = reason;

    action.executionLog.push({
      timestamp: new Date(),
      action: 'rollback_started',
      message: 'Action rollback initiated',
      executedBy: executedBy,
      reason: reason
    });

    await action.save();

    // Simulate rollback execution
    setTimeout(async () => {
      try {
        const rollbackResults = [];
        let rollbackSuccessful = true;

        for (const command of action.rollbackCommands) {
          const result = {
            command: command.command,
            protocol: command.protocol,
            status: Math.random() > 0.05 ? 'success' : 'failed', // 95% success rate for rollback
            output: `Rollback command executed successfully`,
            timestamp: new Date()
          };

          if (result.status === 'failed') {
            rollbackSuccessful = false;
            result.output = 'Rollback command execution failed';
          }

          rollbackResults.push(result);
        }

        // Update action with rollback results
        const updatedAction = await Action.findById(req.params.id);
        updatedAction.status = rollbackSuccessful ? 'rolled_back' : 'rollback_failed';
        updatedAction.rollbackResults = rollbackResults;
        updatedAction.rollbackCompletedAt = new Date();

        updatedAction.executionLog.push({
          timestamp: new Date(),
          action: rollbackSuccessful ? 'rollback_completed' : 'rollback_failed',
          message: rollbackSuccessful ? 'Action rolled back successfully' : 'Action rollback failed',
          details: { 
            totalCommands: action.rollbackCommands.length, 
            successfulCommands: rollbackResults.filter(r => r.status === 'success').length 
          }
        });

        await updatedAction.save();

      } catch (error) {
        console.error('Error during rollback execution:', error);
        const failedAction = await Action.findById(req.params.id);
        failedAction.status = 'rollback_failed';
        failedAction.executionLog.push({
          timestamp: new Date(),
          action: 'rollback_error',
          message: 'Rollback execution encountered an error',
          error: error.message
        });
        await failedAction.save();
      }
    }, 1500); // Simulate 1.5 second rollback time

    res.json({
      success: true,
      data: action,
      message: 'Action rollback started'
    });

  } catch (error) {
    console.error('Error rolling back action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rollback action',
      message: error.message
    });
  }
});

/**
 * GET /api/actions/:id/history
 * Get execution history and logs for a specific action
 */
router.get('/:id/history', async (req, res) => {
  try {
    const action = await Action.findById(req.params.id)
      .populate('targetDevice', 'name type')
      .populate('executedBy', 'name email')
      .populate('rollbackInitiatedBy', 'name email');
    
    if (!action) {
      return res.status(404).json({
        success: false,
        error: 'Action not found',
        message: `Action with ID ${req.params.id} does not exist`
      });
    }

    const history = {
      actionId: action._id,
      actionName: action.name,
      executionTimeline: [
        {
          timestamp: action.createdAt,
          event: 'action_created',
          description: 'Action was created'
        }
      ],
      executionLog: action.executionLog,
      executionResults: action.executionResults || [],
      rollbackResults: action.rollbackResults || [],
      summary: {
        status: action.status,
        createdAt: action.createdAt,
        executedAt: action.executedAt,
        completedAt: action.completedAt,
        rollbackInitiatedAt: action.rollbackInitiatedAt,
        rollbackCompletedAt: action.rollbackCompletedAt,
        totalExecutionTime: action.executedAt && action.completedAt 
          ? action.completedAt.getTime() - action.executedAt.getTime()
          : null
      }
    };

    // Add execution events to timeline
    if (action.executedAt) {
      history.executionTimeline.push({
        timestamp: action.executedAt,
        event: 'execution_started',
        description: 'Action execution began'
      });
    }

    if (action.completedAt) {
      history.executionTimeline.push({
        timestamp: action.completedAt,
        event: 'execution_completed',
        description: `Action execution ${action.status}`
      });
    }

    if (action.rollbackInitiatedAt) {
      history.executionTimeline.push({
        timestamp: action.rollbackInitiatedAt,
        event: 'rollback_started',
        description: 'Action rollback initiated'
      });
    }

    if (action.rollbackCompletedAt) {
      history.executionTimeline.push({
        timestamp: action.rollbackCompletedAt,
        event: 'rollback_completed',
        description: 'Action rollback completed'
      });
    }

    // Sort timeline by timestamp
    history.executionTimeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Error fetching action history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch action history',
      message: error.message
    });
  }
});

/**
 * GET /api/actions/templates
 * Get predefined action templates for common remediation tasks
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'restart_service',
        name: 'Restart Service',
        description: 'Restart a specific service on the target device',
        type: 'restart',
        commands: [
          {
            command: 'systemctl restart {service_name}',
            protocol: 'SSH',
            timeout: 30,
            parameters: ['service_name']
          }
        ],
        rollbackCommands: [
          {
            command: 'systemctl status {service_name}',
            protocol: 'SSH',
            timeout: 10
          }
        ],
        requiresApproval: false,
        automated: true
      },
      {
        id: 'interface_reset',
        name: 'Reset Network Interface',
        description: 'Reset a network interface on a network device',
        type: 'configuration',
        commands: [
          {
            command: 'shutdown interface {interface_name}',
            protocol: 'NETCONF',
            timeout: 15
          },
          {
            command: 'no shutdown interface {interface_name}',
            protocol: 'NETCONF',
            timeout: 15
          }
        ],
        rollbackCommands: [],
        requiresApproval: true,
        automated: false
      },
      {
        id: 'clear_arp_cache',
        name: 'Clear ARP Cache',
        description: 'Clear the ARP cache on a network device',
        type: 'maintenance',
        commands: [
          {
            command: 'clear arp-cache',
            protocol: 'CLI',
            timeout: 10
          }
        ],
        rollbackCommands: [],
        requiresApproval: false,
        automated: true
      },
      {
        id: 'reboot_device',
        name: 'Reboot Device',
        description: 'Perform a complete reboot of the target device',
        type: 'restart',
        commands: [
          {
            command: 'reload in 1',
            protocol: 'CLI',
            timeout: 600
          }
        ],
        rollbackCommands: [],
        requiresApproval: true,
        automated: false
      },
      {
        id: 'failover_interface',
        name: 'Interface Failover',
        description: 'Failover traffic from primary to backup interface',
        type: 'failover',
        commands: [
          {
            command: 'shutdown interface {primary_interface}',
            protocol: 'NETCONF',
            timeout: 20
          },
          {
            command: 'no shutdown interface {backup_interface}',
            protocol: 'NETCONF',
            timeout: 20
          }
        ],
        rollbackCommands: [
          {
            command: 'no shutdown interface {primary_interface}',
            protocol: 'NETCONF',
            timeout: 20
          },
          {
            command: 'shutdown interface {backup_interface}',
            protocol: 'NETCONF',
            timeout: 20
          }
        ],
        requiresApproval: true,
        automated: false
      }
    ];

    res.json({
      success: true,
      data: templates,
      count: templates.length
    });

  } catch (error) {
    console.error('Error fetching action templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch action templates',
      message: error.message
    });
  }
});

module.exports = router;
