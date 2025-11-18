import TransactionModel from "../../../models/TransactionHistory.js";
import { responseSuccess } from "../../../helper/response.js";

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
            'pending': 'PENDING',
            'completed': 'APPROVED',
            'cancelled': 'REJECTED'
        };
        if (statusMap[status]) {
            filter.fund_status = statusMap[status];
        }
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
                        $cond: [{ $eq: ["$fund_status", "PENDING"] }, 1, 0]
                    }
                },
                completed_amount: {
                    $sum: {
                        $cond: [
                            { $eq: ["$fund_status", "APPROVED"] },
                            "$fund_amount",
                            0
                        ]
                    }
                },
                pending_amount: {
                    $sum: {
                        $cond: [
                            { $eq: ["$fund_status", "PENDING"] },
                            "$fund_amount",
                            0
                        ]
                    }
                },
                approved_count: {
                    $sum: {
                        $cond: [{ $eq: ["$fund_status", "APPROVED"] }, 1, 0]
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

    responseSuccess(res, {
        total_requests: stats.total_requests,
        pending_requests: stats.pending_requests,
        completed_amount: stats.completed_amount
    });
};

