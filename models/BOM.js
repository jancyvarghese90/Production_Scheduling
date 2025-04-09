const mongoose = require('mongoose');

// Sub-schema for components used in each stage
const componentSchema = new mongoose.Schema({
  code: { type: String, required: true },       // Component code (e.g., LTX0001)
  qty: { type: Number, required: true },        // Quantity required
  uom: { type: String, required: true },        // Unit of Measure (e.g., KGS, NOS)
});

// Sub-schema for each stage in the BOM
const stageSchema = new mongoose.Schema({
  sequenceNo: { type: Number, required: true },         // Stage order (1, 2, 3...)
  stageName: { type: String, required: true },          // Operation name (e.g., COMPOUND MIXING)
  minQtyForNextStage: { type: Number, required: true }, // Minimum quantity for next stage (e.g., 2000)
  hoursRequiredMinQty: { type: Number, required: true },      // Hours for minQtyForNextStage
  components: [componentSchema],                        // List of components for the stage
});

// Main BOM schema
const bomSchema = new mongoose.Schema({
  outputItem: { type: String, required: true },     // Final product code (e.g., KERA#050623-11)
  outputQty: { type: Number, required: true },      // Quantity produced per BOM (usually 1)
  uom: { type: String, required: true },            // Unit of measure for output (e.g., PCS, KGS)
  stages: [stageSchema],                            // Array of production stages
}, { timestamps: true });

module.exports = mongoose.model('BOM', bomSchema);
