import mongoose from "mongoose";
import connectDB from "../config/db.js";
import BettingResultModel from "../models/BettingResult.js";
import GameResultModel from "../models/GameResult.js";
import dotenv from 'dotenv';
dotenv.config();

const bettingTypes = ["odd", "even", "under", "over", "odd_under", "odd_over", "even_under", "even_over", "number_13", "number_14", "number_16"];
const bettingStatuses = ["WAIT", "PROGRESS", "COMPLETE", "CANCEL"];

// Generate random betting data
const generateBettingData = (userId, gameId, totalNo, todayNo, includeNumbers = true) => {
    const bettingType = bettingTypes[Math.floor(Math.random() * bettingTypes.length)];
    const bettingStatus = bettingStatuses[Math.floor(Math.random() * bettingStatuses.length)];
    const betAmount = Math.floor(Math.random() * 100000) + 1000; // Random between 1000-101000
    const bettingRate = parseFloat((Math.random() * 2 + 1).toFixed(2)); // Random between 1.00-3.00
    
    // Calculate earning and final amounts based on status
    let earningAmount = 0;
    let finalAmount = betAmount;
    let win = false;
    
    if (bettingStatus === "COMPLETE") {
        win = Math.random() > 0.5; // 50% chance of winning
        if (win) {
            earningAmount = Math.floor(betAmount * bettingRate);
            finalAmount = betAmount + earningAmount;
        } else {
            finalAmount = 0; // Lost the bet
        }
    } else if (bettingStatus === "CANCEL") {
        finalAmount = betAmount; // Refunded
    }
    
    // Generate number_sort array (3 random numbers between 1-6)
    const numberSort = Array.from({ length: 3 }, () => Math.floor(Math.random() * 6) + 1);
    
    const bettingData = {
        user_id: userId,
        game_id: gameId,
        betting_type: bettingType,
        betting_rate: bettingRate,
        win: win,
        number_sort: numberSort,
        bet_amount: betAmount,
        earning_amount: earningAmount,
        final_amount: finalAmount,
        betting_status: bettingStatus,
        history_view: true
    };
    
    // Only add total_no and today_no if includeNumbers is true
    if (includeNumbers) {
        bettingData.total_no = totalNo;
        bettingData.today_no = todayNo;
    }
    
    return bettingData;
};

(async () => {
    try {
        // Ensure DB connection is ready
        await connectDB();
        console.log('✅ MongoDB connected via db.js');

        // Use the specified user ID
        const userId = new mongoose.Types.ObjectId('69209740700379e1a161d7a0');
        console.log('✅ Using user ID:', userId.toString());

        // Get or create a test game result
        let testGame = await GameResultModel.findOne().sort({ createdAt: -1 });
        
        if (!testGame) {
            const currentTime = Date.now();
            testGame = await GameResultModel.create({
                list: [1, 2, 3, 4, 5, 6],
                today_no: 1,
                total_no: 1,
                current_no: 1,
                manual_valid: false,
                start_time_stamp: currentTime - 300000, // 5 minutes ago
                end_time_stamp: currentTime,
                game_id: `GAME_${Date.now()}`,
                device_id: 'TEST_DEVICE',
                odd: true,
                under: true
            });
            console.log('✅ Test game created:', testGame.game_id);
        } else {
            console.log('✅ Using existing game:', testGame.game_id);
        }

        // Check if betting records already exist
        const existingBettings = await BettingResultModel.countDocuments({ user_id: userId });
        
        if (existingBettings > 0) {
            console.log(`⚠️  Found ${existingBettings} existing betting records for this user.`);
            console.log('   Delete existing records? (y/n) - For now, creating additional records...');
        }

        // Create multiple betting records
        const numberOfBettings = 50; // Create 50 betting records
        const bettingRecords = [];
        
        for (let i = 0; i < numberOfBettings; i++) {
            const totalNo = testGame.total_no + i;
            const todayNo = testGame.today_no + (i % 10); // Cycle through today_no
            const gameId = testGame.game_id;
            
            // Randomly decide whether to include total_no and today_no (70% chance of including)
            const includeNumbers = Math.random() > 0.3;
            
            const bettingData = generateBettingData(
                userId,
                gameId,
                totalNo,
                todayNo,
                includeNumbers
            );
            
            bettingRecords.push(bettingData);
        }

        // Insert all betting records
        const createdBettings = await BettingResultModel.insertMany(bettingRecords);
        
        console.log(`✅ Successfully created ${createdBettings.length} betting records`);
        console.log('\n📊 Summary:');
        
        // Count records with and without total_no/today_no
        const withNumbers = createdBettings.filter(b => b.total_no !== undefined && b.today_no !== undefined).length;
        const withoutNumbers = createdBettings.length - withNumbers;
        console.log(`   Records with total_no/today_no: ${withNumbers}`);
        console.log(`   Records without total_no/today_no: ${withoutNumbers}`);
        
        // Count by status
        const statusCounts = {};
        bettingStatuses.forEach(status => {
            statusCounts[status] = createdBettings.filter(b => b.betting_status === status).length;
        });
        
        console.log('   Status distribution:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`     - ${status}: ${count}`);
        });
        
        // Count by type
        const typeCounts = {};
        bettingTypes.forEach(type => {
            typeCounts[type] = createdBettings.filter(b => b.betting_type === type).length;
        });
        
        console.log('\n   Betting type distribution:');
        Object.entries(typeCounts).forEach(([type, count]) => {
            if (count > 0) {
                console.log(`     - ${type}: ${count}`);
            }
        });
        
        // Calculate totals
        const totalBetAmount = createdBettings.reduce((sum, b) => sum + (b.bet_amount || 0), 0);
        const totalEarningAmount = createdBettings.reduce((sum, b) => sum + (b.earning_amount || 0), 0);
        const totalFinalAmount = createdBettings.reduce((sum, b) => sum + (b.final_amount || 0), 0);
        const winCount = createdBettings.filter(b => b.win === true).length;
        
        console.log('\n   Financial summary:');
        console.log(`     - Total bet amount: ${totalBetAmount.toLocaleString()}`);
        console.log(`     - Total earning amount: ${totalEarningAmount.toLocaleString()}`);
        console.log(`     - Total final amount: ${totalFinalAmount.toLocaleString()}`);
        console.log(`     - Winning bets: ${winCount}/${createdBettings.length}`);
        
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
})();

