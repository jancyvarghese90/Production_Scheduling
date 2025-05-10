// cronJob.js
const axios = require('axios');
const cron = require('node-cron');
const moment = require('moment');
const Schedule = require('../models/Schedule'); // Import your Schedule model
// // Define the API endpoint
const ORDER_API_URL = 'https://kera-internship.onrender.com/order';  // Replace with your actual API endpoint

async function updateOrderStatuses() {
  try {
    const now = moment.utc();
    const response = await axios.get(ORDER_API_URL);
    const orders = response.data;

    for (const order of orders) {
      const schedules = await Schedule.find({ orderID: order._id }).sort({ scheduledStart: 1 });
      if (!schedules.length) continue;

      const firstStageStart = moment.utc(schedules[0].scheduledStart);
      const lastStageEnd = moment.utc(schedules[schedules.length - 1].scheduledEnd);
      const deliveryDate = moment.utc(order.deliveryDate);

      let updatedStatus = order.status;

      // Handle valid transitions only
      if (order.status === "Scheduled") {
        if (firstStageStart.isBefore(now) && lastStageEnd.isAfter(now)) {
          updatedStatus = "In Progress";
        }
      } else if (order.status === "In Progress") {
        if (lastStageEnd.isBefore(now) && !now.isAfter(deliveryDate)) {
          updatedStatus = "Completed";
        }
      } else if (order.status === "Completed") {
        if (now.isAfter(deliveryDate)) {
          updatedStatus = "Delivered";
        }
      }

      // Only update if the status is changing
      if (updatedStatus !== order.status) {
        await axios.put(`${ORDER_API_URL}/edit/${order._id}`, { status: updatedStatus });
        console.log(`Order ${order._id} status updated to ${updatedStatus}`);
      }
    }
  } catch (error) {
    console.error('Error fetching or updating order statuses:', error);
  }
}


 // Function to schedule the cron job
function scheduleOrderStatusUpdate() {
    try{
console.log('Scheduling order status update...');
                            cron.schedule('0 * * * *', async () => {
                                console.log('Running order status update cron job every hour...');
                                await updateOrderStatuses();
                                console.log('Order statuses updated successfully!');
                            }
    
                        );}
catch (error) {
        console.error('Error scheduling order status update:', error);
    }
  }
module.exports = { scheduleOrderStatusUpdate };
