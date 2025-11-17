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
        status,
        currency
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

    if (currency && currency !== 'all') {
        const currencyMap = {
            'krw': 'KRW',
            'usd': 'USD',
            'jp': 'JPY',
            'jpy': 'JPY'
        };
        const mappedCurrency = currencyMap[String(currency).toLowerCase()] || String(currency).toUpperCase();

        filter.$or = [
            { currency: mappedCurrency },
            { from_currency: mappedCurrency },
            { to_currency: mappedCurrency }
        ];
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
                avg_exchange_rate: {
                    $avg: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$fund_status", "APPROVED"] },
                                    { $ne: ["$exchange_rate", null] }
                                ]
                            },
                            "$exchange_rate",
                            null
                        ]
                    }
                },
                exchange_rate_count: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ["$fund_status", "APPROVED"] },
                                    { $ne: ["$exchange_rate", null] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const pairAgg = await TransactionModel.aggregate([
        { $match: filter },
        {
            $match: {
                fund_status: "APPROVED",
                exchange_rate: { $ne: null }
            }
        },
        {
            $project: {
                from_currency: 1,
                to_currency: 1,
                currency: 1,
                pair: {
                    $cond: [
                        {
                            $and: [
                                { $ifNull: ["$from_currency", false] },
                                { $ifNull: ["$to_currency", false] }
                            ]
                        },
                        { $concat: ["$from_currency", "/", "$to_currency"] },
                        {
                            $cond: [
                                { $ifNull: ["$to_currency", false] },
                                {
                                    $cond: [
                                        { $ifNull: ["$currency", false] },
                                        { $concat: ["$currency", "/", "$to_currency"] },
                                        "$to_currency"
                                    ]
                                },
                                {
                                    $cond: [
                                        { $ifNull: ["$currency", false] },
                                        "$currency",
                                        "₩/$"
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
        },
        {
            $group: {
                _id: "$pair",
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 1 }
    ]);

    const stats = aggregation[0] || {
        total_requests: 0,
        pending_requests: 0,
        completed_amount: 0,
        pending_amount: 0,
        approved_count: 0,
        avg_exchange_rate: null,
        exchange_rate_count: 0
    };

    const dominantPair = pairAgg[0]?._id || "₩/$";

    let averageRate = `0 ${dominantPair}`;
    if (stats.avg_exchange_rate && stats.exchange_rate_count > 0) {
        const avgRate = Math.round(stats.avg_exchange_rate);
        averageRate = `${avgRate.toLocaleString()} ${dominantPair}`;
    }

    responseSuccess(res, {
        total_requests: stats.total_requests,
        pending_requests: stats.pending_requests,
        completed_amount: stats.completed_amount,
        average_exchange_rate: averageRate
    });
};

