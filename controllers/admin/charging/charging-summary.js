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

export const getChargingSummary = async (req, res) => {
    let {
        startDate,
        endDate
    } = req.query;

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate, true);

    let dateFilter = {
        fund_type: 'IMPORT'
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

    // Calculate average processing time (for approved requests with processed_at)
    const approvedTransactions = await TransactionModel.find({
        fund_type: 'IMPORT',
        ...dateFilter,
        fund_status: "APPROVED",
        processed_at: { $exists: true, $ne: null }
    }).select("createdAt processed_at").lean();

    let averageProcessingTime = 0;
    if (approvedTransactions.length > 0) {
        const totalProcessingTime = approvedTransactions.reduce((sum, tx) => {
            const diff = new Date(tx.processed_at) - new Date(tx.createdAt);
            return sum + diff;
        }, 0);
        averageProcessingTime = Math.round(totalProcessingTime / approvedTransactions.length / 1000 / 60); // in minutes
    }

    responseSuccess(res, {
        total_requests: stats.total_requests,
        pending_requests: stats.pending_requests,
        completed_amount: stats.completed_amount,
        average_processing_time: averageProcessingTime > 0 ? `${averageProcessingTime}m` : "0m"
    });
};

