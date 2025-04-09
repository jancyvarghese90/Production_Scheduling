const mongoose = require('mongoose');


// const orderSchema = new mongoose.Schema({
//   productCode: { type: String, required: true },  // The product code for the order
//   orderQuantity: { type: Number, required: true },  // Quantity of the product in the order
//   priority: { type: Number, required: true },    // Priority: 1 (high) to 5 (low)
//   orderDate: { type: Date, default: Date.now },  // Date when the order was placed
//   dueDate: { type: Date, required: true },  // Due date for the order
//   isNonChangeable: { type: Boolean, default: false },  // Whether the order can be rescheduled
// });

// module.exports = mongoose.model('Order', orderSchema);


const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },   // e.g., "1001"
  orderDate: { type: Date, required: true },                     // e.g., "2025-01-02"
  customerName: { type: String, required: true },                // e.g., "ABC Carpets"
  itemCode: { type: String, required: true },                    // e.g., "KERA#050623-11"
   
  quantity: { type: Number, required: true },                   // e.g., 3000
  priority: { type: Number, required: true,enum: [1, 2, 3, 4, 5] }, // Priority: 1 (high) to 5 (low)
  uom: { type: String, required: true },                         // e.g., "Pcs"
  rate: { type: Number, required: true },                        // e.g., 320
  deliveryDate: { type: Date, required: true },                  // e.g., "2025-05-03"
  isNonChangeable: { type: Boolean, default: false },            // For scheduling lock
  // startDate: { type: Date },                                     // Optional scheduling start
  status: { type: String, enum: ['Pending', 'Scheduled','Ready to Deliver', 'Deliverd'], default: 'Pending' },
  machineID: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine' }, // Reference to the Machine model

});

module.exports = mongoose.model('Order', orderSchema);
