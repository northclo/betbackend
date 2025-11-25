import UserModel from "../../../models/User.js";
import GameSettingModel from "../../../models/GameSetting.js";
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
        if (!game) {
            const availableGame = await getAvailableGame();
            if (availableGame.length > 0) {
                game = availableGame[0];
            } else {
                game = await getLastGame();
            }
        }
    } else {
        const availableGame = await getAvailableGame();
        if (availableGame.length > 0) {
            game = availableGame[0];
        } else {
            game = await getLastGame();
        }
    }

    if (!game || !game.game_id) {
        return responseSuccess(res, {
            game: {
                id: '',
                list: [],
                odd: null,
                under: null,
                today_no: 0,
                total_no: 0,
                remain_time: 0,
                target_timestamp: 0,
            },
            aroundGameId: { previousGameId: null, nextGameId: null },
            pendingBet: [],
            user: {
                own_money: user?.own_money ?? 0,
            },
            gameSetting: {
                activate: true,
                inactive_message: '',
            }
        });
    }

    const _gameId = game.game_id;

    const { bettingHistory } = await getGameWithBettingHistory(_gameId, userId);
    const aroundGameId = await getAroundGameId(_gameId);
    const lastGame = await getLastGame();

    const todayNo = (game.list?.length === 0) ? lastGame.today_no + 1 : game.today_no;
    const totalNo = (game.list?.length === 0) ? lastGame.total_no + 1 : game.total_no;

    const targetTimestamp = game.start_time_stamp;

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
            target_timestamp: targetTimestamp,
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
};
