/**
 * Network Topology Management API Routes
 * 
 * This module provides RESTful endpoints for managing network topology data.
 * Topology information is crucial for understanding device relationships,
 * dependencies, and impact analysis during network incidents.
 * 
 * Endpoints:
 * - GET /api/topology - Get complete network topology
 * - GET /api/topology/devices/:deviceId - Get device topology
 * - GET /api/topology/path/:sourceId/:targetId - Find path between devices
 * - POST /api/topology/devices - Add device to topology
 * - PUT /api/topology/devices/:deviceId - Update device topology
 * - DELETE /api/topology/devices/:deviceId - Remove device from topology
 * - POST /api/topology/connections - Add connection between devices
 * - DELETE /api/topology/connections/:connectionId - Remove connection
 * - GET /api/topology/impact/:deviceId - Get impact analysis for device
 */

const express = require('express');
const router = express.Router();
const Topology = require('../models/Topology');
const Device = require('../models/Device');

/**
 * GET /api/topology
 * Retrieve complete network topology with optional filtering
 * 
 * Query parameters:
 * - includeDevices: Include device details in response
 * - deviceType: Filter by device type
 * - location: Filter by location
 * - layer: Filter by network layer (L1, L2, L3)
 */
router.get('/', async (req, res) => {
  try {
    const {
      includeDevices = false,
      deviceType,
      location,
      layer
    } = req.query;

    // Build device filter
    const deviceFilter = {};
    if (deviceType) deviceFilter.type = deviceType;
    if (location) deviceFilter.location = { $regex: location, $options: 'i' };

    // Get topology data
    let query = Topology.find();
    
    if (layer) {
      query = query.where('layer').equals(layer);
    }

    // Populate device details if requested
    if (includeDevices === 'true') {
      query = query.populate({
        path: 'devices.deviceId',
        match: deviceFilter,
        select: 'name type status location ipAddress'
      });
    }

    const topologyData = await query.exec();

    // Filter out topology entries with no matching devices if device filter was applied
    const filteredTopology = topologyData.filter(topo => {
      if (Object.keys(deviceFilter).length === 0) return true;
      return topo.devices.some(d => d.deviceId !== null);
    });

    // Calculate topology statistics
    const stats = {
      totalDevices: 0,
      totalConnections: 0,
      devicesByType: {},
      devicesByStatus: {},
      layers: new Set()
    };

    filteredTopology.forEach(topo => {
      stats.totalDevices += topo.devices.length;
      stats.totalConnections += topo.connections.length;
      stats.layers.add(topo.layer);
      
      topo.devices.forEach(device => {
        if (device.deviceId) {
          const deviceData = device.deviceId;
          stats.devicesByType[deviceData.type] = (stats.devicesByType[deviceData.type] || 0) + 1;
          stats.devicesByStatus[deviceData.status] = (stats.devicesByStatus[deviceData.status] || 0) + 1;
        }
      });
    });

    stats.layers = Array.from(stats.layers);

    res.json({
      success: true,
      data: {
        topology: filteredTopology,
        statistics: stats
      }
    });

  } catch (error) {
    console.error('Error fetching topology:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch topology',
      message: error.message
    });
  }
});

/**
 * GET /api/topology/devices/:deviceId
 * Get topology information for a specific device
 */
router.get('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Find all topology entries containing this device
    const topologyEntries = await Topology.find({
      'devices.deviceId': deviceId
    }).populate('devices.deviceId', 'name type status location ipAddress');

    if (topologyEntries.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found in topology',
        message: `Device ${deviceId} is not part of any topology`
      });
    }

    // Extract device-specific topology information
    const deviceTopology = {
      deviceId,
      layers: [],
      connections: [],
      neighbors: new Set(),
      position: null
    };

    topologyEntries.forEach(topo => {
      // Find device in this topology
      const deviceEntry = topo.devices.find(d => d.deviceId._id.toString() === deviceId);
      if (deviceEntry) {
        deviceTopology.layers.push(topo.layer);
        deviceTopology.position = deviceEntry.position;
        
        // Find connections involving this device
        const deviceConnections = topo.connections.filter(conn => 
          conn.sourceDevice.toString() === deviceId || 
          conn.targetDevice.toString() === deviceId
        );
        
        deviceConnections.forEach(conn => {
          deviceTopology.connections.push({
            ...conn.toObject(),
            topology: topo.layer
          });
          
          // Add neighbors
          const neighborId = conn.sourceDevice.toString() === deviceId 
            ? conn.targetDevice.toString()
            : conn.sourceDevice.toString();
          deviceTopology.neighbors.add(neighborId);
        });
      }
    });

    deviceTopology.neighbors = Array.from(deviceTopology.neighbors);

    res.json({
      success: true,
      data: deviceTopology
    });

  } catch (error) {
    console.error('Error fetching device topology:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device topology',
      message: error.message
    });
  }
});

/**
 * GET /api/topology/path/:sourceId/:targetId
 * Find shortest path between two devices
 */
router.get('/path/:sourceId/:targetId', async (req, res) => {
  try {
    const { sourceId, targetId } = req.params;
    const { layer } = req.query;

    // Build query filter
    const filter = {};
    if (layer) filter.layer = layer;

    // Get relevant topology data
    const topologyData = await Topology.find(filter)
      .populate('devices.deviceId', 'name type');

    if (topologyData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No topology data found',
        message: 'No topology data available for path calculation'
      });
    }

    // Build graph for path finding
    const graph = new Map();
    const deviceMap = new Map();

    topologyData.forEach(topo => {
      topo.devices.forEach(device => {
        const deviceId = device.deviceId._id.toString();
        deviceMap.set(deviceId, device.deviceId);
        if (!graph.has(deviceId)) {
          graph.set(deviceId, []);
        }
      });

      topo.connections.forEach(conn => {
        const source = conn.sourceDevice.toString();
        const target = conn.targetDevice.toString();
        
        if (graph.has(source)) {
          graph.get(source).push({ device: target, ...conn.toObject() });
        }
        if (graph.has(target)) {
          graph.get(target).push({ device: source, ...conn.toObject() });
        }
      });
    });

    // Implement breadth-first search for shortest path
    const findShortestPath = (start, end) => {
      if (start === end) return [start];
      
      const queue = [[start]];
      const visited = new Set([start]);
      
      while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];
        
        const neighbors = graph.get(current) || [];
        
        for (const neighbor of neighbors) {
          const neighborId = neighbor.device;
          
          if (neighborId === end) {
            return [...path, neighborId];
          }
          
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push([...path, neighborId]);
          }
        }
      }
      
      return null; // No path found
    };

    const path = findShortestPath(sourceId, targetId);

    if (!path) {
      return res.status(404).json({
        success: false,
        error: 'No path found',
        message: `No path exists between ${sourceId} and ${targetId}`
      });
    }

    // Enrich path with device details
    const enrichedPath = path.map(deviceId => ({
      deviceId,
      device: deviceMap.get(deviceId)
    }));

    // Get connection details for the path
    const pathConnections = [];
    for (let i = 0; i < path.length - 1; i++) {
      const source = path[i];
      const target = path[i + 1];
      
      // Find connection between these devices
      for (const topo of topologyData) {
        const connection = topo.connections.find(conn => 
          (conn.sourceDevice.toString() === source && conn.targetDevice.toString() === target) ||
          (conn.sourceDevice.toString() === target && conn.targetDevice.toString() === source)
        );
        
        if (connection) {
          pathConnections.push({
            ...connection.toObject(),
            layer: topo.layer
          });
          break;
        }
      }
    }

    res.json({
      success: true,
      data: {
        path: enrichedPath,
        connections: pathConnections,
        pathLength: path.length,
        hopCount: path.length - 1
      }
    });

  } catch (error) {
    console.error('Error finding path:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find path',
      message: error.message
    });
  }
});

/**
 * POST /api/topology/devices
 * Add a device to the network topology
 */
router.post('/devices', async (req, res) => {
  try {
    const {
      deviceId,
      layer,
      position,
      interfaces,
      metadata
    } = req.body;

    // Validate required fields
    if (!deviceId || !layer) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'deviceId and layer are required'
      });
    }

    // Verify device exists
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
        message: `Device ${deviceId} does not exist`
      });
    }

    // Find or create topology for the layer
    let topology = await Topology.findOne({ layer });
    
    if (!topology) {
      topology = new Topology({
        layer,
        devices: [],
        connections: []
      });
    }

    // Check if device already exists in this layer
    const existingDevice = topology.devices.find(d => 
      d.deviceId.toString() === deviceId
    );

    if (existingDevice) {
      return res.status(409).json({
        success: false,
        error: 'Device already exists',
        message: `Device ${deviceId} already exists in layer ${layer}`
      });
    }

    // Add device to topology
    topology.devices.push({
      deviceId,
      position: position || { x: 0, y: 0 },
      interfaces: interfaces || [],
      metadata: metadata || {}
    });

    await topology.save();

    res.status(201).json({
      success: true,
      data: topology,
      message: 'Device added to topology successfully'
    });

  } catch (error) {
    console.error('Error adding device to topology:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add device to topology',
      message: error.message
    });
  }
});

/**
 * POST /api/topology/connections
 * Add a connection between two devices in the topology
 */
router.post('/connections', async (req, res) => {
  try {
    const {
      layer,
      sourceDevice,
      targetDevice,
      connectionType,
      sourceInterface,
      targetInterface,
      bandwidth,
      latency,
      metadata
    } = req.body;

    // Validate required fields
    if (!layer || !sourceDevice || !targetDevice || !connectionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'layer, sourceDevice, targetDevice, and connectionType are required'
      });
    }

    // Find topology
    const topology = await Topology.findOne({ layer });
    if (!topology) {
      return res.status(404).json({
        success: false,
        error: 'Topology not found',
        message: `Topology for layer ${layer} does not exist`
      });
    }

    // Verify both devices exist in topology
    const sourceExists = topology.devices.some(d => 
      d.deviceId.toString() === sourceDevice
    );
    const targetExists = topology.devices.some(d => 
      d.deviceId.toString() === targetDevice
    );

    if (!sourceExists || !targetExists) {
      return res.status(404).json({
        success: false,
        error: 'Device not found in topology',
        message: 'One or both devices are not part of this topology layer'
      });
    }

    // Check if connection already exists
    const existingConnection = topology.connections.find(conn =>
      (conn.sourceDevice.toString() === sourceDevice && conn.targetDevice.toString() === targetDevice) ||
      (conn.sourceDevice.toString() === targetDevice && conn.targetDevice.toString() === sourceDevice)
    );

    if (existingConnection) {
      return res.status(409).json({
        success: false,
        error: 'Connection already exists',
        message: 'A connection between these devices already exists'
      });
    }

    // Add connection
    topology.connections.push({
      sourceDevice,
      targetDevice,
      connectionType,
      sourceInterface,
      targetInterface,
      bandwidth,
      latency,
      status: 'active',
      metadata: metadata || {}
    });

    await topology.save();

    res.status(201).json({
      success: true,
      data: topology,
      message: 'Connection added successfully'
    });

  } catch (error) {
    console.error('Error adding connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add connection',
      message: error.message
    });
  }
});

/**
 * GET /api/topology/impact/:deviceId
 * Analyze the potential impact of a device failure
 */
router.get('/impact/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Get all topology data containing this device
    const topologyData = await Topology.find({
      'devices.deviceId': deviceId
    }).populate('devices.deviceId', 'name type criticality');

    if (topologyData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
        message: `Device ${deviceId} is not part of any topology`
      });
    }

    const impactAnalysis = {
      deviceId,
      directlyAffected: new Set(),
      indirectlyAffected: new Set(),
      criticalPaths: [],
      serviceLayers: [],
      impactScore: 0
    };

    // Analyze impact across all topology layers
    for (const topology of topologyData) {
      impactAnalysis.serviceLayers.push(topology.layer);
      
      // Find directly connected devices
      const directConnections = topology.connections.filter(conn =>
        conn.sourceDevice.toString() === deviceId || 
        conn.targetDevice.toString() === deviceId
      );

      directConnections.forEach(conn => {
        const affectedDevice = conn.sourceDevice.toString() === deviceId 
          ? conn.targetDevice.toString()
          : conn.sourceDevice.toString();
        impactAnalysis.directlyAffected.add(affectedDevice);
      });

      // Analyze critical paths (simplified - devices with high connectivity)
      const deviceConnectivity = new Map();
      topology.connections.forEach(conn => {
        const source = conn.sourceDevice.toString();
        const target = conn.targetDevice.toString();
        deviceConnectivity.set(source, (deviceConnectivity.get(source) || 0) + 1);
        deviceConnectivity.set(target, (deviceConnectivity.get(target) || 0) + 1);
      });

      const failedDeviceConnectivity = deviceConnectivity.get(deviceId) || 0;
      if (failedDeviceConnectivity > 2) { // High connectivity threshold
        impactAnalysis.criticalPaths.push({
          layer: topology.layer,
          connectivity: failedDeviceConnectivity,
          reason: 'High connectivity device'
        });
      }
    }

    // Convert sets to arrays for JSON response
    impactAnalysis.directlyAffected = Array.from(impactAnalysis.directlyAffected);
    
    // Calculate impact score (simplified algorithm)
    impactAnalysis.impactScore = 
      (impactAnalysis.directlyAffected.length * 10) + 
      (impactAnalysis.criticalPaths.length * 25) +
      (impactAnalysis.serviceLayers.length * 5);

    // Determine impact level
    let impactLevel = 'low';
    if (impactAnalysis.impactScore > 75) impactLevel = 'critical';
    else if (impactAnalysis.impactScore > 50) impactLevel = 'high';
    else if (impactAnalysis.impactScore > 25) impactLevel = 'medium';

    res.json({
      success: true,
      data: {
        ...impactAnalysis,
        impactLevel,
        summary: {
          directlyAffectedCount: impactAnalysis.directlyAffected.length,
          criticalPathsCount: impactAnalysis.criticalPaths.length,
          layersAffected: impactAnalysis.serviceLayers.length,
          overallImpact: impactLevel
        }
      }
    });

  } catch (error) {
    console.error('Error analyzing impact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze impact',
      message: error.message
    });
  }
});

module.exports = router;
