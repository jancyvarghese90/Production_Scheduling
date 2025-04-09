const mongoose = require('mongoose');
const machineSchema = new mongoose.Schema({
    machineId: { type: String, required: true },
    machineName: { type: String, required: true },
    operation: { type: String, required: true },  // e.g., "Mixing", "Tufting", "Packing"
    
    operatingHoursPerShift: { type: Number, required: true },  // How many hours the machine operates per day
    shiftsPerDay: { type: Number, required: true }, // Optional: for capacity estimation
   
    isAvailable: { type: Boolean, default: true },  // Is the machine available for scheduling?
  });
  
  module.exports = mongoose.model('Machine', machineSchema);
  // capacityPerHr: { type: Number, required: true },  // Capacity per hour (e.g., 100 units per hour)