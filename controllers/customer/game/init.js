import UserModel from "../../../models/User.js";
import GameSettingModel from "../../../models/GameSetting.js";
import { responseBadRequest, responseSuccess, responseServerError } from "../../../helper/response.js";
import { getCurrentTime } from "../../../helper/Time/Get-Current-Time.js";
import { getAvailableGame } from "../../../helper/Game/Get-Available-Game.js";
import { getAroundBettingHistory } from "../../../helper/Game/Get-Around-Betting-History.js";
import { getLastGame } from "../../../helper/Game/Get-Last-Game.js";
import { getGameWithBettingHistory } from "../../../helper/Game/Get-Game.js";
import { t } from "../../../helper/translation.js";

export const getGameInitInfo = async (req, res) => {
    try {
        const { gameId } = req.query;
        const userId = req.session._id;

        const user = await UserModel.findOne({ _id: userId });
        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }

        let game;
        let bettingHistory = [];
        
        if (gameId) {
            const result = await getGameWithBettingHistory(gameId, userId);
            game = result.game;
            bettingHistory = result.bettingHistory;
        } else {
            const availableGame = await getAvailableGame();
            if (availableGame.length > 0) {
                game = availableGame[0];
            } else {
                game = await getLastGame();
            }
            if (game && game.game_id) {
                const result = await getGameWithBettingHistory(game.game_id, userId);
                bettingHistory = result.bettingHistory;
            }
        }

        if (!game || !game.game_id) {
            const lastGame = await getLastGame();
            const lastTodayNo = Number.isFinite(lastGame?.today_no) ? lastGame.today_no : 0;
            const lastTotalNo = Number.isFinite(lastGame?.total_no) ? lastGame.total_no : 0;
            const GameResultModel = (await import("../../../models/GameResult.js")).default;
            const { v4: uuidv4 } = await import("uuid");
            const currentTime = getCurrentTime();
            const testGameStartTime = currentTime + 180000;
            const nextTodayNo = lastTodayNo + 1;
            const nextTotalNo = lastTotalNo + 1;
            
            // Check for existing game by time window OR by round numbers to prevent duplicates
            const existingTestGame = await GameResultModel.findOne({
                $or: [
                    {
                        start_time_stamp: { $gte: currentTime, $lte: currentTime + 180000 },
                        end_time_stamp: { $exists: false }
                    },
                    {
                        total_no: nextTotalNo,
                        today_no: nextTodayNo
                    }
                ]
            });
            
            let targetTimestamp = 0;
            let gameId = '';
            
            if (existingTestGame) {
                gameId = existingTestGame.game_id;
                targetTimestamp = existingTestGame.start_time_stamp;
            // } else {
            //     try {
            //         const testGame = await GameResultModel.create({
            //             game_id: uuidv4(),
            //             device_id: "test-device",
            //             start_time_stamp: testGameStartTime,
            //             total_no: nextTotalNo,
            //             today_no: nextTodayNo,
            //         });
            //         gameId = testGame.game_id;
            //         targetTimestamp = testGameStartTime;
            //     } catch (error) {
            //         if (error.code === 11000) {
            //             const duplicateGame = await GameResultModel.findOne({
            //                 total_no: nextTotalNo,
            //                 today_no: nextTodayNo
            //             });
            //             if (duplicateGame) {
            //                 gameId = duplicateGame.game_id;
            //                 targetTimestamp = duplicateGame.start_time_stamp;
            //             }
            //         } else {
            //             throw error;
            //         }
            //     }
            }
            
            const gameSetting = await GameSettingModel.findOne({ name: 'PowerballGame' }).lean();
            const isGameActivated = gameSetting?.activate !== false;
            const inactiveMessage = gameSetting?.inactive_message || '';

            return responseSuccess(res, {
                game: {
                    id: gameId,
                    list: [],
                    odd: false,
                    under: false,
                    today_no: lastTodayNo,
                    total_no: lastTotalNo,
                    target_timestamp: targetTimestamp,
                    remain_time: Math.floor((targetTimestamp - currentTime) / 1000),
                },
                aroundGameId: { previousGameId: null, nextGameId: null },
                pendingBet: [],
                user: {
                    own_money: user.own_money ?? 0,
                },
                gameSetting: {
                    activate: isGameActivated,
                    inactive_message: inactiveMessage,
                }
            });
        }

        const _gameId = game.game_id;

        const aroundGameId = await getAroundBettingHistory(_gameId, userId);
        const lastGame = await getLastGame();
        const lastTodayNo = Number.isFinite(lastGame?.today_no) ? lastGame.today_no : 0;
        const lastTotalNo = Number.isFinite(lastGame?.total_no) ? lastGame.total_no : 0;

        const hasResult = Array.isArray(game.list) && game.list.length > 0;
        const todayNo = hasResult ? (game.today_no ?? lastTodayNo) : lastTodayNo + 1;
        const totalNo = hasResult ? (game.total_no ?? lastTotalNo) : lastTotalNo + 1;

        const pendingGames = await getAvailableGame();
        let targetTimestamp = 0;
        if (pendingGames.length > 0) {
            targetTimestamp = pendingGames[0].start_time_stamp;
        }

        // if (targetTimestamp === 0 && !gameId) {
        //     const GameResultModel = (await import("../../../models/GameResult.js")).default;
        //     const { v4: uuidv4 } = await import("uuid");
        //     const currentTime = getCurrentTime();
        //     const testGameStartTime = currentTime + 180000;
        //     const nextTodayNo = lastTodayNo + 1;
        //     const nextTotalNo = lastTotalNo + 1;

        //     const existingTestGame = await GameResultModel.findOne({
        //         $or: [
        //             {
        //                 start_time_stamp: { $gte: currentTime, $lte: currentTime + 180000 },
        //                 end_time_stamp: { $exists: false }
        //             },
        //             {
        //                 total_no: nextTotalNo,
        //                 today_no: nextTodayNo
        //             }
        //         ]
        //     });

        //     if (existingTestGame) {
        //         targetTimestamp = existingTestGame.start_time_stamp;
        //     } else {
        //         try {
        //             await GameResultModel.create({
        //                 game_id: uuidv4(),
        //                 device_id: "test-device",
        //                 start_time_stamp: testGameStartTime,
        //                 total_no: nextTotalNo,
        //                 today_no: nextTodayNo,
        //             });
        //             targetTimestamp = testGameStartTime;
        //         } catch (error) {
        //             if (error.code === 11000) {
        //                 const duplicateGame = await GameResultModel.findOne({
        //                     total_no: nextTotalNo,
        //                     today_no: nextTodayNo
        //                 });
        //                 if (duplicateGame) {
        //                     targetTimestamp = duplicateGame.start_time_stamp;
        //                 }
        //             } else {
        //                 throw error;
        //             }
        //         }
        //     }
        // }

        const gameSetting = await GameSettingModel.findOne({ name: 'PowerballGame' }).lean();
        const isGameActivated = gameSetting?.activate !== false;
        const inactiveMessage = gameSetting?.inactive_message || '';
        const currentTime = getCurrentTime();

        return responseSuccess(res, {
            game: {
                id: _gameId,
                list: game.list || [],
                odd: game.odd ?? false,
                under: game.under ?? false,
                today_no: todayNo,
                total_no: totalNo,
                target_timestamp: targetTimestamp,
                remain_time: targetTimestamp > 0 ? Math.floor((targetTimestamp - currentTime) / 1000) : 0,
            },
            aroundGameId,
            pendingBet: bettingHistory,
            user: {
                own_money: user.own_money ?? 0,
            },
            gameSetting: {
                activate: isGameActivated,
                inactive_message: inactiveMessage,
            }
        });
    } catch (error) {
        console.error("Error getting game init info:", error);
        return responseServerError(res);
    }
};
