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
        endDate
    } = req.query;

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate, true);

    let dateFilter = {
        fund_type: 'EXCHANGE'
    };
    if (start || end) {
        dateFilter.createdAt = {};
        if (start) dateFilter.createdAt.$gte = start;
        if (end) dateFilter.createdAt.$lte = end;
    }

    const aggregation = await TransactionModel.aggregate([
        {
            $match: dateFilter
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
                }
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

    // Calculate average exchange rate (if exchange_rate field exists)
    // For now, we'll return a placeholder or calculate from available data
    // This might need to be adjusted based on actual exchange rate storage
    const averageRate = "1,325 ₩/$"; // Placeholder - should be calculated from actual exchange rates

    responseSuccess(res, {
        total_requests: stats.total_requests,
        pending_requests: stats.pending_requests,
        completed_amount: stats.completed_amount,
        average_exchange_rate: averageRate
    });
};

