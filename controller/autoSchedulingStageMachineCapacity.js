const axios = require('axios');
const Schedule = require('../models/Schedule');
const BOM = require('../models/BOM');
const express = require('express');

// Fetch data from third-party APIs
const fetchOrders = async () => {
  const response = await axios.get('https://kera-internship.onrender.com/order');
  return response.data;
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

// Update machine status to 'Idle' when it is not assigned to any task
const updateMachineStatus = async (machineId, status) => {
  try {
    await axios.put(`https://kera-internship.onrender.com/schedule/edit/${machineId}`, {
      status,
    });
    console.log(`🚀 Machine ${machineId} status updated to '${status}'`);
  } catch (error) {
    console.error(`❌ Error updating machine ${machineId} status:`, error.message);
  }
};

// Helper function to calculate machine daily capacity (working hours minus break)
const calculateMachineDailyCapacity = (machine) => {
  // const workingHoursPerDay = machine.shiftHoursPerDay;
  // const workingDaysPerWeek = machine.workingDays;
  // return workingHoursPerDay * workingDaysPerWeek;
  return machine.shiftHoursPerDay;
};

// Helper function to calculate machine start time for the next working day
const getMachineStartTimeForNextDay = (machine, currentDate) => {
  const machineStartTime = new Date(currentDate);
  machineStartTime.setHours(machine.startTime.hours, machine.startTime.minutes, 0, 0);

  if (machineStartTime <= currentDate) {
    machineStartTime.setDate(machineStartTime.getDate() + 1);
  }
  while (machineStartTime.getDay() === 0) {
    machineStartTime.setDate(machineStartTime.getDate() + 1);
  }
  return machineStartTime;
};

// Auto-schedule production orders
const autoSchedule = async () => {
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

// Function to schedule each order stage-by-stage
const scheduleOrder = async (order, recommendations, machines) => {
  const deliveryDeadline = new Date(order.deliveryDate);

  const bom = await BOM.findOne({ outputItem: { $regex: new RegExp(`^${order.item}$`, 'i') } });

  
  if (!bom || !bom.stages?.length) {
    console.warn(`No BOM found for item: ${order.item}`);
    return;
  }


  console.log(`✅ Found ${bom.stages.length} stages for item: ${order.item}`);

// Loop over the stages and log the `stageName` for each one
bom.stages.forEach((stage, index) => {
    console.log(`Stage ${index + 1}: ${stage.stageName}`);
  });

  let lastStageMinQtyEndTime = null
  let finalScheduledEnd = null;

  for (let stageIndex = 0; stageIndex < bom.stages.length; stageIndex++) {
    
    const stage = bom.stages[stageIndex];

    if (!stage || !stage.stageName) {
        console.warn(`⚠️ Skipping undefined or invalid stage for order ${order.orderId}`);
        continue;
      }
    
    // ✅ Check for duplicate schedule
    const duplicate = await Schedule.findOne({
        orderID: order._id,
        stageName: stage.stageName,
        status: 'Scheduled',

      });
  
      if (duplicate) {
        const rec = createRecommendation(
          'Duplicate Schedule',
          `Schedule already exists for Order ${order.orderId}, Stage ${stage.stageName}.`
        );
        recommendations.push(rec);
  
        console.warn(`⚠️ Duplicate schedule found for Order ${order.orderId}, Stage ${stage.stageName}. Recommendation added.`);
        break; //skip this stage
      }
    const fullQuantity = order.quantity * stage.unitMaterialPerProduct;
    const minQty = stage.minQtyForNextStage;
    const timePerUnit = stage.hoursRequiredMinQty / minQty;
    const minQtyTime = minQty * timePerUnit;
  // Calculate when this stage’s minimum batch is done
    // const minQtyEndTime = new Date(lastStageMinQtyEndTime.getTime() + minQtyTime * 60 * 60 * 1000);
    // let scheduledStart = new Date(lastStageMinQtyEndTime)
     // For the first stage, start at the current time
     
     
    //  let scheduledStart = (stageIndex === 0) ? new Date() : new Date(lastStageMinQtyEndTime); 
    let scheduledStart;

    if (stageIndex === 0 || !lastStageMinQtyEndTime || isNaN(new Date(lastStageMinQtyEndTime).getTime())) {
      scheduledStart = new Date(); // Fallback to now
    } else {
      scheduledStart = new Date(lastStageMinQtyEndTime);
    }
    
    console.log('Order Data:', order);
     
     console.log('Scheduled Start:', scheduledStart);
    
      
     const minQtyEndTime = new Date(scheduledStart.getTime() + minQtyTime * 60 * 60 * 1000);
     lastStageMinQtyEndTime = minQtyEndTime; // Update lastStageMinQtyEndTime for the next stage
     console.log('Last Stage minqty End Time:', lastStageMinQtyEndTime);
    // Compute total hours for the entire quantity
    const totalHours = fullQuantity * timePerUnit;
    let scheduledEnd = new Date(scheduledStart.getTime() + totalHours * 60 * 60 * 1000);
    console.log('Scheduled End:', scheduledEnd);
    if (isNaN(scheduledEnd.getTime())) {
        console.error('Invalid scheduledEnd:', scheduledEnd);
      }
    let remainingHours = totalHours;
    // const availableMachine = machines.find(m =>
    //   m.process === stage.stageName &&
    //   m.status === 'Idle'
    // );
   
    const availableMachine = machines.find(m =>
        new RegExp(`^${stage.stageName}$`, 'i').test(m.process) &&
        m.status === 'Idle'
      );
    // const availableMachine = machines.filter(
    //     m => m.process?.toLowerCase() === stage.process.toLowerCase() && m.status === "Idle"
    //   );

      if (availableMachine?.process === stage.stageName) {
        // ✅ Safe to proceed with scheduling logic
        console.log(`🟢 Proceeding with machine: ${availableMachine.machineId}`);
      }
    if (!availableMachine) {
        console.warn(`⚠️ No available machine found for stage "${stage.stageName}" in Order ${order.orderId}`);

      const rec = createRecommendation('Outsource', `No available machine for ${stage.stageName} of order ${order.orderId}`);
      recommendations.push(rec);
      await new Schedule({
        orderID: order._id,
        orderNumber: order.orderId,
        machineID: null,
        machineName: null,
        stageName: stage.stageName,
        scheduledStart,
        scheduledEnd,
        quantity: fullQuantity,
        status: 'Pending Approval',
        isManualApprovalRequired: true,
        recommendation: rec,
      }).save();
      return;
    }

    await updateMachineStatus(availableMachine._id, 'Active');

    const machineDailyCapacity = calculateMachineDailyCapacity(availableMachine);

    while (remainingHours > 0) {
      if (remainingHours <= machineDailyCapacity) {
        scheduledEnd = new Date(scheduledStart.getTime() + remainingHours * 60 * 60 * 1000);
        await new Schedule({
          orderID: order._id,
          orderNumber: order.orderId,
          machineID: availableMachine._id,
          machineName: availableMachine.machineId,
          stageName: stage.stageName,
          scheduledStart,
          scheduledEnd,
          quantity: fullQuantity,
          status: 'Scheduled',
        }).save();
        remainingHours = 0;
      } else {
        scheduledEnd = new Date(scheduledStart.getTime() + machineDailyCapacity * 60 * 60 * 1000);
        await new Schedule({
          orderID: order._id,
          orderNumber: order.orderId,
          machineID: availableMachine._id,
          machineName: availableMachine.machineId,
          stageName: stage.stageName,
          scheduledStart,
          scheduledEnd,
          quantity: fullQuantity,
          status: 'Scheduled',
        }).save();

        remainingHours -= machineDailyCapacity;
        scheduledStart = getMachineStartTimeForNextDay(availableMachine, scheduledEnd);
      }
    }

    finalScheduledEnd = scheduledEnd;
    // lastStageMinQtyEndTime = minQtyEndTime;
  }

  // NEW: check against delivery date
  if (finalScheduledEnd > deliveryDeadline) {
    recommendations.push(createRecommendation(
      'Delayed',
      `Order ${order.orderId} will finish at ${finalScheduledEnd.toISOString()} which is after its delivery date ${deliveryDeadline.toISOString()}.`
    ));
    return;
  }

  if (await isOrderFullyScheduled(order._id)) {
    await updateOrderStatusToScheduled(order._id);
  }

  await updateMachineStatus(machines.find(m => m._id === machines._id)?._id || machines[0]._id, 'Idle');
};

// Get schedules for a specific order ID
const getScheduleByOrder = async (orderId) => {
  try {
    const localScheduleRes = await axios.get('http://localhost:5000/scheduling/schedule');
    const allSchedules = localScheduleRes.data;
    const filteredSchedules = allSchedules.filter(schedule => schedule.orderID === orderId);

    const [machinesRes, ordersRes] = await Promise.all([
      axios.get('https://kera-internship.onrender.com/machine'),
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
