import UserModel from "../../../models/User.js";
import { responseSuccess } from "../../../helper/response.js";
import { getCurrentTime } from "../../../helper/Time/Get-Current-Time.js";
import { getAvailableGame } from "../../../helper/Game/Get-Available-Game.js";
import { getAroundGameId } from "../../../helper/Game/Get-Around-GameId.js";
import { getLastGame } from "../../../helper/Game/Get-Last-Game.js";
import { getGameWithBettingHistory } from "../../../helper/Game/Get-Game.js";

export const getGameInitInfo = async (req, res) => {
    const { gameId } = req.query;
    const userId = req.session._id;

    const user = await UserModel.findOne({ _id: userId });

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

    // If no game exists in database, try to create a test game
    if (!game || !game.game_id) {
        const lastGame = await getLastGame();
        const GameResultModel = (await import("../../../models/GameResult.js")).default;
        const { v4: uuidv4 } = await import("uuid");
        const currentTime = getCurrentTime();
        const testGameStartTime = currentTime + 180000; // Start in 3 minutes (180 seconds)
        
        // Check if there's already a test game scheduled
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
            // Create a test game
            const testGame = await GameResultModel.create({
                game_id: uuidv4(),
                device_id: "test-device",
                start_time_stamp: testGameStartTime,
                total_no: (lastGame?.total_no || 0) + 1,
                today_no: (lastGame?.today_no || 0) + 1,
            });
            console.log('[getGameInitInfo] Created test game:', testGame.game_id, 'starting in 3 minutes');
            gameId = testGame.game_id;
            remainTime = Math.floor((testGameStartTime - currentTime) / 1000);
        }
        
        return responseSuccess(res, {
            game: {
                id: gameId,
                list: [],
                odd: false,
                under: false,
                today_no: lastGame?.today_no || 0,
                total_no: lastGame?.total_no || 0,
                remain_time: remainTime,
            },
            aroundGameId: { previousGameId: null, nextGameId: null },
            pendingBet: [],
            user: {
                own_money: user?.own_money || 0,
            }
        });
    }

    const _gameId = game.game_id;

    const { bettingHistory } = await getGameWithBettingHistory(_gameId, userId);
    const aroundGameId = await getAroundGameId(_gameId);
    const lastGame = await getLastGame();

    const todayNo = (game.list?.length === 0) ? lastGame.today_no + 1 : game.today_no;
    const totalNo = (game.list?.length === 0) ? lastGame.total_no + 1 : game.total_no;

    let remainTime = 0;
    if (!gameId || (await getAvailableGame()).length > 0) {
        const pendingGame = await getAvailableGame();
        remainTime = Math.floor((pendingGame[0]?.start_time_stamp - getCurrentTime()) / 1000) || 0;
    }
    
    // If no available game exists, create a test game for development (starts in 180 seconds = 3 minutes)
    if (remainTime === 0 && !gameId) {
        const GameResultModel = (await import("../../../models/GameResult.js")).default;
        const { v4: uuidv4 } = await import("uuid");
        const currentTime = getCurrentTime();
        const testGameStartTime = currentTime + 180000; // Start in 3 minutes (180 seconds)
        
        // Check if there's already a test game scheduled
        const existingTestGame = await GameResultModel.findOne({
            start_time_stamp: { $gte: currentTime, $lte: currentTime + 180000 },
            end_time_stamp: { $exists: false }
        });
        
        if (!existingTestGame) {
            // Create a test game
            const testGame = await GameResultModel.create({
                game_id: uuidv4(),
                device_id: "test-device",
                start_time_stamp: testGameStartTime,
                total_no: (lastGame?.total_no || 0) + 1,
                today_no: (lastGame?.today_no || 0) + 1,
            });
            console.log('[getGameInitInfo] Created test game:', testGame.game_id, 'starting in 3 minutes');
            remainTime = Math.floor((testGameStartTime - currentTime) / 1000);
        }
    }

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
            own_money: user.own_money,
        }
    });
};
