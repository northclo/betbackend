import BettingResultModel from "../../../models/BettingResult.js";
import { responseSuccess, responseBadRequest, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import mongoose from "mongoose";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const bulkDeleteBettingList = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

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

        const filter = {
            _id: { $in: validIds }
        };

        const allAccessibleIds = [...accessibleUserIds, ...accessiblePartnerIds];
        if (allAccessibleIds.length > 0) {
            filter.user_id = { $in: allAccessibleIds };
        } else {
            return responseSuccess(
                res,
                { deletedCount: 0 },
                t("no_records_to_delete")
            );
        }

        const result = await BettingResultModel.deleteMany(filter);

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

