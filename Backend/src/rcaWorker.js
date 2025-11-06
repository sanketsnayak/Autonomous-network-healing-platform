const Alert = require('./models/Alert');
const Incident = require('./models/Incident');
const Device = require('./models/Device');

async function performRCA() {
  try {
    // Step 1: Fetch all open alerts
    const openAlerts = await Alert.find({ status: 'open' });

    if (openAlerts.length === 0) return;

    // Step 2: Group alerts by device
    const alertMap = {};
    openAlerts.forEach(alert => {
      if (!alertMap[alert.device]) alertMap[alert.device] = [];
      alertMap[alert.device].push(alert);
    });

    // Step 3: Simple RCA logic:
    // If multiple access devices show interface down, assign root cause to core switch
    const devices = Object.keys(alertMap);
    let rootCauseDevice = devices[0]; // fallback

    // For demonstration, pick the device with most alerts as root cause
    let maxAlerts = 0;
    for (const device of devices) {
      if (alertMap[device].length > maxAlerts) {
        maxAlerts = alertMap[device].length;
        rootCauseDevice = device;
      }
    }

    // Step 4: Create an Incident
    const incident = await Incident.create({
      root_cause_device: rootCauseDevice,
      affected_devices: devices,
      alerts: openAlerts.map(a => a._id)
    });

    // Step 5: Update alerts as "in incident"
    await Alert.updateMany({ _id: { $in: openAlerts.map(a => a._id) } }, { status: 'in_incident' });

    console.log(`Incident created for root cause device: ${rootCauseDevice}`);

  } catch (err) {
    console.error('RCA error:', err.message);
  }
}

// Run RCA every 10 seconds
setInterval(performRCA, 10000);
