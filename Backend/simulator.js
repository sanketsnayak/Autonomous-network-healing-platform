// simulator.js
const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000/api/devices/status';

// Example devices
const devices = [
  {
    hostname: 'router-1',
    mgmt_ip: '192.168.1.1',
    vendor: 'Cisco',
    model: 'ISR4451',
    os_version: 'IOS-XE 17.3'
  },
  {
    hostname: 'switch-1',
    mgmt_ip: '192.168.1.2',
    vendor: 'Cisco',
    model: 'Catalyst 9300',
    os_version: 'IOS-XE 17.6'
  },
  {
    hostname: 'server-1',
    mgmt_ip: '192.168.1.10',
    vendor: 'Dell',
    model: 'PowerEdge R740',
    os_version: 'Ubuntu 22.04'
  }
];

// Random helper functions
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBoolean(probabilityTrue = 0.8) {
  return Math.random() < probabilityTrue;
}

function generateInterfaces(count = 2) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      name: `eth${i}`,
      up: randomBoolean(),
      in_octets: randomInt(1000, 100000),
      out_octets: randomInt(1000, 100000)
    });
  }
  return arr;
}

// Function to post status
async function postDeviceStatus(device) {
  const payload = {
    ...device,
    cpu: randomInt(5, 80),
    memory: randomInt(10, 90),
    interfaces: generateInterfaces(randomInt(2,4))
  };

  try {
    const res = await axios.post(BACKEND_URL, payload, {
  headers: {
    'Content-Type': 'application/json'
  }
});
    console.log(`Status posted for ${device.hostname}`);
  } catch (err) {
    console.error(`Error posting ${device.hostname}:`, err.message);
  }
}

// Run simulator periodically
function startSimulation(interval = 5000) {
  setInterval(() => {
    devices.forEach(d => postDeviceStatus(d));
  }, interval);
}

startSimulation();
