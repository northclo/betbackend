import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const updateChargingStatus = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

        const { transactionId, action } = req.body;

        if (!transactionId) {
            return responseBadRequest(res, t("transaction_id_required"));
        }

        if (!action || !['approve', 'reject'].includes(action)) {
            return responseBadRequest(res, t("invalid_action"));
        }

        const transaction = await TransactionModel.findById(transactionId);

        if (!transaction) {
            return responseBadRequest(res, t("transaction_not_found"));
        }

        if (transaction.fund_status !== 'WAIT') {
            return responseBadRequest(res, t("transaction_not_pending"));
        }

        if (transaction.fund_type !== 'CHARGE') {
            return responseBadRequest(res, t("only_import_transactions"));
        }

        const user = await UserModel.findById(transaction.user_id);

        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }

        if (!accessibleUserIds.some(aid => aid.toString() === user._id.toString())) {
            return responseBadRequest(res, t("transaction_not_found"));
        }

        const newStatus = action === 'approve' ? 'COMPLETE' : 'CANCEL';

        // Update transaction status
        transaction.fund_status = newStatus;
        transaction.action_user_id = adminId;
        transaction.fund_status_update_date = new Date();
        await transaction.save();

        if (action === 'approve') {
            await UserModel.findByIdAndUpdate(
                transaction.user_id,
                {
                    $inc: {
                        own_money: transaction.fund_amount
                    }
                }
            );
        }

        return responseSuccess(
            res,
            {
                transactionId: transaction._id,
                status: newStatus,
                action: action
            },
            action === 'approve' ? t("transaction_approved_successfully") : t("transaction_rejected_successfully")
        );
    } catch (error) {
        console.error("Error updating charging status:", error);
        return responseServerError(res);
    }
};

