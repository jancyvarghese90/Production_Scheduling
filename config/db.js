const mongoose= require('mongoose');
require('dotenv').config();
const  Machine= require('../models/Machine')
// const Counter = require('../models/Counter'); 
const BOM = require('../models/BOM');
// const seedBOM = require('../seed/seedBOM'); // Import the seedBOM function



const machineData = [
    { machineName: 'KFT/MACH/LTXM-1', operation: 'COMPOUND MIXING', operatingHoursPerShift:8, shiftsPerDay:2},
    { machineName: 'KFT/MACH/LTXM-2', operation: 'COMPOUND MIXING', operatingHoursPerShift:8, shiftsPerDay:2 },
  { machineName: 'KFT/MACH/TFG-1', operation: 'TUFTING' , operatingHoursPerShift:8, shiftsPerDay:2},
  { machineName: 'KFT/MACH/TFG-2', operation: 'TUFTING', operatingHoursPerShift:8, shiftsPerDay:2 },
  { machineName: 'KFT/MACH/TFG-3', operation: 'TUFTING', operatingHoursPerShift:8, shiftsPerDay:2 },
  { machineName: 'KFT/MACH/TFG-4', operation: 'TUFTING', operatingHoursPerShift:8, shiftsPerDay:2 },
  { machineName: 'KFT/MACH/TFG-5', operation: 'TUFTING', operatingHoursPerShift:8, shiftsPerDay:2 },
  { machineName: 'KFT/MACH/TFG-6', operation: 'TUFTING', operatingHoursPerShift:8, shiftsPerDay:2 },
  { machineName: 'KFT/MACH/TFG-7', operation: 'TUFTING', operatingHoursPerShift:8, shiftsPerDay:2},
  { machineName: 'KFT/MACH/TFG-8', operation: 'TUFTING', operatingHoursPerShift:8 , shiftsPerDay:2},
  { machineName: 'KFT/MACH/CT-1', operation: 'TUFTING', operatingHoursPerShift:8 , shiftsPerDay:2},
  { machineName: 'KFT/MACH/CT-2', operation: 'CUTTING', operatingHoursPerShift:8 , shiftsPerDay:2},
  { machineName: 'KFT/MACH/CT-3', operation: 'CUTTING', operatingHoursPerShift:8, shiftsPerDay:2 },
  { machineName: 'KFT/MACH/CT-4', operation: 'CUTTING', operatingHoursPerShift:8 , shiftsPerDay:2},
  { machineName: 'KFT/MACH/CT-5', operation: 'CUTTING', operatingHoursPerShift:8 , shiftsPerDay:2},
  { machineName: 'KFT/MACH/CT-6', operation: 'CUTTING', operatingHoursPerShift:8, shiftsPerDay:2},
  { machineName: 'KFT/MACH/CT-7', operation: 'CUTTING', operatingHoursPerShift:8 ,shiftsPerDay:2},
  { machineName: 'KFT/MACH/PR-1', operation: 'PRINTING', operatingHoursPerShift:8,shiftsPerDay:2 },
  { machineName: 'KFT/MACH/PR-2', operation: 'PRINTING', operatingHoursPerShift:8 ,shiftsPerDay:2},
  { machineName: 'KFT/MACH/PR-3', operation: 'PRINTING', operatingHoursPerShift:8,shiftsPerDay:2 },
  { machineName: 'KFT/MACH/PKG-1', operation: 'LABELLING & PACKING', operatingHoursPerShift:8,shiftsPerDay:2 },
  { machineName: 'KFT/MACH/PKG-2', operation: 'LABELLING & PACKING', operatingHoursPerShift:8 ,shiftsPerDay:2},
  { machineName: 'KFT/MACH/PKG-3', operation: 'LABELLING & PACKING', operatingHoursPerShift:8,shiftsPerDay:2 },
];

const bomData = {
  outputItem: 'KERA#050623-11',
  outputQty: 1,
  uom: 'PCS',
  stages: [
    {
      sequenceNo: 1,
      stageName: 'COMPOUND MIXING',
      minQtyForNextStage: 2000,
      hoursRequiredMinQty: 0.75,
      components: [
        { code: 'LTX0001', qty: 0.2649, uom: 'KGS' },
        { code: 'RM-LM-LS03', qty: 0.6519, uom: 'KGS' },
        { code: 'IRM-LM-DV03', qty: 0.0141, uom: 'KGS' },
        { code: 'IRM-LM-AS04', qty: 0.0011, uom: 'KGS' },
        { code: 'IRM-LM-17R05', qty: 0.0026, uom: 'KGS' },
        { code: 'IRM-LM-22R06', qty: 0.0079, uom: 'KGS' },
        { code: 'RM-PB- BK28', qty: 0.0044, uom: 'KGS' },
        { code: 'RM-CAPFS', qty: 0.0033, uom: 'KGS' },
        { code: 'RM-LTXCMPD', qty: 0.0088, uom: 'KGS' },
      ],
    },
    {
      sequenceNo: 2,
      stageName: 'TUFTING',
      minQtyForNextStage: 35,
      hoursRequiredMinQty: 1,
      components: [
        { code: 'BKLTX_COMPD', qty: 4.5443, uom: 'KGS' },
        { code: 'RM-LM-JN13', qty: 1, uom: 'SQM' },
        { code: 'RMCY01', qty: 2.6548, uom: 'KGS' },
      ],
    },
    {
      sequenceNo: 3,
      stageName: 'CUTTING',
      minQtyForNextStage: 200,
      hoursRequiredMinQty: 0.5,
      components: [{ code: 'BLLBMR1.887015', qty: 0.3621, uom: 'SQM' }],
    },
    {
      sequenceNo: 4,
      stageName: 'PRINTING',
      minQtyForNextStage: 200,
      hoursRequiredMinQty: 6,
      components: [
        { code: 'BKLBM-467615', qty: 1, uom: 'PCS' },
        { code: 'KAPFM', qty: 0.05, uom: 'KGS' },
        { code: 'KAPFYL', qty: 0.0286, uom: 'KGS' },
        { code: 'KAPFGR', qty: 0.0186, uom: 'KGS' },
        { code: 'KAPFBG', qty: 0.0414, uom: 'KGS' },
        { code: 'KAPFV', qty: 0.0357, uom: 'KGS' },
        { code: 'KAPFBR', qty: 0.0271, uom: 'KGS' },
        { code: 'KAPFLBL', qty: 0.03, uom: 'KGS' },
        { code: 'KASLSUPWHT', qty: 0.05, uom: 'KGS' },
        { code: 'KAPFDBL', qty: 0.0257, uom: 'KGS' },
        { code: 'KADBBK', qty: 0.0129, uom: 'KGS' },
      ],
    },
    {
      sequenceNo: 5,
      stageName: 'LABELLING & PACKING',
      minQtyForNextStage: 200,
      hoursRequiredMinQty: 1,
      components: [
        { code: 'KERA#050623-11', qty: 1, uom: 'PCS' },
        { code: 'UC-311', qty: 0.06, uom: 'NOS' },
        { code: 'RFID-069', qty: 1, uom: 'NOS' },
        { code: 'PKG-CA-2', qty: 1, uom: 'NOS' },
        { code: 'PKG-SF-LD-29', qty: 0.0298, uom: 'KGS' },
        { code: 'PKG-TP-15', qty: 2, uom: 'NOS' },
      ],
    },
  ],
};

// Assign `machineId` dynamically
const machinesWithId = machineData.map((machine) => ({
  ...machine,
  machineId: machine.machineName, // Using `machineName` as `machineId`
}));

// async function initializeCounter() {
//   // Create an initial counter value for 'order_id' with a starting value of 0
//   await Counter.create({ name: "scheduleId", value: 0 });
//   console.log("Counter initialized!");  // Log success message to confirm initialization
// }




const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    // initializeCounter();
    // Check if machines already exist
    const existingMachines = await Machine.find();
    if (existingMachines.length === 0) {
      await Machine.insertMany(machinesWithId);
      console.log('✅ Machines inserted successfully');
    } else {
      console.log('⚠️ Machines already exist. Skipping insertion.');
    }
 const exists = await BOM.findOne({ outputItem: bomData.outputItem });
    if (exists) {
      console.log('BOM already exists, skipping...');
    } else {
      await BOM.create(bomData);
      console.log('BOM inserted successfully');
    }


   // Call the seedBOM function
  //  await seedBOM();

   console.log('✅ Database seeding completed');

  } catch (err) {
    console.error('❌ MongoDB Error:', err.message);
  }
};

module.exports=connectDB;

