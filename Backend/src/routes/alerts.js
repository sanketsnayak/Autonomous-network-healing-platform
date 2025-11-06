const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');

// GET /api/alerts
router.get('/', async (req, res) => {
  const alerts = await Alert.find().sort({ createdAt: -1 }).limit(200);
  res.json(alerts);
});

// PATCH /api/alerts/:id to ack / resolve
router.patch('/:id', async (req, res) => {
  const { action } = req.body; // action: 'ack' or 'resolve'
  const alert = await Alert.findById(req.params.id);
  if (!alert) return res.status(404).json({ error: 'not found' });
  if (action === 'ack') alert.status = 'ack';
  if (action === 'resolve') { alert.status = 'resolved'; alert.resolvedAt = new Date(); }
  await alert.save();
  res.json(alert);
});

module.exports = router;
