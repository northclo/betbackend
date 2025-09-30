import GameSettingModel from "../../../models/GameSetting.js";
import PartnerModel from "../../../models/Partner.js";
import UserModel from "../../../models/User.js";
import { responseBadRequest, responseSuccess, responseUnAutherized } from "../../../helper/response.js";

export const getGameOption = async (req, res) => {
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

    return responseSuccess(res, {
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
    })
}