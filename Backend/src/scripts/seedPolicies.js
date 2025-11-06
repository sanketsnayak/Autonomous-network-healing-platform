require('dotenv').config();
const mongoose = require('mongoose');
const Policy = require('../models/Policy');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Sample remediation policies
const samplePolicies = [
  {
    policy_id: 'POL-20241201-0001',
    name: 'High CPU Utilization Remediation',
    description: 'Automatically restart services when CPU utilization exceeds 90%',
    category: 'remediation',
    scope: 'global',
    status: 'active',
    enabled: true,
    priority: 10,
    trigger_conditions: [
      {
        field: 'alert.type',
        operator: 'equals',
        value: 'high_cpu_utilization',
        logical_operator: 'AND'
      },
      {
        field: 'alert.severity',
        operator: 'in',
        value: ['critical', 'high'],
        logical_operator: 'AND'
      }
    ],
    actions: [
      {
        action_type: 'restart_service',
        parameters: {
          service_name: 'auto_detect',
          wait_time: 30
        },
        risk_level: 'medium',
        requires_approval: false,
        delay_seconds: 0,
        max_attempts: 3
      }
    ],
    auto_approve: true,
    created_by: 'system',
    approved_by: 'admin',
    approval_date: new Date(),
    effective_date: new Date(),
    tags: ['cpu', 'performance', 'auto-healing']
  },
  {
    policy_id: 'POL-20241201-0002',
    name: 'Interface Down Recovery',
    description: 'Automatically restart network interfaces when they go down',
    category: 'remediation',
    scope: 'global',
    status: 'active',
    enabled: true,
    priority: 5,
    trigger_conditions: [
      {
        field: 'alert.type',
        operator: 'equals',
        value: 'interface_down',
        logical_operator: 'AND'
      }
    ],
    actions: [
      {
        action_type: 'restart_interface',
        parameters: {
          interface_name: 'from_alert',
          pre_check: true
        },
        risk_level: 'low',
        requires_approval: false,
        delay_seconds: 10,
        max_attempts: 2
      }
    ],
    auto_approve: true,
    created_by: 'system',
    approved_by: 'admin',
    approval_date: new Date(),
    effective_date: new Date(),
    tags: ['interface', 'network', 'connectivity']
  },
  {
    policy_id: 'POL-20241201-0003',
    name: 'Memory Leak Recovery',
    description: 'Restart services showing memory leak patterns',
    category: 'remediation',
    scope: 'global',
    status: 'active',
    enabled: true,
    priority: 15,
    trigger_conditions: [
      {
        field: 'alert.type',
        operator: 'equals',
        value: 'memory_leak',
        logical_operator: 'OR'
      },
      {
        field: 'alert.type',
        operator: 'equals',
        value: 'high_memory_usage',
        logical_operator: 'AND'
      },
      {
        field: 'device.memory_trend',
        operator: 'equals',
        value: 'increasing',
        logical_operator: 'AND'
      }
    ],
    actions: [
      {
        action_type: 'restart_service',
        parameters: {
          service_name: 'from_alert',
          force_restart: true
        },
        risk_level: 'medium',
        requires_approval: true,
        delay_seconds: 60,
        max_attempts: 1
      }
    ],
    auto_approve: false,
    created_by: 'system',
    approved_by: 'admin',
    approval_date: new Date(),
    effective_date: new Date(),
    tags: ['memory', 'performance', 'manual-approval']
  },
  {
    policy_id: 'POL-20241201-0004',
    name: 'Disk Space Cleanup',
    description: 'Clean up temporary files when disk space is low',
    category: 'remediation',
    scope: 'global',
    status: 'active',
    enabled: true,
    priority: 20,
    trigger_conditions: [
      {
        field: 'alert.type',
        operator: 'equals',
        value: 'disk_space_low',
        logical_operator: 'AND'
      }
    ],
    actions: [
      {
        action_type: 'cleanup_disk',
        parameters: {
          cleanup_temp: true,
          cleanup_logs: true,
          max_log_age_days: 30
        },
        risk_level: 'low',
        requires_approval: false,
        delay_seconds: 0,
        max_attempts: 1
      }
    ],
    auto_approve: true,
    created_by: 'system',
    approved_by: 'admin',
    approval_date: new Date(),
    effective_date: new Date(),
    tags: ['disk', 'cleanup', 'maintenance']
  },
  {
    policy_id: 'POL-20241201-0005',
    name: 'Service Failure Recovery',
    description: 'Restart failed critical services',
    category: 'remediation',
    scope: 'global',
    status: 'active',
    enabled: true,
    priority: 1,
    trigger_conditions: [
      {
        field: 'alert.type',
        operator: 'equals',
        value: 'service_failure',
        logical_operator: 'AND'
      },
      {
        field: 'service.criticality',
        operator: 'equals',
        value: 'critical',
        logical_operator: 'AND'
      }
    ],
    actions: [
      {
        action_type: 'restart_service',
        parameters: {
          service_name: 'from_alert',
          wait_for_startup: true,
          verify_health: true
        },
        risk_level: 'high',
        requires_approval: false,
        delay_seconds: 5,
        max_attempts: 3
      }
    ],
    auto_approve: true,
    created_by: 'system',
    approved_by: 'admin',
    approval_date: new Date(),
    effective_date: new Date(),
    tags: ['service', 'critical', 'auto-restart']
  }
];

// Seed policies
const seedPolicies = async () => {
  try {
    console.log('🌱 Starting policy seeding...');
    
    // Clear existing policies (optional - comment out if you want to keep existing ones)
    // await Policy.deleteMany({});
    // console.log('🗑️  Cleared existing policies');
    
    // Insert sample policies
    for (const policyData of samplePolicies) {
      try {
        // Check if policy already exists
        const existingPolicy = await Policy.findOne({ policy_id: policyData.policy_id });
        if (existingPolicy) {
          console.log(`⏭️  Policy ${policyData.policy_id} already exists, skipping...`);
          continue;
        }
        
        const policy = new Policy(policyData);
        await policy.save();
        console.log(`✅ Created policy: ${policy.name} (${policy.policy_id})`);
      } catch (error) {
        console.error(`❌ Failed to create policy ${policyData.policy_id}:`, error.message);
      }
    }
    
    // Verify policies were created
    const totalPolicies = await Policy.countDocuments();
    const activePolicies = await Policy.countDocuments({ status: 'active', enabled: true });
    
    console.log(`\n📊 Policy seeding complete:`);
    console.log(`   Total policies: ${totalPolicies}`);
    console.log(`   Active policies: ${activePolicies}`);
    
    return true;
  } catch (error) {
    console.error('❌ Policy seeding failed:', error);
    return false;
  }
};

// Main function
const main = async () => {
  await connectDB();
  const success = await seedPolicies();
  await mongoose.disconnect();
  console.log('👋 Disconnected from MongoDB');
  process.exit(success ? 0 : 1);
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { seedPolicies, samplePolicies };
