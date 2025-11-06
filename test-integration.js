#!/usr/bin/env node

/**
 * Integration Test Script for Autonomous Network Healing Platform
 * Tests the communication between frontend and backend services
 */

const axios = require('axios');
const chalk = require('chalk');

const API_BASE_URL = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:5173';

// Test configuration
const tests = [
  {
    name: 'Backend Health Check',
    url: `${API_BASE_URL}/health`,
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Get Devices',
    url: `${API_BASE_URL}/devices`,
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Get Alerts',
    url: `${API_BASE_URL}/alerts`,
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Get Incidents',
    url: `${API_BASE_URL}/incidents`,
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Get Topology',
    url: `${API_BASE_URL}/topology`,
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Get Policies',
    url: `${API_BASE_URL}/policies`,
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Get Actions',
    url: `${API_BASE_URL}/actions`,
    method: 'GET',
    expectedStatus: 200
  },
  {
    name: 'Get Metrics',
    url: `${API_BASE_URL}/metrics`,
    method: 'GET',
    expectedStatus: 200
  }
];

async function runTest(test) {
  try {
    console.log(`  Testing: ${test.name}...`);
    
    const response = await axios({
      method: test.method,
      url: test.url,
      timeout: 5000
    });
    
    if (response.status === test.expectedStatus) {
      console.log(chalk.green(`  ✓ ${test.name} - PASSED`));
      return { name: test.name, status: 'PASSED', response: response.data };
    } else {
      console.log(chalk.red(`  ✗ ${test.name} - FAILED (Status: ${response.status})`));
      return { name: test.name, status: 'FAILED', error: `Unexpected status: ${response.status}` };
    }
  } catch (error) {
    console.log(chalk.red(`  ✗ ${test.name} - FAILED`));
    console.log(chalk.red(`    Error: ${error.message}`));
    return { name: test.name, status: 'FAILED', error: error.message };
  }
}

async function checkFrontend() {
  try {
    console.log('  Testing: Frontend Accessibility...');
    const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
    
    if (response.status === 200) {
      console.log(chalk.green('  ✓ Frontend - ACCESSIBLE'));
      return { name: 'Frontend', status: 'ACCESSIBLE' };
    } else {
      console.log(chalk.red(`  ✗ Frontend - NOT ACCESSIBLE (Status: ${response.status})`));
      return { name: 'Frontend', status: 'NOT ACCESSIBLE', error: `Status: ${response.status}` };
    }
  } catch (error) {
    console.log(chalk.red('  ✗ Frontend - NOT ACCESSIBLE'));
    console.log(chalk.red(`    Error: ${error.message}`));
    return { name: 'Frontend', status: 'NOT ACCESSIBLE', error: error.message };
  }
}

async function runAllTests() {
  console.log(chalk.blue('🚀 Starting Autonomous Network Healing Platform Integration Tests\n'));
  
  const results = [];
  
  // Test frontend
  console.log(chalk.yellow('Frontend Tests:'));
  const frontendResult = await checkFrontend();
  results.push(frontendResult);
  
  console.log('');
  
  // Test backend APIs
  console.log(chalk.yellow('Backend API Tests:'));
  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary
  console.log('\n' + chalk.blue('📊 Test Results Summary:'));
  console.log('================================');
  
  const passed = results.filter(r => r.status === 'PASSED' || r.status === 'ACCESSIBLE').length;
  const failed = results.filter(r => r.status === 'FAILED' || r.status === 'NOT ACCESSIBLE').length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(chalk.green(`Passed: ${passed}`));
  console.log(chalk.red(`Failed: ${failed}`));
  
  if (failed === 0) {
    console.log('\n' + chalk.green('🎉 All tests passed! The platform is working correctly.'));
    console.log('\n' + chalk.blue('Next steps:'));
    console.log('• Access the frontend at: http://localhost:5173');
    console.log('• View API docs at: http://localhost:5000/api/health');
    console.log('• Monitor the backend logs for real-time activity');
  } else {
    console.log('\n' + chalk.red('❌ Some tests failed. Please check the following:'));
    console.log('• Ensure both backend and frontend servers are running');
    console.log('• Check MongoDB connection in Backend/.env');
    console.log('• Verify sample data was created with: npm run setup');
    console.log('• Check server logs for error details');
    
    console.log('\n' + chalk.yellow('Failed tests:'));
    results.filter(r => r.status === 'FAILED' || r.status === 'NOT ACCESSIBLE').forEach(test => {
      console.log(`  - ${test.name}: ${test.error}`);
    });
  }
  
  console.log('\n');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
runAllTests().catch(error => {
  console.error(chalk.red('Test runner failed:'), error);
  process.exit(1);
});
