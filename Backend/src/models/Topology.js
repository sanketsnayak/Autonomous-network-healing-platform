const mongoose = require('mongoose');

// Link schema for network connections between devices
const LinkSchema = new mongoose.Schema({
  source_device: { type: String, required: true },         // Source device hostname
  source_interface: String,                                // Source interface name
  destination_device: { type: String, required: true },   // Destination device hostname
  destination_interface: String,                           // Destination interface name
  link_type: { type: String, enum: ['ethernet', 'fiber', 'wireless', 'virtual', 'tunnel'], default: 'ethernet' },
  bandwidth: String,                                        // Link bandwidth (e.g., "1Gbps", "10Gbps")
  status: { type: String, enum: ['up', 'down', 'degraded'], default: 'up' }, // Link operational status
  utilization: { type: Number, default: 0 },              // Current utilization percentage
  last_status_change: Date,                                // Last time status changed
  monitored: { type: Boolean, default: true }             // Whether link is actively monitored
}, { _id: false });

// Service dependency schema for service-to-device mapping
const ServiceDependencySchema = new mongoose.Schema({
  service_name: { type: String, required: true },          // Name of the service
  dependent_devices: [String],                             // Devices this service depends on
  critical_devices: [String],                              // Critical devices (failure causes service outage)
  service_type: { type: String, enum: ['application', 'database', 'web', 'dns', 'dhcp', 'routing'], default: 'application' },
  business_impact: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  sla_requirements: {                                       // Service level agreement requirements
    availability: { type: Number, default: 99.9 },        // Required availability percentage
    max_downtime_minutes: { type: Number, default: 60 },  // Maximum allowable downtime per month
    response_time_ms: { type: Number, default: 1000 }     // Maximum response time in milliseconds
  }
}, { _id: false });

// Site schema for geographical and organizational grouping
const SiteSchema = new mongoose.Schema({
  site_id: { type: String, required: true, unique: true }, // Unique site identifier
  name: { type: String, required: true },                  // Site name
  location: {                                               // Geographical location
    address: String,
    city: String,
    country: String,
    latitude: Number,
    longitude: Number
  },
  contact_info: {                                           // Site contact information
    primary_contact: String,
    email: String,
    phone: String,
    escalation_contact: String
  },
  business_hours: {                                         // Site operating hours
    timezone: String,
    weekdays: { start: String, end: String },
    weekends: { start: String, end: String }
  },
  devices: [String],                                        // Devices located at this site
  criticality: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' } // Site business criticality
}, { _id: false });

// Enhanced topology schema for network infrastructure mapping
const TopologySchema = new mongoose.Schema({
  // Topology identification
  topology_id: { type: String, unique: true, required: true }, // Unique topology identifier
  name: { type: String, required: true },                   // Topology name or description
  version: { type: String, default: '1.0' },               // Topology version
  
  // Network infrastructure components
  devices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }], // All devices in topology
  links: [LinkSchema],                                      // Network links between devices
  sites: [SiteSchema],                                      // Physical sites
  
  // Service and dependency mapping
  services: [ServiceDependencySchema],                      // Services and their dependencies
  service_device_map: { type: Object, default: {} },       // Mapping of services to devices
  
  // Network hierarchy and roles
  device_roles: { type: Object, default: {} },             // Device roles (core, distribution, access, etc.)
  network_segments: [{                                      // Network segments or VLANs
    segment_id: String,
    name: String,
    subnet: String,
    vlan_id: Number,
    devices: [String],
    gateway: String
  }],
  
  // Redundancy and failover paths
  redundancy_groups: [{                                     // Groups of redundant devices
    group_name: String,
    primary_device: String,
    backup_devices: [String],
    failover_type: { type: String, enum: ['active_passive', 'active_active', 'load_balanced'] }
  }],
  
  // Critical path analysis
  critical_paths: [{                                        // Critical communication paths
    path_name: String,
    source: String,
    destination: String,
    path_devices: [String],                                 // Devices in the path
    backup_paths: [[String]],                              // Alternative paths
    business_impact: String
  }],
  
  // Auto-discovery and updates
  discovery_enabled: { type: Boolean, default: true },     // Whether auto-discovery is enabled
  last_discovery: Date,                                     // Last topology discovery run
  discovery_method: { type: String, enum: ['snmp', 'lldp', 'cdp', 'manual'], default: 'snmp' },
  auto_update: { type: Boolean, default: true },           // Whether to auto-update topology
  
  // Validation and consistency
  validation_status: { type: String, enum: ['valid', 'invalid', 'unknown'], default: 'unknown' },
  validation_errors: [String],                             // Topology validation errors
  last_validation: Date,                                    // Last validation check
  consistency_score: { type: Number, default: 0 },         // Topology consistency score (0-1)
  
  // Change tracking and history
  change_history: [{                                        // History of topology changes
    timestamp: { type: Date, default: Date.now },
    change_type: { type: String, enum: ['device_added', 'device_removed', 'link_added', 'link_removed', 'update'] },
    changed_by: String,
    description: String,
    affected_components: [String]
  }],
  
  // Visualization and layout
  layout_data: { type: Object, default: {} },              // UI layout and positioning data
  visualization_settings: {                                 // Settings for topology visualization
    show_links: { type: Boolean, default: true },
    show_services: { type: Boolean, default: true },
    group_by_site: { type: Boolean, default: true },
    color_by_status: { type: Boolean, default: true }
  },
  
  // Performance and monitoring
  monitoring_coverage: { type: Number, default: 0 },       // Percentage of devices being monitored
  health_score: { type: Number, default: 0 },              // Overall topology health (0-1)
  performance_metrics: {                                    // Topology-wide performance metrics
    total_devices: { type: Number, default: 0 },
    devices_up: { type: Number, default: 0 },
    total_links: { type: Number, default: 0 },
    links_up: { type: Number, default: 0 },
    average_utilization: { type: Number, default: 0 }
  },
  
  // Metadata and configuration
  tags: [String],                                           // Custom tags for categorization
  custom_fields: { type: Object, default: {} },            // Extensible custom data
  documentation_url: String,                               // Link to topology documentation
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },            // Topology creation timestamp
  updatedAt: { type: Date, default: Date.now }             // Last update timestamp
});

// Indexes for efficient querying
TopologySchema.index({ 'devices': 1 });                   // Query by devices
TopologySchema.index({ 'sites.site_id': 1 });            // Query by site
TopologySchema.index({ 'services.service_name': 1 });     // Query by service
TopologySchema.index({ version: 1 });                     // Query by version

// Generate topology ID automatically
TopologySchema.pre('save', function() {
  if (!this.topology_id) {
    // Generate unique topology ID (TOP-YYYYMMDD-NNNN format)
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    this.topology_id = `TOP-${dateStr}-${randomNum}`;
  }
  
  // Update metrics and timestamp
  this.updatedAt = new Date();
  this.performance_metrics.total_devices = this.devices.length;
  this.performance_metrics.total_links = this.links.length;
});

// Method to find devices affected by a failed device
TopologySchema.methods.findAffectedDevices = function(failedDevice) {
  const affected = new Set();
  
  // Find directly connected devices
  this.links.forEach(link => {
    if (link.source_device === failedDevice) {
      affected.add(link.destination_device);
    } else if (link.destination_device === failedDevice) {
      affected.add(link.source_device);
    }
  });
  
  // Find services that depend on this device
  this.services.forEach(service => {
    if (service.dependent_devices.includes(failedDevice) || 
        service.critical_devices.includes(failedDevice)) {
      // Add all devices that support this service
      service.dependent_devices.forEach(device => affected.add(device));
    }
  });
  
  return Array.from(affected);
};

// Method to find alternative paths between two devices
TopologySchema.methods.findAlternativePaths = function(source, destination, maxHops = 5) {
  const paths = [];
  const visited = new Set();
  
  // Simple breadth-first search for alternative paths
  const findPaths = (current, target, path, hops) => {
    if (hops > maxHops) return;
    if (current === target && path.length > 1) {
      paths.push([...path]);
      return;
    }
    
    visited.add(current);
    
    // Find connected devices
    this.links.forEach(link => {
      let next = null;
      if (link.source_device === current && !visited.has(link.destination_device)) {
        next = link.destination_device;
      } else if (link.destination_device === current && !visited.has(link.source_device)) {
        next = link.source_device;
      }
      
      if (next && link.status === 'up') {
        path.push(next);
        findPaths(next, target, path, hops + 1);
        path.pop();
      }
    });
    
    visited.delete(current);
  };
  
  findPaths(source, destination, [source], 0);
  return paths;
};

// Method to calculate network health score
TopologySchema.methods.calculateHealthScore = function() {
  if (this.devices.length === 0) return 0;
  
  // Count healthy devices and links
  const healthyDevices = this.performance_metrics.devices_up || 0;
  const healthyLinks = this.links.filter(link => link.status === 'up').length;
  
  // Calculate weighted health score
  const deviceHealth = healthyDevices / this.devices.length;
  const linkHealth = this.links.length > 0 ? healthyLinks / this.links.length : 1;
  
  // Weighted average (devices are more important)
  this.health_score = (deviceHealth * 0.7) + (linkHealth * 0.3);
  return this.health_score;
};

module.exports = mongoose.model('Topology', TopologySchema);
