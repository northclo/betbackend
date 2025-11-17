import mongoose from "mongoose";
import bcrypt from "bcrypt";
import gameResultService from '../services/gameResultService.js';
import connectDB from "../config/db.js"; // your existing db.js
import UserModel from "../models/User.js";
import PartnerModel from "../models/Partner.js";
import AdminModel from "../models/Admin.js";
import { userStatus } from "../const/status.js";
import { partnerType } from "../const/type.js";
import dotenv from 'dotenv';
dotenv.config();

const createTestData = gameResultService.createTestData;

const createTestUsers = async () => {
  // Create test customer user
  const existingCustomer = await UserModel.findOne({ user_email: 'customer@test.com' });
  if (!existingCustomer) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('customer123', salt);
    
    const customerUser = await UserModel.create({
      user_nickname: 'customer_test',
      user_email: 'customer@test.com',
      password: hashedPassword,
      user_name: 'Test Customer',
      own_money: 10000,
      user_status: userStatus.normal,
      user_level: 1
    });
    console.log('✅ Created test customer user: customer@test.com / customer123');
    console.log('   User ID:', customerUser._id);
  } else {
    console.log('ℹ️  Test customer user already exists');
  }

  // Create test admin/partner user
  const existingAdmin = await UserModel.findOne({ user_email: 'admin@test.com' });
  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    const adminUser = await UserModel.create({
      user_nickname: 'admin_test',
      user_email: 'admin@test.com',
      password: hashedPassword,
      user_name: 'Test Admin',
      user_status: userStatus.normal,
      user_level: 1
    });
    
    // Create partner for admin
    const partner = await PartnerModel.create({
      role: partnerType.headquater,
      nickname: 'Test Admin Partner',
      partner_id: 'TEST_ADMIN_PARTNER',
      user_id: adminUser._id,
      dashboard_access_permission: true,
      sub_partner_creation_permission: true,
      user_creation_permission: true,
      bet_rate_type: 'A'
    });
    
    // Update admin user with partner ID
    await UserModel.findByIdAndUpdate(adminUser._id, {
      own_partner_id: partner._id
    });
    
    console.log('✅ Created test admin user: admin@test.com / admin123');
    console.log('   User ID:', adminUser._id);
    console.log('   Partner ID:', partner._id);
  } else {
    console.log('ℹ️  Test admin user already exists');
  }
};

const createTestAdmin = async () => {
  const existingAdmin = await AdminModel.findOne({ admin_id: 'testadmin' });
  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    const admin = await AdminModel.create({
      admin_id: 'testadmin',
      admin_nickname: 'Test_Admin',
      password: hashedPassword,
      is_active: true,
      password_change_time: new Date()
    });
    
    console.log('✅ Created test admin: testadmin / admin123');
    console.log('   Admin ID:', admin._id);
  } else {
    console.log('ℹ️  Test admin already exists');
  }
};

(async () => {
  try {
    // Ensure DB connection is ready
    await connectDB();// assuming your db.js exports a connect() function
    console.log('✅ MongoDB connected via db.js');

    // Create test users first
    await createTestUsers();

    // Create test admin
    await createTestAdmin();

    // Run the test data creation
    if (createTestData) {
      await createTestData();
    }

    // Disconnect after seeding
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating test data:', err);
    process.exit(1);
  }
})();