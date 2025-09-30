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
