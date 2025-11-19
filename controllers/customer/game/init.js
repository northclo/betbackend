import UserModel from "../../../models/User.js";
import GameSettingModel from "../../../models/GameSetting.js";
import { responseBadRequest, responseSuccess, responseServerError } from "../../../helper/response.js";
import { getCurrentTime } from "../../../helper/Time/Get-Current-Time.js";
import { getAvailableGame } from "../../../helper/Game/Get-Available-Game.js";
import { getAroundGameId } from "../../../helper/Game/Get-Around-GameId.js";
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
        if (gameId) {
            const result = await getGameWithBettingHistory(gameId);
            game = result.game;
        } else {
            const availableGame = await getAvailableGame();
            if (availableGame.length > 0) {
                game = availableGame[0];
            } else {
                game = await getLastGame();
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
            
            const existingTestGame = await GameResultModel.findOne({
                start_time_stamp: { $gte: currentTime, $lte: currentTime + 180000 },
                end_time_stamp: { $exists: false }
            });
            
            let remainTime = 0;
            let gameId = '';
            
            if (existingTestGame) {
                gameId = existingTestGame.game_id;
                remainTime = Math.floor((existingTestGame.start_time_stamp - currentTime) / 1000);
            } else {
                const testGame = await GameResultModel.create({
                    game_id: uuidv4(),
                    device_id: "test-device",
                    start_time_stamp: testGameStartTime,
                    total_no: lastTotalNo + 1,
                    today_no: lastTodayNo + 1,
                });
                gameId = testGame.game_id;
                remainTime = Math.floor((testGameStartTime - currentTime) / 1000);
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
                    remain_time: remainTime,
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

        const { bettingHistory } = await getGameWithBettingHistory(_gameId, userId);
        const aroundGameId = await getAroundGameId(_gameId);
        const lastGame = await getLastGame();
        const lastTodayNo = Number.isFinite(lastGame?.today_no) ? lastGame.today_no : 0;
        const lastTotalNo = Number.isFinite(lastGame?.total_no) ? lastGame.total_no : 0;

        const hasResult = Array.isArray(game.list) && game.list.length > 0;
        const todayNo = hasResult ? (game.today_no ?? lastTodayNo) : lastTodayNo + 1;
        const totalNo = hasResult ? (game.total_no ?? lastTotalNo) : lastTotalNo + 1;

        const pendingGames = await getAvailableGame();
        let remainTime = 0;
        if (pendingGames.length > 0) {
            remainTime = Math.max(
                0,
                Math.floor((pendingGames[0].start_time_stamp - getCurrentTime()) / 1000)
            );
        }

        if (remainTime === 0 && !gameId) {
            const GameResultModel = (await import("../../../models/GameResult.js")).default;
            const { v4: uuidv4 } = await import("uuid");
            const currentTime = getCurrentTime();
            const testGameStartTime = currentTime + 180000;

            const existingTestGame = await GameResultModel.findOne({
                start_time_stamp: { $gte: currentTime, $lte: currentTime + 180000 },
                end_time_stamp: { $exists: false }
            });

            if (!existingTestGame) {
                await GameResultModel.create({
                    game_id: uuidv4(),
                    device_id: "test-device",
                    start_time_stamp: testGameStartTime,
                    total_no: lastTotalNo + 1,
                    today_no: lastTodayNo + 1,
                });
                remainTime = Math.floor((testGameStartTime - currentTime) / 1000);
            }
        }

        const gameSetting = await GameSettingModel.findOne({ name: 'PowerballGame' }).lean();
        const isGameActivated = gameSetting?.activate !== false;
        const inactiveMessage = gameSetting?.inactive_message || '';

        return responseSuccess(res, {
            game: {
                id: _gameId,
                list: game.list || [],
                odd: game.odd,
                under: game.under,
                today_no: todayNo,
                total_no: totalNo,
                remain_time: remainTime,
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
