import mongoose from "mongoose";
import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseSuccess, responseBadRequest, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const bulkUpdateChargingStatus = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

        const { transactionIds, action } = req.body;

        if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
            return responseBadRequest(res, t("transaction_ids_required"));
        }

        if (!action || !['approve', 'reject'].includes(action)) {
            return responseBadRequest(res, t("invalid_action"));
        }

        const validIds = transactionIds
            .map(id => {
                const cleanId = String(id).replace(/^REQ-/, "");
                if (mongoose.Types.ObjectId.isValid(cleanId)) {
                    return new mongoose.Types.ObjectId(cleanId);
                }
                return null;
            })
            .filter(id => id !== null);

        if (validIds.length === 0) {
            return responseBadRequest(res, t("no_valid_transaction_ids"));
        }

        const allAccessibleIds = [...accessibleUserIds, ...accessiblePartnerIds];

        const filter = {
            _id: { $in: validIds },
            fund_type: 'CHARGE',
            fund_status: 'WAIT'
        };

        if (allAccessibleIds.length > 0) {
            filter.user_id = { $in: allAccessibleIds };
        } else {
            filter.user_id = { $in: [] };
        }

        const transactions = await TransactionModel.find(filter);

        if (transactions.length === 0) {
            return responseBadRequest(res, t("no_valid_pending_transactions"));
        }

        const newStatus = action === 'approve' ? 'COMPLETE' : 'CANCEL';
        const now = new Date();

        const updateResult = await TransactionModel.updateMany(
            { _id: { $in: transactions.map(t => t._id) } },
            {
                $set: {
                    fund_status: newStatus,
                    action_user_id: adminId,
                    fund_status_update_date: now
                }
            }
        );

        if (action === 'approve') {
            const userAmounts = {};
            transactions.forEach(transaction => {
                const userId = transaction.user_id.toString();
                if (!userAmounts[userId]) {
                    userAmounts[userId] = 0;
                }
                userAmounts[userId] += transaction.fund_amount || 0;
            });

            const updatePromises = Object.entries(userAmounts).map(async ([userId, totalAmount]) => {
                try {
                    let updatedUser = await UserModel.findByIdAndUpdate(
                        userId,
                        { $inc: { own_money: totalAmount } },
                        { new: true }
                    );
                    
                    if (!updatedUser) {
                        await PartnerModel.findByIdAndUpdate(
                            userId,
                            { $inc: { own_money: totalAmount } }
                        );
                    }
                } catch (error) {
                    console.error(`Error updating balance for user ${userId}:`, error);
                }
            });

            await Promise.allSettled(updatePromises);
        }

        return responseSuccess(
            res,
            {
                updatedCount: updateResult.modifiedCount,
                totalCount: transactions.length,
                action: action
            },
            action === 'approve' 
                ? t("transactions_approved_successfully", updateResult.modifiedCount)
                : t("transactions_rejected_successfully", updateResult.modifiedCount)
        );
    } catch (error) {
        console.error("Error bulk updating charging status:", error);
        return responseServerError(res);
    }
};

