import mongoose from "mongoose";
import createTestData from '../services/gameResultService.js';
import connectDB from "../config/db.js"; // your existing db.js
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  try {
    // Ensure DB connection is ready
    await connectDB();// assuming your db.js exports a connect() function
    console.log('✅ MongoDB connected via db.js');

    // Run the test data creation
    await createTestData();

    // Disconnect after seeding
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating test data:', err);
    process.exit(1);
  }
})();