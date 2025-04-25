const axios = require('axios');
const Schedule = require('../models/Schedule');
const BOM = require('../models/BOM');

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
const createRecommendation = (type, reason) => {
  return {
    type,
    reason,
    suggestedBy: 'System',
    createdAt: new Date(),
  };
};

// Update order status in third-party API
const updateOrderStatusToScheduled = async (orderId) => {
  try {
    const response = await axios.put(`https://kera-internship.onrender.com/order/edit/${orderId}`, {
      status: 'Scheduled',
    });
    if (response.status === 200) {
      console.log(`🚀 Order ${orderId} status updated to 'Scheduled'`);
      console.log('Response:', response.data); // Log the full response to check for confirmation
    } else {
      console.warn(`⚠️ Failed to update order ${orderId}. Status code: ${response.status}`);
      console.log('Response:', response.data);
    }
  } catch (error) {
    if (error.response) {
      console.error(`❌ Failed to update status for order ${orderId}:`, error.response.status, error.response.data);
    } else if (error.request) {
      console.error(`❌ No response received for order ${orderId}:`, error.request);
    } else {
      console.error(`❌ Error updating order ${orderId}:`, error.message);
    }
  }
};

// Check if all stages are fully scheduled for the order
const isOrderFullyScheduled = async (orderID) => {
  const schedules = await Schedule.find({ orderID });

  if (schedules.length === 0) {
    console.log(`⚠️ No schedules found for orderID: ${orderID}`);
    return false;
  }

  const isFullyScheduled = schedules.every(schedule =>
    schedule.status === 'Scheduled' ||
    (schedule.isManualApprovalRequired && schedule.status === 'Pending Approval')
  );

  console.log(`🔍 Order ${orderID} fully scheduled: ${isFullyScheduled}`);
  return isFullyScheduled;
};

// Update machine status to 'Idle' when it is not assigned to any task
const updateMachineStatus = async (machineId, status) => {
  try {
    await axios.put(`https://kera-internship.onrender.com/schedule/edit/${machineId}`, {
      status: status,
    });
    console.log(`🚀 Machine ${machineId} status updated to '${status}'`);
  } catch (error) {
    console.error(`❌ Error updating machine ${machineId} status:`, error.message);
  }
};

// Auto-schedule production orders
const autoSchedule = async () => {
  const orders = await fetchOrders();
  const machines = await fetchMachines();
  console.log("machines list:", machines.length); // Fetch machines from API
  const recommendations = [];

  // Loop through orders that are pending and sort by priority and delivery date
  const sortedOrders = orders
    .filter(order => order.status && typeof order.status === 'string' && order.status.toLowerCase() === 'pending')
    .sort((a, b) => a.priority - b.priority || new Date(a.deliveryDate) - new Date(b.deliveryDate));

  for (let order of sortedOrders) {
    // Skip non-changeable orders if they are already scheduled
    const existingSchedule = await Schedule.findOne({ orderID: order._id, status: 'Scheduled' });
    if (order.isNonChangeable && existingSchedule) {
      recommendations.push(createRecommendation('Manual Approval', `Order ${order.orderId} is non-changeable and already scheduled.`));
      continue; // Skip rescheduling for non-changeable orders
    }

    await scheduleOrder(order, recommendations, machines);
  }

  return recommendations;
};

// Function to schedule each order stage-by-stage
const scheduleOrder = async (order, recommendations, machines) => {
  const bom = await BOM.findOne({ outputItem: { $regex: new RegExp(`^${order.item}$`, 'i') } });

  if (!bom || !bom.stages?.length) {
    console.warn(`No BOM found for item: ${order.item}`);
    return;
  }

  let lastStageMinQtyEndTime = new Date();

  for (let stageIndex = 0; stageIndex < bom.stages.length; stageIndex++) {
    const stage = bom.stages[stageIndex];

    const fullQuantity = order.quantity * stage.unitMaterialPerProduct;
    const minQty = stage.minQtyForNextStage;
    const timePerUnit = stage.hoursRequiredMinQty / minQty;

    const scheduledStart = new Date(lastStageMinQtyEndTime);
    const totalHours = fullQuantity * timePerUnit;
    const scheduledEnd = new Date(scheduledStart.getTime() + totalHours * 60 * 60 * 1000);

    const minQtyTime = minQty * timePerUnit;
    const minQtyEndTime = new Date(scheduledStart.getTime() + minQtyTime * 60 * 60 * 1000);

    const availableMachine = machines.find(m => m.process === stage.stageName && m.status === "Idle");

    if (!availableMachine) {
      const recommendation = createRecommendation('Outsource', `No available machine for ${stage.stageName}`);
      recommendations.push(recommendation);
      await new Schedule({
        orderID: order._id,
        orderNumber: order.orderId,
        machineID: null,
        stageName: stage.stageName,
        scheduledStart,
        scheduledEnd,
        quantity: fullQuantity,
        status: 'Pending Approval',
        isManualApprovalRequired: true,
        recommendation,
      }).save();
      return;
    }

    // Update machine status to 'Active' when assigned to a task
    await updateMachineStatus(availableMachine._id, 'Active');

    await new Schedule({
      orderID: order._id,
      machineID: availableMachine._id,
      stageName: stage.stageName,
      scheduledStart,
      scheduledEnd,
      quantity: fullQuantity,
      status: 'Scheduled',
    }).save();

    // Set next stage's start time = minQty end time of current stage
    lastStageMinQtyEndTime = minQtyEndTime;
  }

  // Update the machine back to 'Idle' after all tasks are completed
  if (order.status?.toLowerCase() === 'pending' && await isOrderFullyScheduled(order._id)) {
    await updateOrderStatusToScheduled(order._id);
  }

  // Ensure the machine status is set to 'Idle' after the task is completed
  machines.forEach(async (machine) => {
    if (!machine.assignedOrders || machine.assignedOrders.length === 0) {
      await updateMachineStatus(machine._id, 'Idle');
    }
  });
};

// Get schedules for a specific order ID
const getScheduleByOrder = async (orderId) => {
  try {
    // Step 1: Fetch all schedules from your internal DB or schedule API
    const localScheduleRes = await axios.get('http://localhost:5000/scheduling/schedule');
    const allSchedules = localScheduleRes.data;

    // Step 2: Filter only schedules matching the orderId
    const filteredSchedules = allSchedules.filter(schedule => schedule.orderID === orderId);

    // Step 3: Fetch machine and order data from third-party APIs
    const [machinesRes, ordersRes] = await Promise.all([ 
      axios.get('https://kera-internship.onrender.com/machine'),
      axios.get('https://kera-internship.onrender.com/order')
    ]);

    const allMachines = machinesRes.data;
    const allOrders = ordersRes.data;

    // Step 4: Populate machineID and orderID with full object data
    const populatedSchedules = filteredSchedules.map(schedule => {
      const fullMachine = allMachines.find(m => m._id === schedule.machineID);
      const fullOrder = allOrders.find(o => o._id === schedule.orderID);

      return {
        ...schedule,
        machineID: fullMachine || schedule.machineID,
        orderID: fullOrder || schedule.orderID
      };
    });

    return populatedSchedules;
  } catch (error) {
    console.error('Error in getScheduleByOrder:', error.message);
    return [];
  }
};

module.exports = { autoSchedule, getScheduleByOrder };
