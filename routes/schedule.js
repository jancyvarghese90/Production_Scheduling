// routes/schedule.js
const express = require('express');
const router = express.Router();
const   Schedule = require('../models/Schedule');
const {autoSchedule,getScheduleByOrder} = require('../controller/autoSchedulingRecOrderUpdate'); // Import the scheduling controller
// const Order = require('../models/Order');
// Route to automatically schedule orders based on priority, delivery date, and order quantity
router.post('/auto-schedule', async (req, res) => {
  try {
    const recommendations = await autoSchedule();
    res.status(200).json({ message: 'Auto-scheduling completed successfully', recommendations });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred during auto-scheduling', error: error.message });
  }
});

router.get("/schedule", async (req, res) => {
  try {
    var data = await Schedule.find();
    res.status(200).json(data);
  } catch (error) {
    res.send("unable to find data");
  }
});

// Route to get schedule for a specific order ID
router.get('/schedule/:orderId', async (req, res) => {
  const { orderId } = req.params;
  try {
    const schedules = await getScheduleByOrder(orderId);
    res.status(200).json({ schedules });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to retrieve schedule for the order', error: error.message });
  }
});

router.put('/edit/:id',async (req, res) => {
 try {
    const scheduleId = req.params.id;
    const updateData = req.body;

    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found.' });

    const order = await Order.findById(schedule.orderID);
    if (!order) return res.status(404).json({ message: 'Related order not found.' });

    if (order.isNonChangeable) {
      return res.status(403).json({
        message: `❌ Order ${order.orderNumber} is locked for editing.`,
      });
    }

    const updated = await Schedule.findByIdAndUpdate(scheduleId, updateData, { new: true });
    res.status(200).json(updated);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }

});
module.exports = router;
