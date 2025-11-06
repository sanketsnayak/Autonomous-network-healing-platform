const express = require('express');
const router = express.Router();
const Incident = require('../models/Incident');
const Action = require('../models/Action');
const Policy = require('../models/Policy');

/**
 * Routes for Incident Management
 * Handles incident creation, retrieval, and lifecycle management
 */

// GET /api/incidents - Get all incidents with filtering and pagination
router.get('/', async (req, res) => {
  try {
    // Extract query parameters for filtering and pagination
    const {
      page = 1,              // Page number for pagination
      limit = 20,            // Number of incidents per page
      status,                // Filter by incident status
      severity,              // Filter by severity level
      category,              // Filter by incident category
      affected_device,       // Filter by affected device
      start_date,            // Filter by date range start
      end_date,              // Filter by date range end
      sort_by = 'createdAt', // Sort field
      sort_order = 'desc'    // Sort direction
    } = req.query;
    
    // Build filter query
    const filter = {};
    
    if (status) {
      filter.state = status;
    }
    
    if (severity) {
      filter.severity = severity;
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (affected_device) {
      filter.affected_devices = { $in: [affected_device] };
    }
    
    // Date range filtering
    if (start_date || end_date) {
      filter.createdAt = {};
      if (start_date) {
        filter.createdAt.$gte = new Date(start_date);
      }
      if (end_date) {
        filter.createdAt.$lte = new Date(end_date);
      }
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build sort object
    const sort = {};
    sort[sort_by] = sort_order === 'desc' ? -1 : 1;
    
    // Execute query with population of related data
    const incidents = await Incident.find(filter)
      .populate('alerts')
      .populate('primary_alert')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Incident.countDocuments(filter);
    
    // Prepare response with pagination metadata
    res.json({
      incidents: incidents,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / parseInt(limit)),
        total_incidents: total,
        incidents_per_page: parseInt(limit),
        has_next: skip + incidents.length < total,
        has_prev: parseInt(page) > 1
      },
      filters_applied: {
        status,
        severity,
        category,
        affected_device,
        date_range: { start_date, end_date }
      }
    });
    
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ 
      error: 'Failed to fetch incidents',
      details: error.message 
    });
  }
});

// GET /api/incidents/:id - Get specific incident with full details
router.get('/:id', async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('alerts')
      .populate('primary_alert')
      .populate({
        path: 'remediation_attempts.action_id',
        model: 'Action'
      });
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    // Get related actions for this incident
    const relatedActions = await Action.find({ incident_id: incident._id })
      .sort({ createdAt: -1 });
    
    // Prepare comprehensive incident data
    const incidentDetails = {
      ...incident.toObject(),
      related_actions: relatedActions,
      timeline: [
        ...incident.status_history.map(entry => ({
          timestamp: entry.changed_at,
          type: 'status_change',
          description: `Status changed to ${entry.status}`,
          user: entry.changed_by,
          details: entry.reason
        })),
        ...relatedActions.map(action => ({
          timestamp: action.createdAt,
          type: 'action_created',
          description: `Remediation action created: ${action.type}`,
          user: action.executed_by,
          details: action.description
        }))
      ].sort((a, b) => a.timestamp - b.timestamp)
    };
    
    res.json(incidentDetails);
    
  } catch (error) {
    console.error('Error fetching incident details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch incident details',
      details: error.message 
    });
  }
});

// PATCH /api/incidents/:id - Update incident status or properties
router.patch('/:id', async (req, res) => {
  try {
    const { 
      state,           // New incident state
      assigned_to,     // Assign incident to user
      priority,        // Update priority
      notes,           // Add notes
      escalation_level // Update escalation level
    } = req.body;
    
    const incident = await Incident.findById(req.params.id);
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    // Track status changes for audit trail
    const statusChange = {
      status: state || incident.state,
      changed_by: req.body.changed_by || 'api_user',
      changed_at: new Date(),
      reason: req.body.reason || 'Updated via API'
    };
    
    // Update incident properties
    if (state) {
      incident.state = state;
      
      // Set timestamps based on state transitions
      if (state === 'investigating' && !incident.investigation_started_at) {
        incident.investigation_started_at = new Date();
      } else if (state === 'in_progress' && !incident.remediation_started_at) {
        incident.remediation_started_at = new Date();
      } else if (state === 'resolved' && !incident.resolvedAt) {
        incident.resolvedAt = new Date();
        
        // Calculate SLA metrics
        if (incident.first_alert_time) {
          incident.time_to_resolve = Math.floor(
            (incident.resolvedAt - incident.first_alert_time) / (1000 * 60)
          );
        }
      } else if (state === 'closed' && !incident.closedAt) {
        incident.closedAt = new Date();
      }
    }
    
    if (assigned_to) {
      incident.assigned_to = assigned_to;
    }
    
    if (priority) {
      incident.priority = priority;
    }
    
    if (escalation_level !== undefined) {
      incident.escalation_level = escalation_level;
    }
    
    // Add to status history
    incident.status_history.push(statusChange);
    
    // Add communication log entry if notes provided
    if (notes) {
      incident.communication_log.push({
        timestamp: new Date(),
        user: req.body.changed_by || 'api_user',
        message: notes
      });
    }
    
    await incident.save();
    
    res.json({
      success: true,
      incident: incident,
      message: 'Incident updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating incident:', error);
    res.status(500).json({ 
      error: 'Failed to update incident',
      details: error.message 
    });
  }
});

// POST /api/incidents/:id/acknowledge - Acknowledge an incident
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const { acknowledged_by, notes } = req.body;
    
    if (!acknowledged_by) {
      return res.status(400).json({ error: 'acknowledged_by is required' });
    }
    
    const incident = await Incident.findById(req.params.id);
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    if (incident.state !== 'open') {
      return res.status(400).json({ error: 'Only open incidents can be acknowledged' });
    }
    
    // Update incident
    incident.state = 'investigating';
    incident.assigned_to = acknowledged_by;
    incident.acknowledged_at = new Date();
    incident.investigation_started_at = new Date();
    
    // Calculate time to acknowledge
    if (incident.first_alert_time) {
      incident.time_to_acknowledge = Math.floor(
        (incident.acknowledged_at - incident.first_alert_time) / (1000 * 60)
      );
    }
    
    // Add to status history
    incident.status_history.push({
      status: 'investigating',
      changed_by: acknowledged_by,
      changed_at: new Date(),
      reason: 'Incident acknowledged'
    });
    
    // Add communication log entry
    incident.communication_log.push({
      timestamp: new Date(),
      user: acknowledged_by,
      message: notes || 'Incident acknowledged and investigation started'
    });
    
    await incident.save();
    
    res.json({
      success: true,
      incident: incident,
      message: 'Incident acknowledged successfully'
    });
    
  } catch (error) {
    console.error('Error acknowledging incident:', error);
    res.status(500).json({ 
      error: 'Failed to acknowledge incident',
      details: error.message 
    });
  }
});

// POST /api/incidents/:id/escalate - Escalate an incident
router.post('/:id/escalate', async (req, res) => {
  try {
    const { escalated_by, escalation_reason, escalate_to } = req.body;
    
    if (!escalated_by || !escalation_reason) {
      return res.status(400).json({ 
        error: 'escalated_by and escalation_reason are required' 
      });
    }
    
    const incident = await Incident.findById(req.params.id);
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    // Update escalation level
    incident.escalation_level += 1;
    incident.state = 'escalated';
    
    // Update assignment if escalate_to is provided
    if (escalate_to) {
      incident.assigned_to = escalate_to;
    }
    
    // Add to status history
    incident.status_history.push({
      status: 'escalated',
      changed_by: escalated_by,
      changed_at: new Date(),
      reason: escalation_reason
    });
    
    // Add communication log entry
    incident.communication_log.push({
      timestamp: new Date(),
      user: escalated_by,
      message: `Incident escalated to level ${incident.escalation_level}: ${escalation_reason}`
    });
    
    // Add to stakeholders if escalate_to is provided
    if (escalate_to && !incident.stakeholders_notified.includes(escalate_to)) {
      incident.stakeholders_notified.push(escalate_to);
    }
    
    await incident.save();
    
    res.json({
      success: true,
      incident: incident,
      message: `Incident escalated to level ${incident.escalation_level}`
    });
    
  } catch (error) {
    console.error('Error escalating incident:', error);
    res.status(500).json({ 
      error: 'Failed to escalate incident',
      details: error.message 
    });
  }
});

// GET /api/incidents/statistics/overview - Get incident statistics
router.get('/statistics/overview', async (req, res) => {
  try {
    const { 
      start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
      end_date = new Date() 
    } = req.query;
    
    // Build date filter
    const dateFilter = {
      createdAt: {
        $gte: new Date(start_date),
        $lte: new Date(end_date)
      }
    };
    
    // Get total incident count
    const totalIncidents = await Incident.countDocuments(dateFilter);
    
    // Get incidents by status
    const incidentsByStatus = await Incident.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$state', count: { $sum: 1 } } }
    ]);
    
    // Get incidents by severity
    const incidentsBySeverity = await Incident.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ]);
    
    // Get incidents by category
    const incidentsByCategory = await Incident.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    
    // Calculate average resolution time
    const resolvedIncidents = await Incident.find({
      ...dateFilter,
      state: 'resolved',
      time_to_resolve: { $exists: true, $ne: null }
    });
    
    const avgResolutionTime = resolvedIncidents.length > 0
      ? resolvedIncidents.reduce((sum, incident) => sum + incident.time_to_resolve, 0) / resolvedIncidents.length
      : 0;
    
    // Get top affected devices
    const topAffectedDevices = await Incident.aggregate([
      { $match: dateFilter },
      { $unwind: '$affected_devices' },
      { $group: { _id: '$affected_devices', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Calculate SLA metrics
    const slaBreaches = await Incident.countDocuments({
      ...dateFilter,
      sla_breach: true
    });
    
    const slaCompliance = totalIncidents > 0 
      ? ((totalIncidents - slaBreaches) / totalIncidents * 100).toFixed(2)
      : 100;
    
    res.json({
      period: {
        start_date: new Date(start_date),
        end_date: new Date(end_date)
      },
      overview: {
        total_incidents: totalIncidents,
        resolved_incidents: resolvedIncidents.length,
        open_incidents: await Incident.countDocuments({ 
          ...dateFilter, 
          state: { $in: ['open', 'investigating', 'in_progress'] } 
        }),
        sla_compliance_percentage: parseFloat(slaCompliance),
        average_resolution_time_minutes: Math.round(avgResolutionTime)
      },
      breakdown: {
        by_status: incidentsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        by_severity: incidentsBySeverity.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        by_category: incidentsByCategory.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      top_affected_devices: topAffectedDevices.map(item => ({
        device: item._id,
        incident_count: item.count
      }))
    });
    
  } catch (error) {
    console.error('Error fetching incident statistics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch incident statistics',
      details: error.message 
    });
  }
});

// GET /api/incidents/timeline/:id - Get detailed timeline for an incident
router.get('/timeline/:id', async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('alerts')
      .populate('primary_alert');
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    // Get related actions
    const actions = await Action.find({ incident_id: incident._id })
      .sort({ createdAt: 1 });
    
    // Build comprehensive timeline
    const timeline = [];
    
    // Add alert events
    if (incident.alerts) {
      incident.alerts.forEach(alert => {
        timeline.push({
          timestamp: alert.createdAt,
          type: 'alert',
          severity: alert.severity,
          description: `Alert: ${alert.type}`,
          details: {
            alert_id: alert.alert_id,
            device: alert.device,
            message: alert.message
          }
        });
      });
    }
    
    // Add incident lifecycle events
    incident.status_history.forEach(entry => {
      timeline.push({
        timestamp: entry.changed_at,
        type: 'status_change',
        severity: 'info',
        description: `Status changed to ${entry.status}`,
        details: {
          changed_by: entry.changed_by,
          reason: entry.reason
        }
      });
    });
    
    // Add RCA events
    if (incident.rca_results && incident.rca_results.length > 0) {
      incident.rca_results.forEach((rca, index) => {
        timeline.push({
          timestamp: incident.createdAt, // Approximate timestamp
          type: 'rca_analysis',
          severity: 'info',
          description: `Root cause analysis completed`,
          details: {
            suspected_cause: rca.suspected_cause,
            confidence_score: rca.confidence_score,
            analysis_method: rca.analysis_method
          }
        });
      });
    }
    
    // Add action events
    actions.forEach(action => {
      timeline.push({
        timestamp: action.createdAt,
        type: 'action_created',
        severity: action.risk_level === 'high' ? 'warning' : 'info',
        description: `Remediation action created: ${action.type}`,
        details: {
          action_id: action.action_id,
          target_device: action.target_device,
          status: action.status
        }
      });
      
      if (action.started_at) {
        timeline.push({
          timestamp: action.started_at,
          type: 'action_started',
          severity: 'info',
          description: `Action execution started: ${action.type}`,
          details: {
            action_id: action.action_id,
            target_device: action.target_device
          }
        });
      }
      
      if (action.completed_at) {
        timeline.push({
          timestamp: action.completed_at,
          type: action.success ? 'action_completed' : 'action_failed',
          severity: action.success ? 'success' : 'error',
          description: `Action ${action.success ? 'completed successfully' : 'failed'}: ${action.type}`,
          details: {
            action_id: action.action_id,
            target_device: action.target_device,
            result: action.result,
            error: action.error_message
          }
        });
      }
    });
    
    // Add communication events
    incident.communication_log.forEach(entry => {
      timeline.push({
        timestamp: entry.timestamp,
        type: 'communication',
        severity: 'info',
        description: 'Communication logged',
        details: {
          user: entry.user,
          message: entry.message
        }
      });
    });
    
    // Sort timeline by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp);
    
    res.json({
      incident_id: incident.incident_id,
      timeline: timeline,
      summary: {
        total_events: timeline.length,
        alerts_count: timeline.filter(e => e.type === 'alert').length,
        actions_count: timeline.filter(e => e.type.startsWith('action')).length,
        status_changes: timeline.filter(e => e.type === 'status_change').length
      }
    });
    
  } catch (error) {
    console.error('Error fetching incident timeline:', error);
    res.status(500).json({ 
      error: 'Failed to fetch incident timeline',
      details: error.message 
    });
  }
});

module.exports = router;
