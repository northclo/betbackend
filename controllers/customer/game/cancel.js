import BettingResultModel from "../../../models/BettingResult.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";

export const cancelGame = async (req, res) => {
    const { id } = req.body;
    const userId = req.session._id;

    const bettingHistory = await BettingResultModel.findOne({ _id: id });
    const result = await BettingResultModel.deleteOne({ _id: id });
    await UserModel.updateOne({ _id: userId }, { $inc: { own_money: bettingHistory.bet_amount } })

    if (result.deletedCount > 0) {
        return responseSuccess(res, { bettingAmount: bettingHistory.bet_amount });
    } else {
        return responseBadRequest(res);
    }
}