const mongoose = require('mongoose');

// Interface telemetry schema for network interfaces
const InterfaceSchema = new mongoose.Schema({
  name: String,                    // Interface name (e.g., GigabitEthernet0/1)
  up: { type: Boolean, default: true },  // Interface operational status
  in_octets: { type: Number, default: 0 },   // Incoming traffic bytes
  out_octets: { type: Number, default: 0 },  // Outgoing traffic bytes
  errors: { type: Number, default: 0 },      // Interface error count
  drops: { type: Number, default: 0 },       // Packet drop count
  utilization: { type: Number, default: 0 }  // Interface utilization percentage
}, { _id: false });

// Device credentials for automation (encrypted in production)
const CredentialSchema = new mongoose.Schema({
  username: String,               // Device login username
  password: String,               // Device login password (should be encrypted)
  enable_password: String,        // Cisco enable password
  ssh_port: { type: Number, default: 22 },     // SSH port for CLI access
  netconf_port: { type: Number, default: 830 }, // NETCONF port
  snmp_community: { type: String, default: 'public' } // SNMP community string
}, { _id: false });

// Enhanced device schema for autonomous healing
const DeviceSchema = new mongoose.Schema({
  hostname: { type: String, required: true, unique: true }, // Device hostname
  mgmt_ip: { type: String, required: true },  // Management IP address
  vendor: String,                   // Device vendor (Cisco, Juniper, etc.)
  model: String,                    // Device model number
  os_version: String,               // Operating system version
  device_type: { type: String, enum: ['router', 'switch', 'firewall', 'server'], default: 'router' }, // Device category
  site: String,                     // Physical site location
  rack: String,                     // Rack location
  
  // Status and health monitoring
  status: { type: String, enum: ['UP', 'DOWN', 'UNREACHABLE'], default: 'UP' }, // Device operational status
  last_seen: Date,                  // Last successful communication timestamp
  cpu: Number,                      // Current CPU utilization percentage
  memory: Number,                   // Current memory utilization percentage
  temperature: Number,              // Device temperature in Celsius
  interfaces: [InterfaceSchema],    // Network interfaces array
  
  // Automation and healing configuration
  credentials: CredentialSchema,    // Device access credentials
  automation_enabled: { type: Boolean, default: false }, // Allow automated changes
  netconf_enabled: { type: Boolean, default: false },   // NETCONF support available
  ssh_enabled: { type: Boolean, default: true },        // SSH access available
  snmp_enabled: { type: Boolean, default: true },       // SNMP monitoring enabled
  
  // Topology and dependencies
  neighbors: [String],              // Connected device hostnames
  services: [String],               // Services running on this device
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }], // Dependent devices
  
  // Metadata and tracking
  tags: [String],                   // Custom tags for grouping
  maintenance_window: {             // Scheduled maintenance times
    start_time: String,
    end_time: String,
    days: [String]
  },
  backup_config: String,            // Last known good configuration backup
  config_version: String,           // Current configuration version/hash
  last_config_change: Date,         // Timestamp of last configuration change
  
  createdAt: { type: Date, default: Date.now },  // Device creation timestamp
  updatedAt: { type: Date, default: Date.now }   // Last update timestamp
});

// Update the updatedAt field on save
DeviceSchema.pre('save', function() {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('Device', DeviceSchema);
