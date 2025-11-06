const Device = require('../models/Device');
const Alert = require('../models/Alert');

exports.upsertStatus = async (req, res) => {
  try {
    // Incoming payload expected:
    // { hostname, mgmt_ip, cpu, memory, interfaces: [{name, up, in_octets, out_octets}], ... }
    const { hostname, mgmt_ip, cpu, memory, interfaces, vendor, model, os_version } = req.body;
    if (!hostname) return res.status(400).json({ error: 'hostname required' });

    const update = {
      mgmt_ip,
      cpu,
      memory,
      interfaces,
      vendor,
      model,
      os_version,
      last_seen: new Date()
    };

    const device = await Device.findOneAndUpdate(
      { hostname },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // simple alert generation: create an alert if any interface down
    const downIf = (interfaces || []).find(i => i.up === false);
    if (downIf) {
      await Alert.create({
        device: hostname,
        type: 'interface_down',
        severity: 'major',
        payload: { interface: downIf.name }
      });
    }

    res.json({ ok: true, device });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
