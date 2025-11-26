import TransactionModel from "../../../models/TransactionHistory.js";
import PartnerModel from "../../../models/Partner.js";
import UserModel from "../../../models/User.js";
import mongoose from "mongoose";
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

export const getChargingList = async (req, res) => {
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

        const allAccessibleIds = [...accessibleUserIds, ...accessiblePartnerIds];
        if (allAccessibleIds.length > 0) {
            filter.user_id = { $in: allAccessibleIds };
        } else {
            filter.user_id = { $in: [] };
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
                    from: "partners",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "partner"
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
                    partner: { $arrayElemAt: ["$partner", 0] },
                    processor: { $arrayElemAt: ["$processor", 0] }
                }
            },
            {
                $addFields: {
                    hasPartner: {
                        $and: [
                            { $ne: ["$partner", null] },
                            { $ne: [{ $type: "$partner" }, "missing"] }
                        ]
                    }
                }
            },
            {
                $addFields: {
                    userRole: {
                        $cond: {
                            if: "$hasPartner",
                            then: "partner",
                            else: "user"
                        }
                    },
                    userNickname: {
                        $cond: {
                            if: "$hasPartner",
                            then: { $ifNull: ["$partner.nickname", "-"] },
                            else: { $ifNull: ["$user.user_nickname", "-"] }
                        }
                    },
                    userIdField: {
                        $cond: {
                            if: "$hasPartner",
                            then: {
                                $cond: {
                                    if: { $and: [
                                        { $ne: ["$partner._id", null] },
                                        { $ne: [{ $type: "$partner._id" }, "missing"] }
                                    ]},
                                    then: {
                                        $convert: {
                                            input: "$partner._id",
                                            to: "string",
                                            onError: "-",
                                            onNull: "-"
                                        }
                                    },
                                    else: "-"
                                }
                            },
                            else: {
                                $cond: {
                                    if: { $and: [
                                        { $ne: ["$user._id", null] },
                                        { $ne: [{ $type: "$user._id" }, "missing"] }
                                    ]},
                                    then: {
                                        $convert: {
                                            input: "$user._id",
                                            to: "string",
                                            onError: "-",
                                            onNull: "-"
                                        }
                                    },
                                    else: "-"
                                }
                            }
                        }
                    }
                }
            },
        ];

        if (keyword && keyword.trim() && keywordType) {
            const keywordRegex = { $regex: keyword.trim(), $options: 'i' };
            if (keywordType === 'user_nickname') {
                pipeline.push({
                    $match: {
                        $or: [
                            { 'user.user_nickname': keywordRegex },
                            { 'partner.nickname': keywordRegex }
                        ]
                    }
                });
            } else if (keywordType === 'user_id') {
                try {
                    const userIdObjectId = new mongoose.Types.ObjectId(keyword.trim());
                    pipeline.push({
                        $match: {
                            $or: [
                                { user_id: userIdObjectId },
                                { 'user.user_nickname': keywordRegex },
                                { 'partner.nickname': keywordRegex },
                                { 'partner.partner_id': keywordRegex }
                            ]
                        }
                    });
                } catch (error) {
                    pipeline.push({
                        $match: {
                            $or: [
                                { 'user.user_nickname': keywordRegex },
                                { 'partner.nickname': keywordRegex },
                                { 'partner.partner_id': keywordRegex }
                            ]
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
            $lookup: {
                from: "partners",
                localField: "partner.parent_partner_id",
                foreignField: "_id",
                as: "partnerParentPartner"
            }
        });
        pipeline.push({
            $addFields: {
                userPartner: { 
                    $cond: {
                        if: { $gt: [{ $size: { $ifNull: ["$userPartner", []] }}, 0] },
                        then: { $arrayElemAt: ["$userPartner", 0] },
                        else: null
                    }
                },
                userOwnPartner: { 
                    $cond: {
                        if: { $gt: [{ $size: { $ifNull: ["$userOwnPartner", []] }}, 0] },
                        then: { $arrayElemAt: ["$userOwnPartner", 0] },
                        else: null
                    }
                },
                partnerParentPartner: { 
                    $cond: {
                        if: { $gt: [{ $size: { $ifNull: ["$partnerParentPartner", []] }}, 0] },
                        then: { $arrayElemAt: ["$partnerParentPartner", 0] },
                        else: null
                    }
                }
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
                    $or: [
                        { 'userPartner._id': { $in: filterPartnerIds } },
                        { 'partner._id': { $in: filterPartnerIds } }
                    ]
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
                                user_id: "$userIdField",
                                user_nickname: "$userNickname",
                                user_role: "$userRole",
                                partner_id: {
                                    $ifNull: [
                                        {
                                            $ifNull: [
                                                "$userOwnPartner.partner_id",
                                                "$partnerParentPartner.partner_id"
                                            ]
                                        },
                                        "-"
                                    ]
                                },
                                member: {
                                    $cond: {
                                        if: { $eq: ["$userRole", "partner"] },
                                        then: {
                                            $cond: {
                                                if: { $and: [
                                                    { $ne: ["$partner._id", null] },
                                                    { $ne: [{ $type: "$partner._id" }, "missing"] }
                                                ]},
                                                then: {
                                                    $concat: [
                                                        "partner_",
                                                        {
                                                            $convert: {
                                                                input: "$partner._id",
                                                                to: "string",
                                                                onError: "-",
                                                                onNull: "-"
                                                            }
                                                        }
                                                    ]
                                                },
                                                else: "-"
                                            }
                                        },
                                        else: {
                                            $cond: {
                                                if: { $and: [
                                                    { $ne: ["$user._id", null] },
                                                    { $ne: [{ $type: "$user._id" }, "missing"] }
                                                ]},
                                                then: {
                                                    $concat: [
                                                        "user_",
                                                        {
                                                            $convert: {
                                                                input: "$user._id",
                                                                to: "string",
                                                                onError: "-",
                                                                onNull: "-"
                                                            }
                                                        }
                                                    ]
                                                },
                                                else: "-"
                                            }
                                        }
                                    }
                                },
                                member_nickname: {
                                    $cond: {
                                        if: { $eq: ["$userRole", "partner"] },
                                        then: { $ifNull: ["$partner.partner_id", "-"] },
                                        else: { $ifNull: ["$user.user_name", "-"] }
                                    }
                                },
                                amount: "$fund_amount",
                                account_amount: {
                                    $cond: {
                                        if: { $eq: ["$userRole", "partner"] },
                                        then: { $ifNull: ["$partner.own_money", "-"] },
                                        else: { $ifNull: ["$user.own_money", "-"] }
                                    }
                                },
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

