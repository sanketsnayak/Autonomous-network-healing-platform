const Incident = require('./models/Incident');
const Alert = require('./models/Alert');
const Device = require('./models/Device');

// Mock function to simulate NETCONF/REST actions
async function applyRemediation(rootDevice) {
  console.log(`Applying remediation on ${rootDevice.hostname}...`);

  // Simulate network fix: mark all interfaces as up
  rootDevice.interfaces = rootDevice.interfaces.map(intf => ({ ...intf, up: true }));
  await rootDevice.save();

  console.log(`Remediation applied on ${rootDevice.hostname}`);
  return true; // success
}

// Verify if alerts are cleared
async function verifyFix(incident) {
  const alerts = await Alert.find({ _id: { $in: incident.alerts } });
  const unresolved = alerts.filter(a => a.status !== 'resolved');
  return unresolved.length === 0;
}

// Self-healing worker
async function selfHealingWorker() {
  try {
    // Step 1: Fetch open incidents
    const openIncidents = await Incident.find({ status: 'open' }).populate('alerts');

    for (const incident of openIncidents) {
      const rootDevice = await Device.findOne({ hostname: incident.root_cause_device });

      if (!rootDevice) {
        console.log(`Root device not found for incident ${incident._id}`);
        continue;
      }

      // Step 2: Apply remediation
      await applyRemediation(rootDevice);

      // Step 3: Mark all related alerts as resolved
      await Alert.updateMany(
        { _id: { $in: incident.alerts.map(a => a._id) } },
        { status: 'resolved' }
      );

      // Step 4: Verify fix
      const fixed = await verifyFix(incident);

      if (fixed) {
        incident.status = 'resolved';
        incident.resolved_at = new Date();
        await incident.save();
        console.log(`Incident ${incident._id} resolved!`);
      } else {
        console.log(`Incident ${incident._id} remediation failed, needs human attention.`);
      }
    }
  } catch (err) {
    console.error('Self-healing error:', err.message);
  }
}

// Run self-healing every 15 seconds
setInterval(selfHealingWorker, 15000);
