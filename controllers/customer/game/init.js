import BettingResultModel from "../../../models/BettingResult.js";
import GameResultModel from "../../../models/GameResult.js";
import GameSettingModel from "../../../models/GameSetting.js";
import PartnerModel from "../../../models/Partner.js";
import UserModel from "../../../models/User.js";
import { responseBadRequest, responseSuccess, responseUnAutherized } from "../../../helper/response.js"

export const getGameInitInfo = async (req, res) => {
    const userId = req.session._id;

    const user = await UserModel.findOne({ _id: userId });
    if (!user) {
        return responseUnAutherized(res)
    }

    const partnerId = user.own_partner_id || user.partner_id || ''
    if (!partnerId) {
        return responseBadRequest(res);
    }

    const partner = await PartnerModel.findOne({ _id: partnerId });
    const gameSetting = await GameSettingModel.find();
    const option = gameSetting[0]?.option.filter(item => item.name == partner.bet_rate_type);
    const game = await GameResultModel.find({ end_time_stamp: { $exists: false } }).sort({ createdAt: -1 });
    const pendingBet = await BettingResultModel.find({ user_id: userId, win: { $exists: false } }).select({
        _id: 1,
        game_id: 1,
        betting_type: 1,
        betting_rate: 1,
        bet_amount: 1,
        number_sort: 1,
    }).sort({ createdAt: -1 });

    responseSuccess(res, {
        option: {
            odd: option[0].odd,
            even: option[0].even,
            under: option[0].under,
            over: option[0].over,
            odd_under: option[0].odd_under,
            odd_over: option[0].odd_over,
            even_under: option[0].even_under,
            even_over: option[0].even_over,
            match_number1: option[0].match_number1,
            match_number2: option[0].match_number2,
            match_number3: option[0].match_number3,
        },
        game: {
            id: game[0].game_id,
            today_no: game[0].today_no || 123,
            total_no: game[0].total_no || 1123,
            remain_time: Math.floor((game[0].start_time_stamp - Date.now()) / 1000) + 918480,
        },
        pendingBet: pendingBet,
        user: {
            own_money: user.own_money
        }
    })
}