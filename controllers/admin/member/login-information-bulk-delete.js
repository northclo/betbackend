import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
import { responseSuccess, responseBadRequest, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import mongoose from "mongoose";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const bulkDeleteLoginInformation = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return responseBadRequest(res, t("login_information_ids_required"));
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
            return responseBadRequest(res, t("no_valid_login_information_ids"));
        }

        const filter = {
            _id: { $in: validIds }
        };

        if (accessibleUserIds.length > 0) {
            filter.user_id = { $in: accessibleUserIds };
        } else {
            return responseSuccess(
                res,
                { deletedCount: 0 },
                t("no_records_to_delete")
            );
        }

        const result = await UserLoginHistoryModel.deleteMany(filter);

        const message = t("successfully_deleted_login_information_records");
        const formattedMessage = message && message.includes("{0}") 
            ? message.replace("{0}", result.deletedCount.toString())
            : message || t("successfully_deleted_items").replace("{count}", result.deletedCount.toString());

        return responseSuccess(
            res,
            { deletedCount: result.deletedCount },
            formattedMessage
        );
    } catch (error) {
        console.error("Error bulk deleting login information:", error);
        return responseServerError(res);
    }
};

