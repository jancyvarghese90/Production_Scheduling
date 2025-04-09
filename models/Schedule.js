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
  machineID: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine', required: true },
  stageName: { type: String, required: true }, // e.g., "TUFTING", "CUTTING"
  
  scheduledStart: { type: Date, required: true },
  scheduledEnd: { type: Date, required: true },

  quantity: { type: Number, required: true }, // Quantity to be produced in this stage
  uom: { type: String, required: true },      // e.g., "KGS", "PCS"

  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'Completed', 'Outsourced', 'Pending Approval'],
    default: 'Scheduled'
  },

  isManualApprovalRequired: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  recommendation: recommendationSchema, // 👈 Embedded Recommendation here
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Schedule', scheduleSchema);
