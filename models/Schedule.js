// const mongoose = require('mongoose');
// const scheduleSchema = new mongoose.Schema({
//     orderID: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
//     machineID: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
//     scheduledStart: { type: Date, required: true },
//     scheduledEnd: { type: Date, required: true },
//     status: { type: String, enum: ['Scheduled', 'PendingApproval', 'Approved', 'Rejected'], default: 'Scheduled' },
//   });
  
//   module.exports = mongoose.model('Schedule', scheduleSchema);
  
const mongoose = require('mongoose');
const Order = require('./Order');

const recommendationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Outsource', 'Extra Shift', 'Reschedule'],
    required: true,
  },
  reason: { type: String, required: true },
  suggestedBy: { type: String, default: 'System' },
  createdAt: { type: Date, default: Date.now }
});


const scheduleSchema = new mongoose.Schema({
  orderID: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
 orderNumber: { type: String }, // e.g., "1001"
  machineID: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine' },
  machineName: { type: String }, // e.g., "Machine A", "Machine B"
  stageName: { type: String, required: true }, // e.g., "TUFTING", "CUTTING"
  
  scheduledStart: { type: Date, required: true },
  scheduledEnd: { type: Date, required: true },

  quantity: { type: Number, required: true }, // Quantity to be produced in this stage
  uom: { type: String},      // e.g., "KGS", "PCS"

  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'Completed', 'Rejected', 'Pending Approval'],
    default: 'Scheduled'
  },

  isManualApprovalRequired: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  
  recommendation: [recommendationSchema], // 👈 Embedded Recommendation here
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
// Ensure that each order and stage is only scheduled once
scheduleSchema.index({ orderID: 1, stageName: 1 }, { unique: true });
module.exports = mongoose.model('Schedule', scheduleSchema);
