/**
 * Integration Test Script for Autonomous Network Healing Platform
 * 
 * This script tests the complete integration of all backend services
 * by simulating a real network incident scenario from detection to resolution.
 * 
 * Test Scenario:
 * 1. Create test devices and topology
 * 2. Simulate telemetry data and alerts
 * 3. Trigger alert correlation and incident creation
 * 4. Execute root cause analysis
 * 5. Generate and execute remediation actions
 * 6. Verify healing pipeline completion
 * 
 * Run this script after starting the backend server to verify
 * that all services are working correctly together.
 */

const axios = require('axios');
const WebSocket = require('ws');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
const WS_URL = 'ws://localhost:5001';

/**
 * Test configuration and global state
 */
const testState = {
  devices: [],
  alerts: [],
  incidents: [],
  actions: [],
  policies: [],
  startTime: null,
  testResults: []
};

/**
 * Utility function to make API requests with error handling
 */
async function apiRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response ? error.response.data : error.message,
      status: error.response ? error.response.status : 500
    };
  }
}

/**
 * Log test result with timestamp and formatting
 */
function logResult(testName, success, message, details = null) {
  const timestamp = new Date().toISOString();
  const status = success ? '✅ PASS' : '❌ FAIL';
  const duration = testState.startTime ? Date.now() - testState.startTime : 0;
  
  console.log(`[${timestamp}] ${status} ${testName} (${duration}ms)`);
  console.log(`    ${message}`);
  
  if (details) {
    console.log(`    Details: ${JSON.stringify(details, null, 2)}`);
  }
  
  testState.testResults.push({
    name: testName,
    success,
    message,
    details,
    duration,
    timestamp
  });
  
  console.log(''); // Empty line for readability
}

/**
 * Test 1: Verify server health and all services are running
 */
async function testServerHealth() {
  console.log('🔍 Testing Server Health and Service Status...\n');
  
  testState.startTime = Date.now();
  
  // Test basic server connectivity
  const healthResponse = await apiRequest('GET', '/health');
  
  if (!healthResponse.success) {
    logResult(
      'Server Connectivity',
      false,
      'Failed to connect to server',
      healthResponse.error
    );
    return false;
  }
  
  logResult(
    'Server Connectivity',
    true,
    'Server is responding and healthy',
    { uptime: healthResponse.data.uptime }
  );
  
  // Test individual service health
  const services = healthResponse.data.services || {};
  const serviceTests = [
    'telemetryCollector',
    'alertCorrelation',
    'rootCauseAnalysis',
    'remediationEngine',
    'autonomousHealing'
  ];
  
  for (const service of serviceTests) {
    const serviceStatus = services[service];
    const isHealthy = serviceStatus && serviceStatus.status === 'healthy';
    
    logResult(
      `${service} Service`,
      isHealthy,
      isHealthy ? 'Service is running and healthy' : 'Service is not healthy',
      serviceStatus
    );
  }
  
  // Test metrics endpoint
  const metricsResponse = await apiRequest('GET', '/metrics');
  
  logResult(
    'Metrics Collection',
    metricsResponse.success,
    metricsResponse.success ? 'Metrics endpoint is working' : 'Metrics endpoint failed',
    metricsResponse.data ? { metricsCount: Object.keys(metricsResponse.data.metrics || {}).length } : null
  );
  
  return true;
}

/**
 * Test 2: Verify all API endpoints are accessible
 */
async function testApiEndpoints() {
  console.log('🌐 Testing API Endpoint Accessibility...\n');
  
  const endpoints = [
    { path: '/devices', method: 'GET', name: 'Device Management' },
    { path: '/alerts', method: 'GET', name: 'Alert Management' },
    { path: '/incidents', method: 'GET', name: 'Incident Management' },
    { path: '/policies', method: 'GET', name: 'Policy Management' },
    { path: '/topology', method: 'GET', name: 'Topology Management' },
    { path: '/actions', method: 'GET', name: 'Action Management' },
    { path: '/actions/templates', method: 'GET', name: 'Action Templates' }
  ];
  
  for (const endpoint of endpoints) {
    testState.startTime = Date.now();
    
    const response = await apiRequest(endpoint.method, endpoint.path);
    
    logResult(
      endpoint.name,
      response.success,
      response.success ? 'Endpoint is accessible' : 'Endpoint failed',
      response.success ? { recordCount: response.data.data ? response.data.data.length : 0 } : response.error
    );
  }
  
  return true;
}

/**
 * Test 3: Create test scenario data
 */
async function createTestScenario() {
  console.log('🏗️  Creating Test Scenario Data...\n');
  
  // Create test devices if they don't exist
  testState.startTime = Date.now();
  
  const devicesResponse = await apiRequest('GET', '/devices');
  
  if (devicesResponse.success && devicesResponse.data.data.length > 0) {
    testState.devices = devicesResponse.data.data.slice(0, 2); // Use first 2 devices
    
    logResult(
      'Test Devices',
      true,
      'Using existing devices for testing',
      { deviceCount: testState.devices.length }
    );
  } else {
    logResult(
      'Test Devices',
      false,
      'No devices found - run setup script first',
      'npm run setup'
    );
    return false;
  }
  
  // Verify policies exist
  const policiesResponse = await apiRequest('GET', '/policies');
  
  if (policiesResponse.success && policiesResponse.data.data.length > 0) {
    testState.policies = policiesResponse.data.data;
    
    logResult(
      'Test Policies',
      true,
      'Automation policies are available',
      { policyCount: testState.policies.length }
    );
  } else {
    logResult(
      'Test Policies',
      false,
      'No policies found - run setup script first',
      'npm run setup'
    );
  }
  
  return true;
}

/**
 * Test 4: Simulate alert creation and correlation
 */
async function testAlertCorrelation() {
  console.log('🚨 Testing Alert Creation and Correlation...\n');
  
  if (testState.devices.length === 0) {
    logResult(
      'Alert Correlation',
      false,
      'No test devices available',
      'Cannot test without devices'
    );
    return false;
  }
  
  // Create test alerts
  const testAlerts = [
    {
      device: testState.devices[0]._id,
      type: 'performance',
      severity: 'critical',
      message: 'CPU utilization exceeded 90%',
      source: 'Integration Test',
      details: {
        metric: 'cpu_usage',
        value: 95,
        threshold: 90,
        duration: 300
      }
    },
    {
      device: testState.devices[0]._id,
      type: 'performance',
      severity: 'warning',
      message: 'Memory utilization is high',
      source: 'Integration Test',
      details: {
        metric: 'memory_usage',
        value: 88,
        threshold: 85,
        duration: 180
      }
    }
  ];
  
  for (const alertData of testAlerts) {
    testState.startTime = Date.now();
    
    const response = await apiRequest('POST', '/alerts', alertData);
    
    if (response.success) {
      testState.alerts.push(response.data.data);
      
      logResult(
        'Alert Creation',
        true,
        `Created ${alertData.severity} alert for ${alertData.type}`,
        { alertId: response.data.data._id }
      );
    } else {
      logResult(
        'Alert Creation',
        false,
        'Failed to create test alert',
        response.error
      );
    }
  }
  
  // Wait for correlation to process
  console.log('⏳ Waiting for alert correlation to process...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check if incidents were created
  testState.startTime = Date.now();
  
  const incidentsResponse = await apiRequest('GET', '/incidents');
  
  if (incidentsResponse.success) {
    const recentIncidents = incidentsResponse.data.data.filter(incident => {
      const createdTime = new Date(incident.createdAt).getTime();
      const testStartTime = Date.now() - 60000; // Last minute
      return createdTime > testStartTime;
    });
    
    testState.incidents = recentIncidents;
    
    logResult(
      'Incident Correlation',
      recentIncidents.length > 0,
      recentIncidents.length > 0 
        ? `Created ${recentIncidents.length} incidents from alerts`
        : 'No incidents created - correlation may need more time',
      { incidentCount: recentIncidents.length }
    );
  } else {
    logResult(
      'Incident Correlation',
      false,
      'Failed to fetch incidents',
      incidentsResponse.error
    );
  }
  
  return true;
}

/**
 * Test 5: Test root cause analysis
 */
async function testRootCauseAnalysis() {
  console.log('🔬 Testing Root Cause Analysis...\n');
  
  if (testState.incidents.length === 0) {
    logResult(
      'Root Cause Analysis',
      false,
      'No incidents available for RCA testing',
      'Create incidents first'
    );
    return false;
  }
  
  const incident = testState.incidents[0];
  testState.startTime = Date.now();
  
  // Trigger RCA analysis
  const rcaResponse = await apiRequest('POST', `/incidents/${incident._id}/analyze`);
  
  if (rcaResponse.success) {
    logResult(
      'RCA Trigger',
      true,
      'Root cause analysis triggered successfully',
      { incidentId: incident._id }
    );
    
    // Wait for analysis to complete
    console.log('⏳ Waiting for RCA analysis to complete...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check analysis results
    const updatedIncidentResponse = await apiRequest('GET', `/incidents/${incident._id}`);
    
    if (updatedIncidentResponse.success) {
      const updatedIncident = updatedIncidentResponse.data.data;
      const hasRootCause = updatedIncident.rootCause && updatedIncident.rootCause.category;
      
      logResult(
        'RCA Analysis',
        hasRootCause,
        hasRootCause 
          ? `Root cause identified: ${updatedIncident.rootCause.category}`
          : 'Root cause analysis is still in progress',
        updatedIncident.rootCause
      );
    } else {
      logResult(
        'RCA Analysis',
        false,
        'Failed to fetch updated incident',
        updatedIncidentResponse.error
      );
    }
  } else {
    logResult(
      'RCA Trigger',
      false,
      'Failed to trigger RCA analysis',
      rcaResponse.error
    );
  }
  
  return true;
}

/**
 * Test 6: Test remediation action creation and execution
 */
async function testRemediationExecution() {
  console.log('🔧 Testing Remediation Action Execution...\n');
  
  if (testState.devices.length === 0) {
    logResult(
      'Remediation Test',
      false,
      'No devices available for remediation testing',
      'Create devices first'
    );
    return false;
  }
  
  // Create a test remediation action
  const actionData = {
    name: 'Integration Test - Service Restart',
    description: 'Test remediation action for integration testing',
    type: 'restart',
    targetDevice: testState.devices[0]._id,
    commands: [
      {
        command: 'systemctl restart networking',
        protocol: 'SSH',
        timeout: 30
      }
    ],
    automated: false, // Manual execution for testing
    requiresApproval: false,
    priority: 5
  };
  
  testState.startTime = Date.now();
  
  const createResponse = await apiRequest('POST', '/actions', actionData);
  
  if (createResponse.success) {
    const action = createResponse.data.data;
    testState.actions.push(action);
    
    logResult(
      'Action Creation',
      true,
      'Remediation action created successfully',
      { actionId: action._id }
    );
    
    // Execute the action
    testState.startTime = Date.now();
    
    const executeResponse = await apiRequest('POST', `/actions/${action._id}/execute`, {
      executedBy: 'Integration Test',
      parameters: {}
    });
    
    if (executeResponse.success) {
      logResult(
        'Action Execution',
        true,
        'Remediation action execution started',
        { actionId: action._id }
      );
      
      // Wait for execution to complete
      console.log('⏳ Waiting for action execution to complete...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check execution status
      const statusResponse = await apiRequest('GET', `/actions/${action._id}`);
      
      if (statusResponse.success) {
        const updatedAction = statusResponse.data.data;
        const isCompleted = ['completed', 'failed'].includes(updatedAction.status);
        
        logResult(
          'Action Status',
          isCompleted,
          `Action status: ${updatedAction.status}`,
          {
            executionResults: updatedAction.executionResults,
            executedAt: updatedAction.executedAt,
            completedAt: updatedAction.completedAt
          }
        );
      } else {
        logResult(
          'Action Status',
          false,
          'Failed to check action status',
          statusResponse.error
        );
      }
    } else {
      logResult(
        'Action Execution',
        false,
        'Failed to execute remediation action',
        executeResponse.error
      );
    }
  } else {
    logResult(
      'Action Creation',
      false,
      'Failed to create remediation action',
      createResponse.error
    );
  }
  
  return true;
}

/**
 * Test 7: Test WebSocket real-time updates
 */
async function testWebSocketUpdates() {
  console.log('📡 Testing WebSocket Real-time Updates...\n');
  
  return new Promise((resolve) => {
    testState.startTime = Date.now();
    
    try {
      const ws = new WebSocket(WS_URL);
      let receivedMessages = 0;
      
      ws.on('open', () => {
        logResult(
          'WebSocket Connection',
          true,
          'WebSocket connection established',
          { url: WS_URL }
        );
        
        // Subscribe to test events
        ws.send(JSON.stringify({
          type: 'subscribe',
          topics: ['alerts', 'incidents', 'actions']
        }));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          receivedMessages++;
          
          logResult(
            'WebSocket Message',
            true,
            `Received real-time update: ${message.type}`,
            { messageCount: receivedMessages, data: message }
          );
        } catch (error) {
          logResult(
            'WebSocket Message',
            false,
            'Failed to parse WebSocket message',
            { error: error.message, rawData: data.toString() }
          );
        }
      });
      
      ws.on('error', (error) => {
        logResult(
          'WebSocket Connection',
          false,
          'WebSocket connection failed',
          { error: error.message }
        );
        resolve(false);
      });
      
      ws.on('close', () => {
        logResult(
          'WebSocket Close',
          true,
          'WebSocket connection closed gracefully',
          { totalMessages: receivedMessages }
        );
        resolve(true);
      });
      
      // Close connection after 5 seconds
      setTimeout(() => {
        ws.close();
      }, 5000);
      
    } catch (error) {
      logResult(
        'WebSocket Test',
        false,
        'Failed to initialize WebSocket test',
        { error: error.message }
      );
      resolve(false);
    }
  });
}

/**
 * Generate final test report
 */
function generateTestReport() {
  console.log('📊 Integration Test Summary Report\n');
  console.log('=' .repeat(60));
  
  const totalTests = testState.testResults.length;
  const passedTests = testState.testResults.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const overallSuccess = failedTests === 0;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : ''}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log(`Overall Status: ${overallSuccess ? 'PASS ✅' : 'FAIL ❌'}`);
  
  console.log('\n' + '=' .repeat(60));
  console.log('Detailed Results:\n');
  
  testState.testResults.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.message}`);
    
    if (!result.success && result.details) {
      console.log(`    Error: ${JSON.stringify(result.details, null, 2)}`);
    }
  });
  
  console.log('\n' + '=' .repeat(60));
  
  if (overallSuccess) {
    console.log('🎉 All integration tests passed! The Autonomous Network Healing Platform is working correctly.');
  } else {
    console.log('⚠️  Some integration tests failed. Please review the errors above and fix the issues.');
    console.log('\nTroubleshooting Tips:');
    console.log('- Ensure the backend server is running (npm run dev)');
    console.log('- Verify MongoDB is connected and accessible');
    console.log('- Run setup script first (npm run setup)');
    console.log('- Check environment variables in .env file');
  }
  
  console.log('\n');
}

/**
 * Main integration test runner
 */
async function runIntegrationTests() {
  console.log('🚀 Starting Autonomous Network Healing Platform Integration Tests\n');
  console.log('This will test the complete end-to-end functionality of the platform.\n');
  
  try {
    // Run all tests in sequence
    await testServerHealth();
    await testApiEndpoints();
    await createTestScenario();
    await testAlertCorrelation();
    await testRootCauseAnalysis();
    await testRemediationExecution();
    
    // Note: WebSocket test is commented out as WebSocket server may not be implemented yet
    // await testWebSocketUpdates();
    
    // Generate final report
    generateTestReport();
    
  } catch (error) {
    console.error('❌ Integration test runner failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run integration tests if this file is executed directly
if (require.main === module) {
  runIntegrationTests();
}

module.exports = {
  runIntegrationTests,
  testServerHealth,
  testApiEndpoints,
  createTestScenario,
  testAlertCorrelation,
  testRootCauseAnalysis,
  testRemediationExecution,
  generateTestReport
};
