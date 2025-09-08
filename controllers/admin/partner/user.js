import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";

export const registerUser = async (req, res) => {
    const payload = req.body;

    const user = await UserModel.findOne({ user_nickname: payload.nickname })

    if (user) {
        return responseBadRequest(res, "Nickname is exist")
    }

    await UserModel.create({
        user_nickname: payload.nickname,
        user_email: payload.nickname + "@gmail.com",
        password: payload.password,
        user_name: payload.userName,
        partner_id: '68bd36e5a329dda1bb0af0dd',
        phone_number: payload.phoneNumber,
        bank_id: payload.bankName,
        bank_number: payload.bankNumber,
        bank_owner_name: payload.bankOwner,
        memo_note: payload.memo,
        simple_bet_rate: payload.simpleBetRate,
        combined_bet_rate: payload.combinedBetRate,
        match_num_bet_rate: payload.matchNumberBetRate,
    })

    responseSuccess(res)
}