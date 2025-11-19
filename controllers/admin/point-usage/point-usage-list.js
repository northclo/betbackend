import PointTransactionModel from "../../../models/PointTransaction.js";
import UserModel from "../../../models/User.js";
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

export const getPointUsageList = async (req, res) => {
    try {
        let {
            startDate,
            endDate,
            type,
            member,
            page = 1,
            pageSize = 10
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

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
        const skip = (pageNumber - 1) * limit;

        let dateFilter = {};
        if (start || end) {
            dateFilter.createdAt = {};
            if (start) dateFilter.createdAt.$gte = start;
            if (end) dateFilter.createdAt.$lte = end;
        }

        let typeFilter = {};
        if (type && type !== 'all') {
            if (type === 'earn') {
                typeFilter.point_type = 'EARN';
            } else if (type === 'spend') {
                typeFilter.point_type = 'SPEND';
            }
        }

        let memberFilter = {};
        if (member) {
            try {
                const memberRegex = new RegExp(member, 'i');
                const users = await UserModel.find({
                    $or: [
                        { user_nickname: memberRegex },
                        { user_email: memberRegex },
                        { _id: member }
                    ]
                }).select('_id').lean();
                
                const userIds = users.map(u => u._id);
                if (userIds.length > 0) {
                    memberFilter.user_id = { $in: userIds };
                } else {
                    return responseSuccess(res, {
                        list: [],
                        total: 0,
                        page: pageNumber,
                        pageSize: limit
                    });
                }
            } catch (error) {
                console.error("Error fetching users for member filter:", error);
                return responseServerError(res);
            }
        }

        const filter = {
            ...dateFilter,
            ...typeFilter,
            ...memberFilter
        };
        const result = await PointTransactionModel.aggregate([
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
                $addFields: {
                    user: { $arrayElemAt: ["$user", 0] }
                }
            },
            {
                $project: {
                    _id: { $toString: "$_id" },
                    id: {
                        $concat: [
                            "PT-",
                            { $toString: "$_id" }
                        ]
                    },
                    member: {
                        $ifNull: [
                            { $concat: ["user_", { $toString: "$user._id" }] },
                            "-"
                        ]
                    },
                    member_nickname: { $ifNull: ["$user.user_nickname", "-"] },
                    type: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$point_type", "EARN"] }, then: "earn" },
                                { case: { $eq: ["$point_type", "SPEND"] }, then: "spend" }
                            ],
                            default: "earn"
                        }
                    },
                    points: {
                        $cond: {
                            if: { $eq: ["$point_type", "SPEND"] },
                            then: { $multiply: ["$point_amount", -1] },
                            else: "$point_amount"
                        }
                    },
                    balance_after: "$balance_after",
                    description: { $ifNull: ["$description", ""] },
                    processed_at: {
                        $dateToString: {
                            format: "%Y-%m-%d %H:%M",
                            date: "$createdAt"
                        }
                    },
                    createdAt: "$createdAt",
                    sortDate: "$createdAt"
                }
            },
            {
                $sort: { sortDate: -1 }
            },
            {
                $facet: {
                    total: [{ $count: "count" }],
                    data: [
                        { $skip: skip },
                        { $limit: limit }
                    ]
                }
            }
        ]);

        const total = result[0]?.total[0]?.count || 0;
        const paginatedData = result[0]?.data || [];

        responseSuccess(res, {
            list: paginatedData,
            total,
            page: pageNumber,
            pageSize: limit
        });
    } catch (error) {
        console.error("Error fetching point usage list:", error);
        return responseServerError(res);
    }
};

