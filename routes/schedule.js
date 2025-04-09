// routes/schedule.js
const express = require('express');
const router = express.Router();
const schedulingController = require('../controller/schedulingController');

// Route to automatically schedule orders based on priority, delivery date, and order quantity
router.post('/auto-schedule', async (req, res) => {
  try {
    const recommendations = await schedulingController.autoSchedule();
    res.status(200).json({ message: 'Auto-scheduling completed successfully', recommendations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred during auto-scheduling', error: error.message });
  }
});

// Route to get schedule for a specific order ID
router.get('/schedule/:orderId', async (req, res) => {
  const { orderId } = req.params;
  try {
    const schedules = await schedulingController.getScheduleByOrder(orderId);
    res.status(200).json({ schedules });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to retrieve schedule for the order', error: error.message });
  }
});

module.exports = router;
