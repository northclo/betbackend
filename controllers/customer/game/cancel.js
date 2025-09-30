import BettingResultModel from "../../../models/BettingResult.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";

export const cancelGame = async (req, res) => {
    const { id } = req.body

    const result = await BettingResultModel.deleteOne({ _id: id });

    if (result.deletedCount > 0) {
        return responseSuccess(res);
    } else {
        return responseBadRequest(res);
    }
}