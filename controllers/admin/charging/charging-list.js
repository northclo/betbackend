import TransactionModel from "../../../models/TransactionHistory.js";
import PartnerModel from "../../../models/Partner.js";
import mongoose from "mongoose";
import { responseSuccess, responseServerError, responseUnAutherized } from "../../../helper/response.js";
import { fetchAccessiblePartnerIds } from "../../../helper/Partner/fetch-accessible-partners.js";

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
    try {
        const adminId = req?.session?._id;
        if (!adminId) {
            return responseUnAutherized(res);
        }

        const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);

        let {
            startDate,
            endDate,
            status,
            keywordType,
            keyword,
            partnerId,
            includeSubPartners,
            page = 1,
            pageSize = 10
        } = req.query;

        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate, true);

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
        const skip = (pageNumber - 1) * limit;

        let filter = {
            fund_type: 'CHARGE'
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

        const pipeline = [
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
                    localField: "action_user_id",
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
        ];

        if (keyword && keyword.trim() && keywordType) {
            const keywordRegex = { $regex: keyword.trim(), $options: 'i' };
            if (keywordType === 'user_nickname') {
                pipeline.push({
                    $match: {
                        'user.user_nickname': keywordRegex
                    }
                });
            } else if (keywordType === 'user_id') {
                try {
                    const userIdObjectId = new mongoose.Types.ObjectId(keyword.trim());
                    pipeline.push({
                        $match: {
                            $or: [
                                { user_id: userIdObjectId },
                                { 'user.user_nickname': keywordRegex }
                            ]
                        }
                    });
                } catch (error) {
                    pipeline.push({
                        $match: {
                            'user.user_nickname': keywordRegex
                        }
                    });
                }
            }
        }

        pipeline.push({
            $lookup: {
                from: "partners",
                localField: "user.ownpartner_id",
                foreignField: "_id",
                as: "userPartner"
            }
        });
        pipeline.push({
            $lookup: {
                from: "partners",
                localField: "user.partner_id",
                foreignField: "_id",
                as: "userOwnPartner"
            }
        });
        pipeline.push({
            $addFields: {
                userPartner: { $arrayElemAt: ["$userPartner", 0] },
                userOwnPartner: { $arrayElemAt: ["$userOwnPartner", 0] }
            }
        });

        let filterPartnerIds = [];
        
        if (partnerId) {
            const includeSubs = includeSubPartners === 'true' || includeSubPartners === true;
            
            const requestedPartner = await PartnerModel.findOne({ partner_id: partnerId }).select("_id").lean();
            if (!requestedPartner) {
                filterPartnerIds = [];
            } else {
                const isAccessible = accessiblePartnerIds.some(id => id.toString() === requestedPartner._id.toString());
                
                if (isAccessible) {
                    if (includeSubs) {
                        const subPartnerIds = await fetchAccessiblePartnerIds(requestedPartner._id);
                        filterPartnerIds = subPartnerIds;
                    } else {
                        filterPartnerIds = [requestedPartner._id];
                    }
                } else {
                    filterPartnerIds = [];
                }
            }
        } else {
            filterPartnerIds = accessiblePartnerIds;
        }

        if (filterPartnerIds.length > 0) {
            pipeline.push({
                $match: {
                    'userPartner._id': { $in: filterPartnerIds }
                }
            });
        } else {
            return responseSuccess(res, {
                list: [],
                total: 0,
                page: pageNumber,
                pageSize: limit
            });
        }

        pipeline.push(
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
                                user_id: {
                                    $ifNull: [
                                        { $toString: "$user._id" },
                                        "-"
                                    ]
                                },
                                user_nickname: { $ifNull: ["$user.user_nickname", "-"] },
                                user_role: "$userRole",
                                partner_id: {
                                    $ifNull: [
                                        "$userOwnPartner.partner_id",
                                        "-"
                                    ]
                                },
                                member: { 
                                    $ifNull: [
                                        { $concat: ["user_", { $toString: "$user._id" }] },
                                        "-"
                                    ]
                                },
                                member_nickname: { $ifNull: ["$user.user_name", "-"] },
                                amount: "$fund_amount",
                                account_amount: { $ifNull: ["$user.own_money", "-"] },
                                status: {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$fund_status", "WAIT"] }, then: "pending" },
                                            { case: { $eq: ["$fund_status", "COMPLETE"] }, then: "completed" },
                                            { case: { $eq: ["$fund_status", "CANCEL"] }, then: "cancelled" }
                                        ],
                                        default: "pending"
                                    }
                                },
                                fund_type: "$fund_type",
                                comment: { $ifNull: ["$comment", ""] },
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
                                                date: "$fund_status_update_date"
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
        );

        const aggregation = await TransactionModel.aggregate(pipeline);

        const list = aggregation[0]?.data || [];
        const total =
            aggregation[0]?.total && aggregation[0].total.length
                ? aggregation[0].total[0].count
                : 0;

        return responseSuccess(res, {
            list,
            total,
            page: pageNumber,
            pageSize: limit
        });
    } catch (error) {
        console.error("Error fetching charging list:", error);
        return responseServerError(res);
    }
};

