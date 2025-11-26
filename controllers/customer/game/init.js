import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import GameSettingModel from "../../../models/GameSetting.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import { getAvailableGame } from "../../../helper/Game/Get-Available-Game.js";
import { getAroundGameId } from "../../../helper/Game/Get-Around-GameId.js";
import { getLastGame } from "../../../helper/Game/Get-Last-Game.js";
import { getGameWithBettingHistory } from "../../../helper/Game/Get-Game.js";
import { getCurrentTime } from "../../../helper/Time/Get-Current-Time.js";
import { t } from "../../../helper/translation.js";

export const getGameInitInfo = async (req, res) => {
    const { gameId } = req.query;
    const userId = req.session._id;

    let user = await UserModel.findOne({ _id: userId });
    if (!user) {
        user = await PartnerModel.findById(userId).lean();
        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }
    }

    let game;
    let bettingHistory = [];

    if (gameId) {
        const result = await getGameWithBettingHistory(gameId, userId);
        game = result.game;
        bettingHistory = result.bettingHistory;
        if (!game) {
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
    } else {
        const availableGame = await getAvailableGame();
        if (availableGame.length > 0) {
            game = availableGame[0];
        } else {
            game = await getLastGame();
        }
    }

    if (!game || !game.game_id) {
        const serverCurrentTime = getCurrentTime();
        return responseSuccess(res, {
            game: {
                id: '',
                list: [],
                odd: null,
                under: null,
                today_no: 0,
                total_no: 0,
                target_timestamp: 0,
            },
            server_current_time: serverCurrentTime,
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

    const aroundGameId = await getAroundGameId(_gameId, userId);
    const lastGame = await getLastGame();

    const todayNo = (game.list?.length === 0) ? lastGame.today_no + 1 : game.today_no;
    const totalNo = (game.list?.length === 0) ? lastGame.total_no + 1 : game.total_no;

    const targetTimestamp = game.start_time_stamp || 0;
    const serverCurrentTime = getCurrentTime();

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
        server_current_time: serverCurrentTime,
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
