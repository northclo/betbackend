import PointTransactionModel from "../../../models/PointTransaction.js";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

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

export const getPointUsageSummary = async (req, res) => {
    try {
        let {
            startDate,
            endDate,
            fund_type,
            fund_status
        } = req.query;

        if (startDate && !normalizeDate(startDate)) {
            return responseBadRequest(res, t("invalid_start_date_format"));
        }
        if (endDate && !normalizeDate(endDate, true)) {
            return responseBadRequest(res, t("invalid_end_date_format"));
        }

        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate, true);
        
        if (start && end && start > end) {
            return responseBadRequest(res, t("start_date_before_or_equal_end_date"));
        }

        let dateFilter = {};
        if (start || end) {
            dateFilter.createdAt = {};
            if (start) dateFilter.createdAt.$gte = start;
            if (end) dateFilter.createdAt.$lte = end;
        }

        let typeFilter = {};
        if (fund_type && fund_type !== 'all') {
            if (fund_type === 'CHARGE') {
                typeFilter.fund_type = 'CHARGE';
            } else if (fund_type === 'EXCHANGE') {
                typeFilter.fund_type = 'EXCHANGE';
            } else if (fund_type === 'BETTING') {
                typeFilter.fund_type = 'BETTING';
            }
        } else {
            typeFilter.fund_type = { $in: ['CHARGE', 'EXCHANGE', 'BETTING'] };
        }

        let statusFilter = {};
        if (fund_status && fund_status !== 'all') {
            statusFilter.fund_status = fund_status;
        }

        const filter = {
            ...dateFilter,
            ...typeFilter,
            ...statusFilter
        };

        const stats = await PointTransactionModel.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    inflow: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "CHARGE"] },
                                "$fund_amount",
                                0
                            ]
                        }
                    },
                    exchange_outflow: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "EXCHANGE"] },
                                {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$fund_status", "COMPLETE"] }, then: "$fund_amount" },
                                            { case: { $eq: ["$fund_status", "CANCEL"] }, then: 0 },
                                            { case: { $eq: ["$fund_status", "WAIT"] }, then: "$fund_amount" }
                                        ],
                                        default: "$fund_amount"
                                    }
                                },
                                0
                            ]
                        }
                    },
                    betting_outflow: {
                        $sum: {
                            $cond: [
                                { $eq: ["$fund_type", "BETTING"] },
                                {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$fund_status", "COMPLETE"] }, then: "$fund_amount" },
                                            { case: { $eq: ["$fund_status", "CANCEL"] }, then: 0 },
                                            { case: { $in: ["$fund_status", ["WAIT"]] }, then: "$fund_amount" }
                                        ],
                                        default: "$fund_amount"
                                    }
                                },
                                0
                            ]
                        }
                    },
                    betting_inflow: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$fund_type", "BETTING"] },
                                        { $eq: ["$fund_status", "COMPLETE"] }
                                    ]
                                },
                                { $ifNull: ["$updated_amount", 0] },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const result = stats[0] || {
            count: 0,
            inflow: 0,
            exchange_outflow: 0,
            betting_outflow: 0,
            betting_inflow: 0
        };

        const total_transactions = result.count;
        const total_inflow = result.inflow + result.betting_inflow;
        const total_outflow = result.exchange_outflow + result.betting_outflow;
        const net_change = total_inflow - total_outflow;

        responseSuccess(res, {
            total_transactions,
            total_inflow,
            total_outflow,
            net_change
        });
    } catch (error) {
        console.error("Error to get point usage summary:", error);
        return responseServerError(res);
    }
};
