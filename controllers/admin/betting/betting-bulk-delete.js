import BettingResultModel from "../../../models/BettingResult.js";
import { responseSuccess, responseBadRequest, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import mongoose from "mongoose";

export const bulkDeleteBettingList = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return responseBadRequest(res, t("betting_ids_required"));
        }

        const validIds = ids
            .map(id => {
                if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
                    return new mongoose.Types.ObjectId(id);
                }
                return null;
            })
            .filter(Boolean);

        if (validIds.length === 0) {
            return responseBadRequest(res, t("no_valid_betting_ids"));
        }

        const result = await BettingResultModel.deleteMany({
            _id: { $in: validIds }
        });

        const message = t("successfully_deleted_betting_records");
        const formattedMessage = message && message.includes("{0}") 
            ? message.replace("{0}", result.deletedCount.toString())
            : message || t("successfully_deleted_items").replace("{count}", result.deletedCount.toString());

        return responseSuccess(
            res,
            { deletedCount: result.deletedCount },
            formattedMessage
        );
    } catch (error) {
        console.error("Error bulk deleting betting records:", error);
        return responseServerError(res);
    }
};

