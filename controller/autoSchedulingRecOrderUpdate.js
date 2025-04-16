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
  // console.log('📊 Total machines fetched:', response.data);
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

    const response=  await axios.put(`https://kera-internship.onrender.com/order/edit/${orderId}`, {
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
  
    // const isFullyScheduled = schedules.every(schedule =>
    //   !schedule.isManualApprovalRequired &&
    //   (!schedule.recommendation || schedule.recommendation.type === null)
    // );
    // const isFullyScheduled = schedules.every(schedule => schedule.status === 'Scheduled');
    const isFullyScheduled = schedules.every(schedule =>
      schedule.status === 'Scheduled' ||
      (schedule.isManualApprovalRequired && schedule.status === 'Pending Approval')
    );
    
    console.log(`🔍 Order   ${orderID} fully scheduled: ${isFullyScheduled}`);
    return isFullyScheduled;
  };





// Auto-schedule production orders
const autoSchedule = async () => {
  const orders = await fetchOrders();
  const machines = await fetchMachines();
  console.log("machines list:",machines.length) // Fetch machines from API
  const recommendations = [];

  // Loop through orders that are pending and sort by priority and delivery date
  const sortedOrders = orders
    .filter(order => order.status && typeof order.status === 'string' && order.status.toLowerCase() === 'pending')
    .sort((a, b) => a.priority - b.priority || new Date(a.deliveryDate) - new Date(b.deliveryDate));

  for (let order of sortedOrders) {
    if (order.isNonChangeable) {
      recommendations.push(createRecommendation('Manual Approval', `Order ${order.orderId} is non-changeable and cannot be rescheduled.`));
      continue;
    }

    await scheduleOrder(order, recommendations, machines);
  }

  return recommendations;
};

// Function to schedule each order stage-by-stage
const scheduleOrder = async (order, recommendations, machines) => {
  const bom = await BOM.findOne({ outputItem: { $regex: new RegExp(`^${order.item}$`, 'i') } });

  if (!bom || !bom.stages || bom.stages.length === 0) {
    console.warn(`⚠️ No BOM found for item: ${order.item}`);
    return;
  }

  for (let stage of bom.stages) {
    console.log(`🔧 Processing stage: ${stage.stageName} | BatchSize: ${stage.minQtyForNextStage} | OrderQty: ${order.quantity} | UnitMaterial: ${stage.unitMaterialPerProduct}`);

    const batchSize = stage.minQtyForNextStage;
    let remainingQuantity = order.quantity * stage.unitMaterialPerProduct; // Total material required for this stage
    const totalBatches = Math.ceil(remainingQuantity / batchSize); // Calculate the total number of batches required for this stage

    // let stageStartTime = new Date(); // Start time for this stage (can be adjusted as needed)
    console.log(`📦 Scheduling ${stage.stageName} in ${totalBatches} batches...`);

    // Now loop through the batches for this stage
    let lastBatchEndTime = new Date(); // Initialize last batch end time
    for (let batch = 1; batch <= totalBatches; batch++) {
      let machineAssigned = false; // Assume no machine is assigned initially

      // Loop through all available machines
      // console.log("🔍 Order Object:", order);

      for (const machine of machines.filter(m => m.process === stage.stageName && m.status === "Idle")) {
      console.log(`🔧 Checking machine: ${machine.machineId} for stage: ${stage.stageName}`);
        const batchStart = new Date(lastBatchEndTime);
        const batchEnd = new Date(batchStart.getTime() + stage.hoursRequiredMinQty * 60 * 60 * 1000);

        // Try to assign the batch to the machine
        const scheduledQuantity = Math.min(batchSize, remainingQuantity);

        const newSchedule = new Schedule({
          orderID: order._id,
          stageName: stage.stageName,
          machineID: machine._id,
          scheduledStart: batchStart,
          scheduledEnd: batchEnd,
          status: 'Scheduled',
          batchNumber: batch,
          quantity: scheduledQuantity,
        });

        await newSchedule.save();
        console.log(`✅ Scheduled ${stage.stageName} - Batch ${batch} from ${batchStart} to ${batchEnd} on Machine ${machine.machineId} | Quantity: ${scheduledQuantity} for the order ${order.orderId}`);  
        // Update machine status to busy
        // machine.status = 'Active';
        // await machine.save();
        // console.log(`🔧 Machine ${machine.machineId} status updated to 'Active'`);
        remainingQuantity -= scheduledQuantity;
        lastBatchEndTime = new Date(batchEnd);
        machineAssigned = true; // Successfully assigned the machine, no need to check further
        break; // Exit the loop since we only need to schedule this batch on one machine
      }

      // If no machine was assigned after checking all, create a recommendation to outsource
      if (!machineAssigned) {
        const recommendation = createRecommendation('Outsource', `No available machine could be assigned for ${order.orderId} ${stage.stageName}, batch ${batch}`);
        recommendations.push(recommendation);

        // Create a pending schedule to trigger manual approval workflow
        const pendingSchedule = new Schedule({
          orderID: order._id,
          machineID: null, // No machine assigned
          stageName: stage.stageName,
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          quantity: 0,
          status: 'Pending Approval',
          isManualApprovalRequired: true,
          recommendation,
        });

        await pendingSchedule.save();
        console.warn(`⚠️ No machine assigned for ${order.orderId} ${stage.stageName} - Batch ${batch}. Marked for approval.`);
      return;
      }


      // If all material for the stage is processed, exit the loop
      if (remainingQuantity <= 0) {
        console.log(`🎉 All material processed for ${stage.stageName}`);
        break; // Exit the loop since all material has been processed
      }
    }
  }

  // ✅ Check if fully scheduled and update order status
  if (
    order.status?.toLowerCase() === 'pending' &&
    await isOrderFullyScheduled(order._id)
  ) {
    console.log(`✅ All stages complete for Order ${order.orderId}. Updating status to 'scheduled'...`);
    await updateOrderStatusToScheduled(order._id);
  }




};






// Get schedules for a specific order ID
// const getScheduleByOrder = async (orderId) => {
//   const schedules = await Schedule.find({ orderID: orderId })
//     .populate('machineID')
//     .populate('orderID');
//   return schedules;
// };

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
