const axios = require('axios');
const Schedule = require('../models/Schedule');
const moment = require('moment'); // Import moment-timezone
const updateMachineStatusesToIdle = async () => {
  try {
    const schedules = await Schedule.find();

    if (schedules.length === 0) {
      console.log('No schedules found. Skipping machine status update.');
      return;
    }

    const now = moment.utc(); // Get current time

    // Go through each schedule
    for (const schedule of schedules) {
      const endTime = moment.utc(schedule.scheduledEnd); // Get the schedule end time
      const machineID = schedule.machineID;

      // If schedule has ended and machine is still not idle
      if (endTime < now && schedule.status !== 'Idle') {
        try {
          // Update the machine status to 'Idle'
          await axios.put(`https://kera-internship.onrender.com/schedule/edit/${machineID}`, {
            status: 'Idle',
          });
          console.log(`✅ Machine ${machineID} status updated to Idle`);
        } catch (err) {
          console.error(`❌ Failed to update status for machine ${machineID}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error('Error updating machine statuses:', error.message);
  }
};

const updateMachineStatusToActive = async (machineId) => {
    try {
      // Update the machine status to 'Active'
      const status = 'Active';  // You can adjust this based on logic
      await axios.put(`https://kera-internship.onrender.com/schedule/edit/${machineId}`, {
        status: status,
      });
      console.log(`🚀 Machine ${machineId} status updated to '${status}'`);
    } catch (error) {
      console.error(`❌ Error updating machine ${machineId} status:`, error.message);
    }
  };



module.exports = {  updateMachineStatusesToIdle,updateMachineStatusToActive};

