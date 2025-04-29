const moment = require('moment');
const BOM = require('../models/BOM.js');
const axios = require('axios');
const Schedule = require('../models/Schedule');
const express = require('express');
const {updateMachineStatusesToIdle,updateMachineStatusToActive} = require('./machineStausUpdate.js');

// Fetch data from third-party APIs
const fetchOrders = async () => {
  const response = await axios.get('https://kera-internship.onrender.com/order');
  return response.data;

 // Debugging line to check fetched orders
};


const fetchMachines = async () => {
  const response = await axios.get('https://kera-internship.onrender.com/schedule');
  return response.data; // Fetching machine data from the API
};

// Helper function to create recommendation entries
const createRecommendation = (type, reason) => ({
  type,
  reason,
  suggestedBy: 'System',
  createdAt: new Date(),
});


// Auto-schedule production orders
const autoSchedule = async () => {
  await updateMachineStatusesToIdle();
    const orders = await fetchOrders();
      
    const machines = await fetchMachines();
    const recommendations = [];
  
    const sortedOrders = orders
      .filter(order => order.status === 'Pending')
      .sort((a, b) => a.priority - b.priority || new Date(a.deliveryDate) - new Date(b.deliveryDate));
  
    for (let order of sortedOrders) {
      console.log('Processing order:', order.item, order.orderId);
      const existingSchedule = await Schedule.findOne({ orderID: order._id, status: 'Scheduled' });
      if (order.isNonChangeable && existingSchedule) {
        recommendations.push(createRecommendation(
          'Manual Approval',
          `Order ${order.orderId} is non-changeable and already scheduled.`
        ));
        continue;
      }
      await scheduleOrder(order, recommendations, machines);
    }
  
    return recommendations;
  };
// Update order status in third-party API
const updateOrderStatusToScheduled = async (orderId) => {
  try {
    const response = await axios.put(`https://kera-internship.onrender.com/order/edit/${orderId}`, {
      status: 'Scheduled',
    });
    if (response.status === 200) {
      console.log(`🚀 Order ${orderId} status updated to 'Scheduled'`);
    } else {
      console.warn(`⚠️ Failed to update order ${orderId}. Status code: ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Error updating order ${orderId}:`, error.message);
  }
};

// Check if all stages are fully scheduled for the order
const isOrderFullyScheduled = async (orderID) => {
    console.log('About to query schedules for orderID=', orderID);
  const schedules = await Schedule.find({ orderID });
  console.log('Schedules found:', schedules);
  if (schedules.length === 0) {
    console.log(`⚠️ No schedules found for orderID: ${orderID}`);
    return false;
  }
  return schedules.every(schedule =>
    schedule.status === 'Scheduled' ||
    (schedule.isManualApprovalRequired && schedule.status === 'Pending Approval')
  );
};



const scheduleOrder = async (order, recommendations, machines) => {
  const bom = await BOM.findOne({ outputItem: { $regex: new RegExp(`^${order.item}$`, 'i') } });

  if (!bom || !bom.stages?.length) {
    console.warn(`No BOM found for item: ${order.item}`);
    return;
  }

  let lastStageMinQtyEndTime = null;

  for (let stageIndex = 0; stageIndex < bom.stages.length; stageIndex++) {
    const stage = bom.stages[stageIndex];
    const fullQuantity = order.quantity * stage.unitMaterialPerProduct;
    const minQty = stage.minQtyForNextStage;
    const timePerUnit = stage.hoursRequiredMinQty / minQty;
    const totalHours = fullQuantity * timePerUnit;
    const minQtyTime = minQty * timePerUnit;
        const availableMachine = machines.find(m => m.process === stage.stageName && m.status === "Idle");
        if (!availableMachine) {
      const recommendation = createRecommendation('Outsource', `No available machine for ${stage.stageName}`);
      recommendations.push(recommendation);
      await new Schedule({
        orderID: order._id,
        orderNumber: order.orderId,
        machineID: null,
        stageName: stage.stageName,
        quantity: fullQuantity,
        status: 'Pending Approval',
        scheduledStart: new Date(),
        scheduledEnd: new Date(),
        isManualApprovalRequired: true,
        recommendation,
      }).save();
      return;
    }


    const machineStart = moment.utc(availableMachine.startTime, 'HH:mm');
    const machineEnd = moment.utc(availableMachine.endTime, 'HH:mm');
    const shiftHours = machineEnd.diff(machineStart, 'hours');
    console.log('machineEnd:', machineEnd.format('HH:mm'));
    console.log('machineStart:', machineStart.format('HH:mm'));
    console.log('shiftHours:', shiftHours);
    
    let workingDays;
    if (typeof availableMachine.workingDays === 'number') {
      workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    } else {
      workingDays = Array.isArray(availableMachine.workingDays)
        ? availableMachine.workingDays
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    }
    
    // Initialize currentTime
    let now = moment.utc();
    let currentTime = lastStageMinQtyEndTime 
      ? moment.utc(lastStageMinQtyEndTime)
      : now;
    
    // Only after initializing currentTime, check working days and machine time
    const currentHourMinute = currentTime.format('HH:mm');
   
    const machineStartHourMinute = machineStart.format('HH:mm');
    const machineEndHourMinute = machineEnd.format('HH:mm');
    
    // Non-working day
    if (!workingDays.includes(currentTime.format('dddd'))) {
      console.log('Non-working day detected, moving to next working day');
      currentTime = currentTime.add(1, 'day').set({
        hour: machineStart.hour(),
        minute: machineStart.minute(),
        second: 0,
        millisecond: 0
      });
    } 
    // Before machine start time
    else if (currentHourMinute < machineStartHourMinute) {
      console.log('Before working hours, adjusting to start time');
      currentTime.set({
        hour: machineStart.hour(),
        minute: machineStart.minute(),
        second: 0,
        millisecond: 0
      });
    } 
    // After machine end time
    else if (currentHourMinute >= machineEndHourMinute) {
      console.log('Past working hours, moving to next working day');
      currentTime = currentTime.add(1, 'day').set({
        hour: machineStart.hour(),
        minute: machineStart.minute(),
        second: 0,
        millisecond: 0
      });
    } 
    // Valid time
    else {
      console.log('Within working hours, continuing');
    }
    
    console.log('Adjusted currentTime:', currentTime.format('YYYY-MM-DD HH:mm'));
   
    let remainingTime = totalHours;
    let scheduledStart = moment.utc(currentTime);
    let scheduleChunks = [];
// Update machine status to 'Active' when the schedule starts
// await updateMachineStatus(availableMachine._id, 'Active'); // Assuming updateMachineStatus is a function
    while (remainingTime > 0) {
      if (!workingDays.includes(currentTime.format('dddd'))) {
        currentTime = currentTime.add(1, 'day').hour(machineStart.hour()).minute(machineStart.minute());
        continue;
      }
      
       

      const availableToday = Math.min(shiftHours, remainingTime);


      const dayStart = moment.utc(currentTime);
      const dayEnd = moment.utc(dayStart).add(availableToday, 'hours');

      scheduleChunks.push({ start: moment.utc(dayStart), end: moment.utc(dayEnd) });

      remainingTime -= availableToday;
      currentTime = moment.utc(dayEnd).add(1, 'minute');
    }
    // await updateMachineStatus(availableMachine._id, 'Idle'); // Change machine status to 'Idle'

    const scheduledEnd = scheduleChunks[scheduleChunks.length - 1].end;
    const minQtyEndTime = moment.utc(scheduledStart).add(minQtyTime, 'hours');

    updateMachineStatusToActive(availableMachine._id); // Update machine status to 'Active' when the schedule starts
    await new Schedule({
      orderID: order._id,
      orderNumber: order.orderId,
      machineID: availableMachine._id,
      machineName: availableMachine.machineName,
      stageName: stage.stageName,
      scheduledStart: scheduledStart.toDate(),
      scheduledEnd: scheduledEnd.toDate(),
      quantity: fullQuantity,
      status: 'Scheduled',
    }).save();

    lastStageMinQtyEndTime = minQtyEndTime.toDate();
  }

  if (order.status?.toLowerCase() === 'pending' && await isOrderFullyScheduled(order._id)) {
    await updateOrderStatusToScheduled(order._id);
  }


}
// Get schedules for a specific order ID
const getScheduleByOrder = async (orderId) => {
  try {
    const localScheduleRes = await axios.get('http://localhost:5000/scheduling/schedule');
    const allSchedules = localScheduleRes.data;
    const filteredSchedules = allSchedules.filter(schedule => schedule.orderID === orderId);

    const [machinesRes, ordersRes] = await Promise.all([
      axios.get('https://kera-internship.onrender.com/schedule'),
      axios.get('https://kera-internship.onrender.com/order')
    ]);

    const allMachines = machinesRes.data;
    const allOrders = ordersRes.data;

    return filteredSchedules.map(schedule => {
      const fullMachine = allMachines.find(m => m._id === schedule.machineID);
      const fullOrder = allOrders.find(o => o._id === schedule.orderID);
      return {
        ...schedule,
        machineID: fullMachine || schedule.machineID,
        orderID: fullOrder || schedule.orderID
      };
    });
  } catch (error) {
    console.error('Error in getScheduleByOrder:', error.message);
    return [];
  }
};

module.exports = { autoSchedule, getScheduleByOrder };

