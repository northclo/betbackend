import TransactionModel from "../../../models/TransactionHistory.js";
import UserModel from "../../../models/User.js";
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

export const getChargingList = async (req, res) => {
    let {
        startDate,
        endDate,
        status,
        page = 1,
        pageSize = 10
    } = req.query;

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate, true);

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
    const skip = (pageNumber - 1) * limit;

    let filter = {};

    // Date filter
    if (start || end) {
        filter.createdAt = {};
        if (start) filter.createdAt.$gte = start;
        if (end) filter.createdAt.$lte = end;
    }

    // Status filter - map frontend status to backend status
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
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "processed_by",
                foreignField: "_id",
                as: "processor"
            }
        },
        {
            $addFields: {
                user: { $arrayElemAt: ["$user", 0] },
                processor: { $arrayElemAt: ["$processor", 0] }
            }
        },
        {
            $facet: {
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: { $toString: "$_id" },
                            id: { $concat: ["REQ-", { $toString: "$_id" }] },
                            member: { 
                                $ifNull: [
                                    { $concat: ["user_", { $toString: "$user._id" }] },
                                    "-"
                                ]
                            },
                            member_nickname: { $ifNull: ["$user.user_nickname", "-"] },
                            amount: "$fund_amount",
                            status: {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ["$fund_status", "PENDING"] }, then: "pending" },
                                        { case: { $eq: ["$fund_status", "APPROVED"] }, then: "completed" },
                                        { case: { $eq: ["$fund_status", "REJECTED"] }, then: "cancelled" }
                                    ],
                                    default: "pending"
                                }
                            },
                            fund_type: "$fund_type",
                            submitted_at: {
                                $dateToString: {
                                    format: "%Y-%m-%d %H:%M",
                                    date: "$createdAt"
                                }
                            },
                            processed_by: {
                                $ifNull: [
                                    "$processor.user_nickname",
                                    "-"
                                ]
                            },
                            processed_at: {
                                $ifNull: [
                                    {
                                        $dateToString: {
                                            format: "%Y-%m-%d %H:%M",
                                            date: "$processed_at"
                                        }
                                    },
                                    "-"
                                ]
                            },
                            createdAt: 1
                        }
                    }
                ],
                total: [
                    { $count: "count" }
                ]
            }
        }
    ]);

    const list = aggregation[0]?.data || [];
    const total =
        aggregation[0]?.total && aggregation[0].total.length
            ? aggregation[0].total[0].count
            : 0;

    responseSuccess(res, {
        list,
        total,
        page: pageNumber,
        pageSize: limit
    });
};

