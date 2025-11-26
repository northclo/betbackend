import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

const normalizeDate = (value, isEnd = false) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    if (isEnd) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }
    return date;
};

export const getExchangeSummary = async (req, res) => {
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
        const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

        let {
            startDate,
            endDate,
            status
        } = req.query;

        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate, true);

        let filter = {
            fund_type: 'EXCHANGE'
        };
        if (start || end) {
            filter.createdAt = {};
            if (start) filter.createdAt.$gte = start;
            if (end) filter.createdAt.$lte = end;
        }

        if (status && status !== 'all') {
            const statusMap = {
                'pending': 'WAIT',
                'completed': 'COMPLETE',
                'cancelled': 'CANCEL'
            };
            if (statusMap[status]) {
                filter.fund_status = statusMap[status];
            }
        }

        const allAccessibleIds = [...accessibleUserIds, ...accessiblePartnerIds];
        if (allAccessibleIds.length > 0) {
            filter.user_id = { $in: allAccessibleIds };
        } else {
            filter.user_id = { $in: [] };
        }

        const aggregation = await TransactionModel.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: null,
                    total_requests: { $sum: 1 },
                    pending_requests: {
                        $sum: {
                            $cond: [{ $eq: ["$fund_status", "WAIT"] }, 1, 0]
                        }
                    },
                    completed_amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_status", "COMPLETE"] },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    pending_amount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_status", "WAIT"] },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    approved_count: {
                        $sum: {
                            $cond: [{ $eq: ["$fund_status", "COMPLETE"] }, 1, 0]
                        }
                    },
                }
            }
        ]);

        const stats = aggregation[0] || {
            total_requests: 0,
            pending_requests: 0,
            completed_amount: 0,
            pending_amount: 0,
            approved_count: 0
        };

        return responseSuccess(res, {
            total_requests: stats.total_requests,
            pending_requests: stats.pending_requests,
            completed_amount: stats.completed_amount
        });
    } catch (error) {
        console.error("Error fetching exchange summary:", error);
        return responseServerError(res);
    }
};

