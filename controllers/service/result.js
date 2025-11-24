import GameResultModel from "../../models/GameResult.js"
import BettingResultModel from "../../models/BettingResult.js"
import { responseBadRequest, responseServerError } from "../../helper/response.js";
import { config } from "../../config/index.js";
import { io } from '../../server.js'
import { updateBetting } from "../../helper/Betting/Update-Betting.js";
import moment from "moment-timezone";

export const startGame = async (req, res) => {
    try {
        if (!req.headers["authorization"] || req.headers["authorization"] !== config.AUTH_KEY) return responseBadRequest(res);

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

        await BettingResultModel.updateMany(
            { game_id: game_id, betting_status: "WAIT" },
            { $set: { betting_status: "PROGRESS" } }
        );

        io.emit('start_game', { game_id: game_id, time_stamp: time_stamp });

        return res.status(200).json({ result: 0 });
    } catch (error) {
        console.error("Error to start game:", error);
        return responseServerError(res);
    }
}

export const endGame = async (req, res) => {
    try {
        if (!req.headers["authorization"] || req.headers["authorization"] !== config.AUTH_KEY) return responseBadRequest(res);

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

        let finalGameId = game_id;

        const existingGameWithRound = await GameResultModel.findOne({
            total_no: total_no,
            today_no: new_today_no,
            game_id: { $ne: game_id }
        });

        if (existingGameWithRound) {
            finalGameId = existingGameWithRound.game_id;
            await updateBetting(finalGameId, odd, under, list, new_today_no, total_no);
            
            await GameResultModel.updateOne({ game_id: finalGameId }, {
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

            await BettingResultModel.updateMany(
                { game_id: game_id },
                { $set: { game_id: finalGameId } }
            );
        } else {
            await updateBetting(game_id, odd, under, list, new_today_no, total_no);

            try {
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
            } catch (error) {
                if (error.code === 11000) {
                    const duplicateGame = await GameResultModel.findOne({
                        total_no: total_no,
                        today_no: new_today_no
                    });
                    if (duplicateGame && duplicateGame.game_id !== game_id) {
                        finalGameId = duplicateGame.game_id;
                        await BettingResultModel.updateMany(
                            { game_id: game_id },
                            { $set: { game_id: finalGameId } }
                        );
                        await GameResultModel.updateOne({ game_id: finalGameId }, {
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
                        await updateBetting(finalGameId, odd, under, list, new_today_no, total_no);
                    } else {
                        throw error;
                    }
                } else {
                    throw error;
                }
            }
        }

        io.emit('end_game', { 
            game_id: finalGameId, 
            time_stamp: time_stamp,
            total_no: total_no,
            today_no: new_today_no,
            list: list
        });

        return res.status(200).json({ result: 0 });
    } catch (error) {
        console.error("Error to end game:", error);
        return responseServerError(res);
    }
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