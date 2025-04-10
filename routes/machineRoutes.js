const express = require('express');
const router = express.Router();
const Machine = require('../models/Machine');
const Schedule = require('../models/Schedule');

router.get('/status', async (req, res) => {
  try {
    const machines = await Machine.find();

    const statusPromises = machines.map(async (machine) => {
      // Find if the machine is currently in use
      const currentSchedule = await Schedule.findOne({
        machineID: machine._id,
        status: 'Scheduled',
        scheduledStart: { $lte: new Date() },
        scheduledEnd: { $gte: new Date() }
      });

      return {
        machineName: machine.machineName,
        operation: machine.operation,
        isAvailable: machine.isAvailable,
        status: currentSchedule ? 'Running' : 'Idle',
        currentOrder: currentSchedule?.orderID || null,
        scheduledEnd: currentSchedule?.scheduledEnd || null,
      };
    });

    const machineStatuses = await Promise.all(statusPromises);
    res.status(200).json(machineStatuses);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching machine status', error: err });
  }
});
module.exports = router;