import mongoose from "mongoose";
import bcrypt from "bcrypt";
import connectDB from "../config/db.js"; // your existing db.js
import PartnerModel from "../models/Partner.js";
import { partnerType } from "../const/type.js";
import dotenv from 'dotenv';
dotenv.config();


(async () => {
  try {
    // Ensure DB connection is ready
    await connectDB();// assuming your db.js exports a connect() function
    console.log('✅ MongoDB connected via db.js');

    // Check if partner already exists
    const existingPartner = await PartnerModel.findOne({ 
      $or: [
        { nickname: 'testadmin' },
        { partner_id: 'testadmin' }
      ]
    });

    if (existingPartner) {
      console.log('⚠️  Partner with nickname "testadmin" or partner_id "testadmin" already exists');
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
      return;
    }

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    const hashedExchangePassword = await bcrypt.hash('admin123', salt);

    // Create new partner
    const newPartner = await PartnerModel.create({
      role: partnerType.headquater,
      nickname: 'testadmin',
      partner_id: 'testadmin',
      password: hashedPassword,
      exchange_password: hashedExchangePassword,
      bank_id: '000', // Placeholder - update with actual bank ID
      bank_number: '0000000000', // Placeholder - update with actual bank account number
      bank_owner_name: 'Test Admin', // Placeholder - update with actual bank owner name
    });

    console.log('✅ New partner created successfully:');
    console.log('   - Role:', newPartner.role);
    console.log('   - Nickname:', newPartner.nickname);
    console.log('   - Partner ID:', newPartner.partner_id);
    console.log('   - ID:', newPartner._id);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();