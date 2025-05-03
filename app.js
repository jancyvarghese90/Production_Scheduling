const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const connectDB=require( './config/db.js');
const Machine = require('./models/Machine.js');
const orderRoute = require('./routes/orderRoutes.js');
const scheduleRoutes = require('./routes/schedule.js');
const machineRoute = require('./routes/machineRoutes.js');
const User = require('./models/User.js');
const authRoutes=require('./routes/authRoutes.js');
const Schedule = require('./models/Schedule.js');
const axios = require('axios');
const cron = require('node-cron');
const moment = require('moment'); // Import moment for date manipulation
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/order', orderRoute);
app.use('/machines', machineRoute);
app.use('/scheduling', scheduleRoutes);
app.use('/auth', authRoutes);
// Connect to MongoDB
connectDB();
// 👇 Inline cron job logic (runs every minute)
cron.schedule('* * * * *', async () => {
  console.log('Running machine status update cron...');
  const schedules = await Schedule.find();

  if (schedules.length === 0) {
    console.log('No schedules found, skipping machine status updates for now.');
    return;
  }

  const now = moment.utc();
  const API_BASE_URL = 'https://kera-internship.onrender.com/schedule/edit';

  const toActivate = await Schedule.find({
    scheduledStart: { $lte: now.toDate() },
    scheduledEnd: { $gt: now.toDate() },
    status: 'Scheduled',
  });

  if (toActivate.length === 0) {
    console.log('No machines need to be activated at this time.');
  }

  for (const schedule of toActivate) {
    try {
      await axios.put(`${API_BASE_URL}/${schedule.machineID}`, { status: 'Active' });
      console.log(`Activated machine ${schedule.machineID}`);
    } catch (error) {
      console.error(`Failed to activate machine ${schedule.machineID}`, error.message);
    }
  }

  const toIdle = await Schedule.find({
    scheduledEnd: { $lte: now.toDate() },
    status: 'Scheduled',
  });

  for (const schedule of toIdle) {
    try {
      await axios.put(`${API_BASE_URL}/${schedule.machineID}`, { status: 'Idle' });
      console.log(`Idled machine ${schedule.machineID}`);
    } catch (error) {
      console.error(`Failed to idle machine ${schedule.machineID}`, error.message);
    }
  }
});;
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server time:", new Date());
  console.log("Server timezone offset (minutes from UTC):", new Date().getTimezoneOffset());
  console.log(`Server is running on port ${PORT}`);

});