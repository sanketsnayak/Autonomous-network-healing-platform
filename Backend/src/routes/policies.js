/**
 * Policy Management API Routes
 * 
 * This module provides RESTful endpoints for managing network automation policies.
 * Policies define automated responses to network events and conditions.
 * 
 * Endpoints:
 * - GET /api/policies - List all policies with filtering
 * - GET /api/policies/:id - Get specific policy details
 * - POST /api/policies - Create new policy
 * - PUT /api/policies/:id - Update existing policy
 * - DELETE /api/policies/:id - Delete policy
 * - POST /api/policies/:id/activate - Activate policy
 * - POST /api/policies/:id/deactivate - Deactivate policy
 * - GET /api/policies/:id/history - Get policy execution history
 */

const express = require('express');
const router = express.Router();
const Policy = require('../models/Policy');

/**
 * GET /api/policies
 * Retrieve all policies with optional filtering and pagination
 * 
 * Query parameters:
 * - status: Filter by policy status (active, inactive, draft)
 * - type: Filter by policy type (preventive, reactive, proactive)
 * - priority: Filter by priority level
 * - page: Page number for pagination
 * - limit: Number of items per page
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      type,
      priority,
      page = 1,
      limit = 10,
      search
    } = req.query;

    // Build filter object based on query parameters
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Policy.countDocuments(filter);

    // Fetch policies with pagination
    const policies = await Policy.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: policies,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch policies',
      message: error.message
    });
  }
});

/**
 * GET /api/policies/:id
 * Retrieve a specific policy by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found',
        message: `Policy with ID ${req.params.id} does not exist`
      });
    }

    res.json({
      success: true,
      data: policy
    });

  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch policy',
      message: error.message
    });
  }
});

/**
 * POST /api/policies
 * Create a new automation policy
 * 
 * Required fields: name, description, type, conditions, actions
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      conditions,
      actions,
      priority = 5,
      cooldownPeriod = 300,
      maxExecutions = 10
    } = req.body;

    // Validate required fields
    if (!name || !description || !type || !conditions || !actions) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'name, description, type, conditions, and actions are required'
      });
    }

    // Validate conditions and actions structure
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conditions',
        message: 'Conditions must be a non-empty array'
      });
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid actions',
        message: 'Actions must be a non-empty array'
      });
    }

    // Create new policy
    const policy = new Policy({
      name,
      description,
      type,
      conditions,
      actions,
      priority,
      cooldownPeriod,
      maxExecutions,
      status: 'draft' // New policies start as draft
    });

    await policy.save();

    res.status(201).json({
      success: true,
      data: policy,
      message: 'Policy created successfully'
    });

  } catch (error) {
    console.error('Error creating policy:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Policy name already exists',
        message: 'A policy with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create policy',
      message: error.message
    });
  }
});

/**
 * PUT /api/policies/:id
 * Update an existing policy
 */
router.put('/:id', async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found',
        message: `Policy with ID ${req.params.id} does not exist`
      });
    }

    // Update policy fields
    const updatedPolicy = await Policy.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedPolicy,
      message: 'Policy updated successfully'
    });

  } catch (error) {
    console.error('Error updating policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update policy',
      message: error.message
    });
  }
});

/**
 * DELETE /api/policies/:id
 * Delete a policy (only if not active)
 */
router.delete('/:id', async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found',
        message: `Policy with ID ${req.params.id} does not exist`
      });
    }

    // Prevent deletion of active policies
    if (policy.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete active policy',
        message: 'Deactivate the policy before deleting it'
      });
    }

    await Policy.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Policy deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete policy',
      message: error.message
    });
  }
});

/**
 * POST /api/policies/:id/activate
 * Activate a policy for execution
 */
router.post('/:id/activate', async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found',
        message: `Policy with ID ${req.params.id} does not exist`
      });
    }

    if (policy.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Policy already active',
        message: 'This policy is already active'
      });
    }

    // Activate the policy
    policy.status = 'active';
    policy.activatedAt = new Date();
    await policy.save();

    res.json({
      success: true,
      data: policy,
      message: 'Policy activated successfully'
    });

  } catch (error) {
    console.error('Error activating policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate policy',
      message: error.message
    });
  }
});

/**
 * POST /api/policies/:id/deactivate
 * Deactivate a policy
 */
router.post('/:id/deactivate', async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found',
        message: `Policy with ID ${req.params.id} does not exist`
      });
    }

    if (policy.status === 'inactive') {
      return res.status(400).json({
        success: false,
        error: 'Policy already inactive',
        message: 'This policy is already inactive'
      });
    }

    // Deactivate the policy
    policy.status = 'inactive';
    policy.deactivatedAt = new Date();
    await policy.save();

    res.json({
      success: true,
      data: policy,
      message: 'Policy deactivated successfully'
    });

  } catch (error) {
    console.error('Error deactivating policy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate policy',
      message: error.message
    });
  }
});

/**
 * GET /api/policies/:id/history
 * Get execution history for a specific policy
 */
router.get('/:id/history', async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found',
        message: `Policy with ID ${req.params.id} does not exist`
      });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get execution history (from executionHistory array)
    const totalExecutions = policy.executionHistory.length;
    const executions = policy.executionHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: {
        policyId: policy._id,
        policyName: policy.name,
        executions,
        statistics: {
          totalExecutions,
          successfulExecutions: policy.executionHistory.filter(e => e.status === 'success').length,
          failedExecutions: policy.executionHistory.filter(e => e.status === 'failed').length,
          lastExecution: policy.lastExecutedAt
        }
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalExecutions / parseInt(limit)),
        total: totalExecutions,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching policy history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch policy history',
      message: error.message
    });
  }
});

module.exports = router;
