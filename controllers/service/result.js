import GameResultModel from "../../models/GameResult.js"
import { responseBadRequest } from "../../helper/response.js";
import { config } from "../../config/index.js";
import { io } from '../../server.js'
import { updateBetting } from "../../helper/Betting/Update-Betting.js";
import { getCurrentTime } from "../../helper/Time/Get-Current-Time.js";
import { getAvailableGame } from "../../helper/Game/Get-Available-Game.js";
import moment from "moment-timezone";

const checkIp = (req) => {
    const allowIp = config.ALLOWED_IPS;
    if (!allowIp) return true;

    const allowIps = allowIp.split(",")
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    return allowIps.includes(ip);
}

export const startGame = async (req, res) => {
    if (!req.headers["authorization"] || req.headers["authorization"] !== config.AUTH_KEY) return responseBadRequest(res);
    if (!checkIp(req)) return responseBadRequest(res);

    const { game_id, device_id, time_stamp } = req.body;

    const gameResult = await GameResultModel.findOne({ game_id: game_id });

    if (gameResult) {
        await GameResultModel.updateOne({ game_id: game_id },
            {
                device_id: device_id,
                start_time_stamp: time_stamp
            }
        )
    } else {
        await GameResultModel.create({
            game_id: game_id,
            device_id: device_id,
            start_time_stamp: time_stamp
        })
    }

    setTimeout(() => {
        const serverCurrentTime = getCurrentTime();
        io.emit('start_game', { 
            game_id: game_id,
            start_time_stamp: time_stamp,
            server_current_time: serverCurrentTime
        })
    }, 0);
    // }, time_stamp - getCurrentTime())

    return res.status(200).json({ result: 0 });
}

export const endGame = async (req, res) => {
    if (!req.headers["authorization"] || req.headers["authorization"] !== config.AUTH_KEY) return responseBadRequest(res);
    if (!checkIp(req)) return responseBadRequest(res);

    const { list, manual_valid, total_no, today_no, current_no, time_stamp, game_id, device_id } = req.body;

    const updated_TokyoTime = moment.tz(time_stamp, "Asia/Tokyo");
    var new_today_no = today_no;

    if (updated_TokyoTime) {
      const hours = updated_TokyoTime.hours();
      const minutes = updated_TokyoTime.minutes();
      new_today_no = Math.floor((hours * 60 + minutes) / 3) + 1; // every 3 min = 1 slot
    }
    const gameResult = await GameResultModel.findOne({ game_id: game_id });

    if (!gameResult) return responseBadRequest(res);

    const odd = list[0] % 2 !== 0;
    const under = (Number(list[0]) + Number(list[1]) + Number(list[2])) <= 10.5;

    updateBetting(game_id, odd, under, list, today_no, total_no)

    await GameResultModel.updateOne({ game_id: game_id }, {
        list: list,
        total_no: total_no,
        today_no: new_today_no,
        end_time_stamp: time_stamp,
        current_no: current_no,
        device_id: device_id,
        manual_valid: manual_valid,
        odd: odd,
        under: under
    });

    const availableGames = await getAvailableGame();
    const nextGameTimestamp = availableGames.length > 0 ? availableGames[0].start_time_stamp : null;

    setTimeout(() => {
        const serverCurrentTime = getCurrentTime();
        io.emit('end_game', { 
            time_stamp: time_stamp, 
            game_id,
            next_start_time_stamp: nextGameTimestamp,
            server_current_time: serverCurrentTime
        });
    }, 0);

    return res.status(200).json({ result: 0 });
}

// const updateAllTodayNo = async () => {
//   try {
//     // Fetch all documents that have an updatedAt field
//     const allResults = await GameResultModel.find({});

//     console.log(`Found ${allResults.length} documents to update...`);

//     // Prepare bulk update operations
//     const bulkOps = allResults.map((item) => {
//       const updatedMoment = moment.tz(item.end_time_stamp, "Asia/Tokyo");
//       let new_today_no = item.today_no; // fallback to existing

//       if (updatedMoment) {
//         const hours = updatedMoment.hours();
//         const minutes = updatedMoment.minutes();
//         new_today_no = Math.floor((hours * 60 + minutes) / 3) + 1;
//       }
//       return {
//         updateOne: {
//           filter: { _id: item._id },
//           update: { $set: { today_no: new_today_no } },
//         },
//       };
//     });

//     // Perform all updates in one bulk operation
//     if (bulkOps.length > 0) {
//       const result = await GameResultModel.bulkWrite(bulkOps);
//       console.log("✅ today_no update complete!");
//       console.log("Matched:", result.matchedCount, "Modified:", result.modifiedCount);
//     } else {
//       console.log("No documents to update.");
//     }
//   } catch (error) {
//     console.error("❌ Error updating today_no values:", error);
//   }
// };

// // Run the function
// updateAllTodayNo();