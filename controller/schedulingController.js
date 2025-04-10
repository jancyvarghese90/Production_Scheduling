
const Order = require('../models/Order');
const Machine = require('../models/Machine');
const Schedule = require('../models/Schedule');
const BOM = require('../models/BOM');

// Auto-schedule production orders
const autoSchedule = async () => {
  const orders = await Order.find({ status: 'Pending' }).sort({ priority: 1, deliveryDate: 1 });
  const recommendations = [];

  for (let order of orders) {
    if (order.isNonChangeable) {
      recommendations.push({
        type: 'Manual Approval',
        reason: `Order ${order.orderNumber} is non-changeable and cannot be rescheduled.`,
      });
    }

    await scheduleOrder(order, recommendations);
  }

  return recommendations;
};
// Function to schedule each order stage-by-stage
const scheduleOrder = async (order, recommendations) => {
  const bom = await BOM.findOne({ outputItem: order.itemCode });
  console.log(bom?.stages);
  if (!bom || !bom.stages || bom.stages.length === 0) return;

  let remainingQuantity = order.quantity;
  let stageStartTime = new Date(); // Starting time for the first stage

  for (let stage of bom.stages) {
    // STEP 1: Check completed quantity for this stage
    const completedSchedules = await Schedule.find({
      orderID: order._id,
      stageName: stage.stageName,
      status: 'Completed',
    });

    const totalCompletedQty = completedSchedules.reduce((sum, entry) => sum + entry.quantity, 0);

    const requiredQtyForStage = stage.minQtyForNextStage || remainingQuantity;

    if (totalCompletedQty >= requiredQtyForStage) {
      console.log(`✅ Stage ${stage.stageName} already completed for order ${order.orderNumber}.`);
      stageStartTime = new Date(completedSchedules.at(-1)?.scheduledEnd || stageStartTime); // Update stageStartTime
      continue; // Skip scheduling this stage
    }



// Find all available machines for the given stage operation
const machines = await Machine.find({
  operation: { $regex: new RegExp(`^${stage.stageName}$`, 'i') },
  isAvailable: true
});
// Check if there are any available machines
if (!Array.isArray(machines) || machines.length === 0) {
  recommendations.push({
    type: 'Outsource',
    reason: `No available machine found for stage ${stage.stageName} in order ${order.orderNumber}.`,
  });
  continue; // Don't return; try to schedule next stages
}


// Loop through each machine and schedule it
let quantityLeft = remainingQuantity - totalCompletedQty; // Remaining quantity to schedule
let batchStartTime = new Date(stageStartTime);
let totalBatchesForStage = 0; // Track total batches for the stage

for (let machine of machines) {
  // Calculate the total hours required for the current machine
  const qtyToSchedule = Math.min(quantityLeft, stage.minQtyForNextStage);
  const totalHoursRequired =
    (stage.hoursRequiredMinQty * qtyToSchedule) / stage.minQtyForNextStage;

  const requiredShifts = Math.ceil(totalHoursRequired / machine.operatingHoursPerShift);

  if (requiredShifts > machine.shiftsPerDay) {
    recommendations.push({
      type: 'Extra Shift',
      reason: `Machine ${machine.machineName} requires ${requiredShifts} shifts to complete stage ${stage.stageName}.`,
    });
  }

  const stageEndTime = new Date(batchStartTime.getTime() + totalHoursRequired * 60 * 60 * 1000);

  if (stageEndTime > order.deliveryDate) {
    recommendations.push({
      type: 'Outsource',
      reason: `Order ${order.orderNumber} cannot meet delivery date. Suggest outsourcing stage ${stage.stageName}.`,
    });
    continue;
  }

  // Schedule batches for the current machine
// Log total batches scheduled for this stage
let totalBatchesScheduledForMachine = 0; // Initialize total batches for the current machine

  while (quantityLeft > 0) {
    const scheduleQty = Math.min(quantityLeft, stage.minQtyForNextStage);
    const batchHours =
      (scheduleQty / stage.minQtyForNextStage) * stage.hoursRequiredMinQty;
    const batchEndTime = new Date(batchStartTime.getTime() + batchHours * 60 * 60 * 1000);

    // Create a new schedule entry
    const scheduleEntry = new Schedule({
      orderID: order._id,
      machineID: machine._id,
      stageName: stage.stageName,
      scheduledStart: batchStartTime,
      scheduledEnd: batchEndTime,
      quantity: scheduleQty,
      uom: order.uom,
      status: 'Scheduled',
      isManualApprovalRequired: order.isNonChangeable,
      isApproved: false,
    });

    await scheduleEntry.save();
    quantityLeft -= scheduleQty;
    batchStartTime = new Date(batchEndTime);     // Update batch start time for next batch
    totalBatchesScheduledForMachine += 1; // Count the batch for this machine
    totalBatchesForStage += 1; // Count the batch for the stage
 
  }
// Log total batches scheduled for this machine
console.log(`Total Batches Scheduled for Machine: ${machine.machineName} - ${totalBatchesScheduledForMachine} (Order: ${order.orderNumber})`);

// If all quantity is scheduled, break out of the loop
  if (quantityLeft <= 0) break;
}
// Log total batches scheduled for this stage
console.log(`Total Batches Scheduled for Stage: ${stage.stageName} - ${totalBatchesForStage} (Order: ${order.orderNumber})`);
// Update stageStartTime for the next stage
stageStartTime = new Date(batchStartTime);
  }};
// Get schedules for a specific order ID
const getScheduleByOrder = async (orderId) => {
  const schedules = await Schedule.find({ orderID: orderId })
    .populate('machineID').populate('orderID');
    
  return schedules;
};

module.exports = { autoSchedule, getScheduleByOrder };