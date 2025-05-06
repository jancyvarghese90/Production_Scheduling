const moment = require('moment');
const BOM = require('../models/BOM.js');
const axios = require('axios');
const Schedule = require('../models/Schedule');
const express = require('express');
// const {updateMachineStatusesToIdle,updateMachineStatusToActive} = require('./machineStausUpdate');

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
  // await updateMachineStatusesToIdle();
    const orders = await fetchOrders();
      
    const machines = await fetchMachines();
    const recommendations = [];
  
    const sortedOrders = orders
      .filter(order => order.status === 'Pending')
      .sort((a, b) => a.priority - b.priority || new Date(a.deliveryDate) - new Date(b.deliveryDate));
  
    for (let order of sortedOrders) {
      console.log('Processing order:', order.item, order.orderId);
      const existingSchedule = await Schedule.findOne({ orderID: order._id, status: 'Scheduled' });

      // if (order.isNonChangeable && existingSchedule) {

      //   recommendations.push(createRecommendation(
      //     'Manual Approval',
      //     `Order ${order.orderId} is non-changeable and already scheduled.`
      //   ));
      //   continue;
      // }
      if (order.isNonChangeable && existingSchedule) {
        const fullyScheduled = await isOrderFullyScheduled(order._id, order.item);
        if (fullyScheduled) {
          console.log(`✅ Order ${order.orderId} is fully scheduled.`);
          continue; // Do not re-schedule
        } else {
          console.log(`⚠️ Order ${order.orderId} is non-changeable but not fully scheduled.`);
          recommendations.push(createRecommendation(
            'Manual Approval',
            `Order ${order.orderId} is non-changeable but not fully scheduled. Manual intervention required.`
          ));
          continue;
        }
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
// const isOrderFullyScheduled = async (orderID) => {
//     console.log('About to query schedules for orderID=', orderID);
//   const schedules = await Schedule.find({ orderID });
//   console.log('Schedules found:', schedules);
//   if (schedules.length === 0) {
//     console.log(`⚠️ No schedules found for orderID: ${orderID}`);
//     return false;
//   }
//   return schedules.every(schedule =>
//     schedule.status === 'Scheduled' ||
//     (schedule.isManualApprovalRequired && schedule.status === 'Pending Approval')
//   );
// };
const isOrderFullyScheduled = async (orderID, outputItem) => {
  // Get all schedules for the order
  const schedules = await Schedule.find({ orderID });

  // Get BOM stages for the given itemCode from your schema
  const bom = await BOM.findOne({ outputItem });
  if (!bom || !bom.stages || bom.stages.length === 0) {
    console.log(`⚠️ No BOM stages found for itemCode: ${outputItem}`);
    return false;
  }

  // Ensure each BOM stage has a 'Scheduled' status schedule
  const allStagesScheduled = bom.stages.every(stage => {
    const matchingSchedule = schedules.find(s => s.stageName === stage.stageName);
    return matchingSchedule && matchingSchedule.status === 'Scheduled';
  });

  return allStagesScheduled;
};


const scheduleOrder = async (order, recommendations, machines) => {
  const bom = await BOM.findOne({ outputItem: { $regex: new RegExp(`^${order.item}$`, 'i') } });
  const API_BASE_URL = 'https://kera-internship.onrender.com/schedule';
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
      
 
     
    
    
    // const availableMachine = machines.find(m => m.process === stage.stageName && m.status === "Idle");

 // Step 1: Initialize current time
const now = moment.utc();
let tentativeStartTime = lastStageMinQtyEndTime 
  ? moment.utc(lastStageMinQtyEndTime)
  : now;

// Step 2: Build map of last end times for machines of this process
const machineSchedules = await Schedule.find({ stageName: stage.stageName });
const machineAvailability = {}; // machineId -> latest end time

machineSchedules.forEach(schedule => {
  if (!schedule.machineID) return;
  const end = moment.utc(schedule.scheduledEnd);
  if (
    !machineAvailability[schedule.machineID] ||
    end.isAfter(machineAvailability[schedule.machineID])
  ) {
    machineAvailability[schedule.machineID] = end;
  }
});

// Step 3: Select the best machine based on availability
let availableMachine = null;
let earliestAvailableTime = null;

for (let machine of machines.filter(m => m.process === stage.stageName)) {
  const lastEnd = machineAvailability[machine._id];
  const isFreshIdle = !lastEnd;

  let availableAt = isFreshIdle
    ? moment.utc(tentativeStartTime) // machine never used: available now or after last stage
    : lastEnd.isAfter(tentativeStartTime)
      ? lastEnd
      : moment.utc(tentativeStartTime);

  // Pick the machine with the earliest adjusted available time
  if (
    !earliestAvailableTime ||
    availableAt.isBefore(earliestAvailableTime) ||
    (
      availableAt.isSame(earliestAvailableTime) && isFreshIdle
    )
  ) {
    availableMachine = machine;
    earliestAvailableTime = availableAt;
  }
}

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
  // Default to Monday to Saturday if workingDays is a number
  workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
} else {
  // If workingDays is an array, exclude Sunday if it is there
  workingDays = Array.isArray(availableMachine.workingDays)
    ? availableMachine.workingDays.filter(day => day !== 'Sunday')
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; // Default working days, excluding Sunday
}
    
   

    let currentTime;
    if (lastStageMinQtyEndTime) {
      currentTime = moment.utc(lastStageMinQtyEndTime).isAfter(earliestAvailableTime)
        ? moment.utc(lastStageMinQtyEndTime)
        : earliestAvailableTime;
    } else {
      currentTime = earliestAvailableTime;
    }

    
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
 

    while (remainingTime > 0) {
      if (!workingDays.includes(currentTime.format('dddd'))) {
        currentTime = currentTime.add(1, 'day').set({
          hour: machineStart.hour(),
          minute: machineStart.minute(),
          second: 0,
          millisecond: 0
        });
        continue;
      }
    
      const shiftEnd = currentTime.clone().set({
        hour: machineEnd.hour(),
        minute: machineEnd.minute(),
        second: 0,
        millisecond: 0
      });
    
      const availableToday = moment.duration(shiftEnd.diff(currentTime)).asHours();
    
      if (availableToday <= 0) {
        currentTime = currentTime.add(1, 'day').set({
          hour: machineStart.hour(),
          minute: machineStart.minute(),
          second: 0,
          millisecond: 0
        });
        continue;
      }
    
      const dayStart = moment.utc(currentTime);
      const workHours = Math.min(availableToday, remainingTime);
      const dayEnd = moment.utc(dayStart).add(workHours, 'hours');

      scheduleChunks.push({ start: moment.utc(dayStart), end: moment.utc(dayEnd) });

      remainingTime -= workHours;
      currentTime = moment.utc(dayEnd).add(1, 'minute');
    }

    const scheduledEnd = scheduleChunks[scheduleChunks.length - 1].end;
    const minQtyEndTime = moment.utc(scheduledStart).add(minQtyTime, 'hours');
    const deliveryDateUTC = moment.utc(order.deliveryDate);
    const isLate = scheduledEnd.isAfter(deliveryDateUTC);
    if (isLate) {
      const recommendation = createRecommendation('Outsource',
         `Schedule for stage ${stage.stageName} of order ${order.orderId} exceeds delivery date and needs approval.`
);
      recommendations.push(recommendation);
    }
    // 🧹 Delete existing schedule to prevent duplicate key error
await Schedule.deleteOne({ orderID: order._id, stageName: stage.stageName });

    await new Schedule({
      orderID: order._id,
      orderNumber: order.orderId,
      machineID: availableMachine._id,
      machineName: availableMachine.machineId,
      stageName: stage.stageName,
      scheduledStart: scheduledStart.toDate(),
      scheduledEnd: scheduledEnd.toDate(),
      quantity: fullQuantity,
      // status: 'Scheduled',
      status: isLate ? 'Pending Approval' : 'Scheduled',
      isManualApprovalRequired: isLate,
      recommendation: isLate ? recommendations : null,
    }).save();

    lastStageMinQtyEndTime = minQtyEndTime.toDate();
  }

  if (order.status?.toLowerCase() === 'pending' && await isOrderFullyScheduled(order._id,order.item)) {
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

