/**
 * Development Environment Configuration Script
 * 
 * This script helps set up the development environment for the
 * Autonomous Network Healing Platform by creating sample data,
 * configuring default policies, and initializing topology.
 * 
 * Run this script after setting up the database to populate
 * the system with sample data for testing and development.
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Device = require('./src/models/Device');
const Alert = require('./src/models/Alert');
const Incident = require('./src/models/Incident');
const Policy = require('./src/models/Policy');
const Topology = require('./src/models/Topology');
const Action = require('./src/models/Action');

/**
 * Connect to MongoDB using environment variables
 */
async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable not set');
    }
    
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

/**
 * Create sample network devices for testing
 */
async function createSampleDevices() {
  console.log('📱 Creating sample devices...');
  
  const sampleDevices = [
    {
      hostname: 'Core-Router-01',
      device_type: 'router',
      mgmt_ip: '192.168.1.1',
      site: 'Data Center A - Rack 1',
      vendor: 'Cisco',
      model: 'ISR4000',
      status: 'UP',
      cpu: 25,
      memory: 45,
      last_seen: new Date(),
      automation_enabled: true,
      netconf_enabled: true,
      ssh_enabled: true,
      snmp_enabled: true,
      credentials: {
        username: 'admin',
        ssh_port: 22,
        netconf_port: 830,
        snmp_community: 'public'
      },
      interfaces: [
        {
          name: 'GigabitEthernet0/0',
          up: true,
          utilization: 45
        },
        {
          name: 'GigabitEthernet0/1',
          up: true,
          utilization: 30
        }
      ]
    },
    {
      hostname: 'Access-Switch-01',
      device_type: 'switch',
      mgmt_ip: '192.168.1.10',
      site: 'Office Floor 1',
      vendor: 'Cisco',
      model: 'Catalyst 2960',
      status: 'UP',
      cpu: 15,
      memory: 30,
      last_seen: new Date(),
      automation_enabled: true,
      ssh_enabled: true,
      snmp_enabled: true,
      credentials: {
        username: 'admin',
        ssh_port: 22,
        snmp_community: 'public'
      },
      interfaces: [
        {
          name: 'FastEthernet0/1',
          up: true,
          utilization: 20
        },
        {
          name: 'FastEthernet0/2',
          up: false,
          utilization: 0
        }
      ]
    },
    {
      hostname: 'Firewall-01',
      device_type: 'firewall',
      mgmt_ip: '192.168.1.254',
      site: 'Data Center A - DMZ',
      vendor: 'Fortinet',
      model: 'FortiGate 100E',
      status: 'UP',
      cpu: 35,
      memory: 55,
      last_seen: new Date(),
      automation_enabled: false, // Security device - manual approval required
      ssh_enabled: true,
      snmp_enabled: true,
      credentials: {
        username: 'admin',
        ssh_port: 22,
        snmp_community: 'private'
      },
      interfaces: [
        {
          name: 'port1',
          up: true,
          utilization: 60
        },
        {
          name: 'port2',
          up: true,
          utilization: 40
        }
      ]
    },
    {
      hostname: 'WiFi-AP-01',
      device_type: 'router', // Changed from access_point as it's not in enum
      mgmt_ip: '192.168.1.50',
      site: 'Office Floor 1 - Conference Room',
      vendor: 'Ubiquiti',
      model: 'UniFi AP AC Pro',
      status: 'UP',
      cpu: 10,
      memory: 25,
      last_seen: new Date(),
      automation_enabled: true,
      ssh_enabled: true,
      snmp_enabled: false,
      credentials: {
        username: 'ubnt',
        ssh_port: 22,
        snmp_community: 'public'
      },
      interfaces: [
        {
          name: 'eth0',
          up: true,
          utilization: 35
        }
      ]
    }
  ];

  // Clear existing devices
  await Device.deleteMany({});
  
  // Insert sample devices
  const createdDevices = await Device.insertMany(sampleDevices);
  console.log(`✅ Created ${createdDevices.length} sample devices`);
  
  return createdDevices;
}

/**
 * Create sample network topology
 */
async function createSampleTopology(devices) {
  console.log('🌐 Creating sample network topology...');
  
  // Clear existing topology
  await Topology.deleteMany({});
  
  // Generate unique topology ID with timestamp to avoid conflicts
  const timestamp = Date.now();
  const topologyId = `main-network-topology-${timestamp}`;
  
  // Create main network topology
  const mainTopology = new Topology({
    topology_id: topologyId,
    name: 'Main Network Infrastructure',
    version: '1.0',
    devices: devices.map(device => device._id), // Reference all devices by ObjectId
    links: [
      {
        source_device: devices[0].hostname, // Core Router
        source_interface: 'GigabitEthernet0/1',
        destination_device: devices[2].hostname, // Firewall
        destination_interface: 'port1',
        link_type: 'ethernet',
        bandwidth: '1Gbps',
        status: 'up',
        utilization: 45,
        last_status_change: new Date(),
        monitored: true
      },
      {
        source_device: devices[0].hostname, // Core Router
        source_interface: 'GigabitEthernet0/2',
        destination_device: devices[1].hostname, // Access Switch
        destination_interface: 'GigabitEthernet0/1',
        link_type: 'ethernet',
        bandwidth: '1Gbps',
        status: 'up',
        utilization: 30,
        last_status_change: new Date(),
        monitored: true
      },
      {
        source_device: devices[1].hostname, // Access Switch
        source_interface: 'FastEthernet0/1',
        destination_device: devices[3].hostname, // WiFi AP
        destination_interface: 'eth0',
        link_type: 'ethernet',
        bandwidth: '100Mbps',
        status: 'up',
        utilization: 60,
        last_status_change: new Date(),
        monitored: true
      }
    ],
    sites: [
      {
        site_id: `datacenter-a-${timestamp}`, // Make site_id unique with timestamp
        name: 'Data Center A',
        location: {
          address: '123 Tech Drive',
          city: 'Tech City',
          country: 'USA',
          latitude: 37.7749,
          longitude: -122.4194
        },
        contact_info: {
          primary_contact: 'Network Admin',
          email: 'netadmin@company.com',
          phone: '+1-555-0123',
          escalation_contact: 'Senior Network Admin'
        },
        business_hours: {
          timezone: 'America/Los_Angeles',
          weekdays: { start: '08:00', end: '18:00' },
          weekends: { start: '10:00', end: '16:00' }
        },
        devices: devices.map(d => d.hostname),
        criticality: 'critical'
      }
    ],
    services: [
      {
        service_name: 'Corporate Network',
        dependent_devices: [devices[0].hostname, devices[1].hostname],
        critical_devices: [devices[0].hostname],
        service_type: 'routing',
        business_impact: 'critical',
        sla_requirements: {
          availability: 99.99,
          max_downtime_minutes: 5,
          response_time_ms: 100
        }
      },
      {
        service_name: 'WiFi Access',
        dependent_devices: [devices[3].hostname, devices[1].hostname],
        critical_devices: [devices[3].hostname],
        service_type: 'application',
        business_impact: 'high',
        sla_requirements: {
          availability: 99.5,
          max_downtime_minutes: 30,
          response_time_ms: 500
        }
      }
    ],
    service_device_map: {
      'Corporate Network': [devices[0].hostname, devices[1].hostname],
      'WiFi Access': [devices[3].hostname, devices[1].hostname]
    },
    device_roles: {
      [devices[0].hostname]: 'core',
      [devices[1].hostname]: 'access',
      [devices[2].hostname]: 'security',
      [devices[3].hostname]: 'access'
    },
    network_segments: [
      {
        segment_id: 'management',
        name: 'Management Network',
        subnet: '192.168.1.0/24',
        vlan_id: 100,
        devices: devices.map(d => d.hostname),
        gateway: '192.168.1.1'
      },
      {
        segment_id: 'production',
        name: 'Production Network',
        subnet: '10.0.0.0/16',
        vlan_id: 200,
        devices: [devices[0].hostname, devices[1].hostname],
        gateway: '10.0.0.1'
      }
    ],
    redundancy_groups: [
      {
        group_name: 'Core Routing',
        primary_device: devices[0].hostname,
        backup_devices: [],
        failover_type: 'active_passive'
      }
    ],
    critical_paths: [
      {
        path_name: 'Internet Gateway Path',
        source: devices[2].hostname, // Firewall
        destination: devices[0].hostname, // Core Router
        path_devices: [devices[2].hostname, devices[0].hostname],
        backup_paths: [],
        business_impact: 'critical'
      }
    ],
    discovery_enabled: true,
    last_discovery: new Date(),
    discovery_method: 'snmp',
    auto_update: true,
    validation_status: 'valid',
    validation_errors: [],
    last_validation: new Date(),
    consistency_score: 0.95,
    change_history: [
      {
        timestamp: new Date(),
        change_type: 'device_added',
        changed_by: 'setup-script',
        description: 'Initial topology setup with sample devices',
        affected_components: devices.map(d => d.hostname)
      }
    ],
    layout_data: {},
    visualization_settings: {
      show_links: true,
      show_services: true,
      group_by_site: true,
      color_by_status: true
    },
    monitoring_coverage: 100,
    health_score: 0.9,
    performance_metrics: {
      total_devices: devices.length,
      devices_up: devices.length,
      total_links: 3,
      links_up: 3,
      average_utilization: 45
    },
    tags: ['production', 'main-site', 'corporate'],
    custom_fields: {
      deployment_environment: 'production',
      backup_frequency: 'daily'
    },
    documentation_url: 'https://docs.company.com/network-topology'
  });

  await mainTopology.save();
  
  console.log('✅ Created sample network topology');
  return mainTopology;
}

/**
 * Create sample automation policies
 */
async function createSamplePolicies() {
  console.log('📋 Creating sample automation policies...');
  
  // Clear existing policies
  await Policy.deleteMany({});
  
  const samplePolicies = [
    {
      policy_id: 'pol-high-cpu-restart',
      name: 'High CPU Usage Auto-Restart',
      description: 'Automatically restart services when CPU usage exceeds 90% for 5 minutes',
      category: 'remediation',
      scope: 'global',
      trigger_conditions: [
        {
          field: 'device.metrics.cpu_usage',
          operator: 'greater_than',
          value: 90,
          logical_operator: 'AND'
        },
        {
          field: 'device.status',
          operator: 'equals',
          value: 'active',
          logical_operator: 'AND'
        }
      ],
      actions: [
        {
          action_type: 'restart_service',
          parameters: {
            service_name: 'networking',
            wait_time: 30
          },
          risk_level: 'medium',
          requires_approval: false,
          delay_seconds: 0,
          max_attempts: 3
        }
      ],
      priority: 8,
      execution_limits: {
        max_per_hour: 3,
        max_per_day: 10
      },
      enabled: true
    },
    {
      policy_id: 'pol-interface-failover',
      name: 'Interface Down Auto-Failover',
      description: 'Automatically failover to backup interface when primary interface goes down',
      category: 'remediation',
      scope: 'global',
      trigger_conditions: [
        {
          field: 'alert.alert_type',
          operator: 'equals',
          value: 'interface_down',
          logical_operator: 'AND'
        },
        {
          field: 'device.criticality',
          operator: 'in',
          value: ['high', 'critical'],
          logical_operator: 'AND'
        }
      ],
      actions: [
        {
          action_type: 'interface_failover',
          parameters: {
            primary_interface: '{alert.source_interface}',
            backup_interface: '{device.backup_interface}'
          },
          risk_level: 'high',
          requires_approval: true,
          delay_seconds: 0,
          max_attempts: 1
        },
        {
          action_type: 'send_notification',
          parameters: {
            message: 'Automatic failover executed for device {device.hostname}',
            recipients: ['ops_team']
          },
          risk_level: 'low',
          requires_approval: false,
          delay_seconds: 5,
          max_attempts: 3
        }
      ],
      priority: 9,
      execution_limits: {
        max_per_hour: 1,
        max_per_day: 3
      },
      enabled: true
    },
    {
      policy_id: 'pol-memory-leak-detection',
      name: 'Memory Leak Detection',
      description: 'Detect and alert on potential memory leaks',
      category: 'notification',
      scope: 'global',
      trigger_conditions: [
        {
          field: 'device.metrics.memory_usage',
          operator: 'greater_than',
          value: 85,
          logical_operator: 'AND'
        },
        {
          field: 'device.metrics.memory_trend',
          operator: 'equals',
          value: 'increasing',
          logical_operator: 'AND'
        }
      ],
      actions: [
        {
          action_type: 'create_alert',
          parameters: {
            severity: 'warning',
            message: 'Potential memory leak detected on {device.hostname}',
            category: 'performance'
          },
          risk_level: 'low',
          requires_approval: false,
          delay_seconds: 0,
          max_attempts: 1
        },
        {
          action_type: 'collect_diagnostics',
          parameters: {
            collect_logs: true,
            memory_dump: false,
            duration: 300
          },
          risk_level: 'low',
          requires_approval: false,
          delay_seconds: 60,
          max_attempts: 1
        }
      ],
      priority: 6,
      execution_limits: {
        max_per_hour: 5,
        max_per_day: 20
      },
      enabled: true
    }
  ];

  const createdPolicies = await Policy.insertMany(samplePolicies);
  console.log(`✅ Created ${createdPolicies.length} sample automation policies`);
  
  return createdPolicies;
}

/**
 * Create sample alerts and incidents
 */
async function createSampleAlerts(devices) {
  console.log('🚨 Creating sample alerts...');
  
  // Clear existing alerts and incidents
  await Alert.deleteMany({});
  await Incident.deleteMany({});
  
  const sampleAlerts = [
    {
      alert_id: 'ALT-001-' + Date.now(),
      device: devices[0].hostname, // Use hostname, not ObjectId
      device_ip: devices[0].mgmt_ip,
      type: 'performance',
      category: 'performance',
      severity: 'warning',
      message: 'High CPU usage detected: 88%',
      raw_payload: {
        source: 'SNMP Monitor',
        oid: '1.3.6.1.4.1.9.2.1.58.0',
        value: 88
      },
      normalized_data: {
        metric: 'cpu_usage',
        value: 88,
        threshold: 80,
        duration: 180
      },
      status: 'open'
    },
    {
      alert_id: 'ALT-002-' + Date.now(),
      device: devices[1].hostname, // Use hostname, not ObjectId
      device_ip: devices[1].mgmt_ip,
      type: 'interface_down',
      category: 'network',
      severity: 'critical',
      message: 'Interface FastEthernet0/2 is down',
      raw_payload: {
        source: 'Network Monitor',
        interface: 'FastEthernet0/2',
        timestamp: new Date(Date.now() - 300000)
      },
      normalized_data: {
        interface: 'FastEthernet0/2',
        last_seen: new Date(Date.now() - 300000), // 5 minutes ago
        impact: 'Users on Floor 2 affected'
      },
      status: 'open'
    }
  ];

  const createdAlerts = await Alert.insertMany(sampleAlerts);
  console.log(`✅ Created ${createdAlerts.length} sample alerts`);
  
  // Create a sample incident
  const sampleIncident = new Incident({
    incident_id: 'INC-001-' + Date.now(),
    title: 'Network Performance Degradation - Core Router',
    description: 'Core router experiencing high CPU usage affecting network performance',
    severity: 'major',
    status: 'investigating',
    alert_ids: [createdAlerts[0]._id],
    affected_devices: [devices[0].hostname],
    rca_results: {
      suspected_cause: 'High CPU utilization due to routing table updates',
      confidence_score: 0.8,
      contributing_factors: ['BGP session flapping', 'Route table growth'],
      evidence: ['CPU spike correlates with BGP updates', 'Routing table size increased 15%'],
      analysis_method: 'rule_based'
    },
    timeline: [
      {
        timestamp: new Date(),
        event: 'Alert generated for high CPU usage',
        severity: 'warning',
        source: 'monitoring_system'
      },
      {
        timestamp: new Date(),
        event: 'Incident created from alert correlation',
        severity: 'info',
        source: 'correlation_engine'
      }
    ]
  });
  
  await sampleIncident.save();
  console.log('✅ Created sample incident');
}

/**
 * Main setup function
 */
async function setupDevelopmentEnvironment() {
  try {
    console.log('🚀 Setting up Autonomous Network Healing Platform Development Environment\n');
    
    // Connect to database
    await connectDatabase();
    
    // Create sample data
    const devices = await createSampleDevices();
    const topology = await createSampleTopology(devices);
    await createSamplePolicies();
    await createSampleAlerts(devices);
    
    console.log('\n🎉 Development environment setup completed successfully!');
    console.log('\nYou can now start the backend server with:');
    console.log('  npm run dev');
    console.log('\nAPI endpoints will be available at:');
    console.log('  http://localhost:5000/api/devices');
    console.log('  http://localhost:5000/api/alerts');
    console.log('  http://localhost:5000/api/incidents');
    console.log('  http://localhost:5000/api/policies');
    console.log('  http://localhost:5000/api/topology');
    console.log('  http://localhost:5000/api/actions');
    console.log('  http://localhost:5000/api/health');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDevelopmentEnvironment();
}

module.exports = {
  setupDevelopmentEnvironment,
  connectDatabase,
  createSampleDevices,
  createSampleTopology,
  createSamplePolicies,
  createSampleAlerts
};
