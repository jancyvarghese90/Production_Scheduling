// cronJob.js
const axios = require('axios');
const cron = require('node-cron');
const moment = require('moment');
const Schedule = require('../models/Schedule'); // Import your Schedule model
// Define the API endpoint
const ORDER_API_URL = 'https://kera-internship.onrender.com/order';  // Replace with your actual API endpoint

// Function to update order statuses
async function updateOrderStatuses() {
  try {
    const now = moment.utc(); // Get the current UTC time

    // Fetch all orders from the API
    const response = await axios.get(ORDER_API_URL);
    const orders = response.data;

    for (const order of orders) {
        const schedules = await Schedule.find({ orderID: order._id }).sort({ scheduledStart: 1 });
        if (!schedules.length) continue;

        const firstStageStart = moment.utc(schedules[0].scheduledStart);
        const lastStageEnd = moment.utc(schedules[schedules.length - 1].scheduledEnd);
        const deliveryDate = moment.utc(order.deliveryDate);

      let updatedStatus = order.status;

      // Update order status
      if (firstStageStart.isBefore(now) && lastStageEnd.isAfter(now)) {
        updatedStatus = "In Progress";
      } else if (lastStageEnd.isBefore(now)) {
        updatedStatus = now.isAfter(deliveryDate) ? "Delivered" : "Completed";
      }

      // If status needs to be updated, send a PUT request to update it
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
