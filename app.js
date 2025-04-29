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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server time:", new Date());
  console.log("Server timezone offset (minutes from UTC):", new Date().getTimezoneOffset());
  console.log(`Server is running on port ${PORT}`);

});