import PointTransactionModel from "../../../models/PointTransaction.js";
import UserModel from "../../../models/User.js";
import { responseSuccess, responseBadRequest } from "../../../helper/response.js";
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
    let {
        startDate,
        endDate,
        type,
        member
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
    if (type && type !== 'all') {
        if (type === 'earn') {
            typeFilter.point_type = 'EARN';
        } else if (type === 'spend') {
            typeFilter.point_type = 'SPEND';
        }
    }

    let memberFilter = {};
    if (member) {
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
                total_transactions: 0,
                total_points_earned: 0,
                total_points_spent: 0,
                net_points: 0
            });
        }
    }

    const filter = {
        ...dateFilter,
        ...typeFilter,
        ...memberFilter
    };

    const stats = await PointTransactionModel.aggregate([
        {
            $match: filter
        },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                total_earned: {
                    $sum: {
                        $cond: [
                            { $eq: ["$point_type", "EARN"] },
                            "$point_amount",
                            0
                        ]
                    }
                },
                total_spent: {
                    $sum: {
                        $cond: [
                            { $eq: ["$point_type", "SPEND"] },
                            "$point_amount",
                            0
                        ]
                    }
                }
            }
        }
    ]);

    const result = stats[0] || {
        count: 0,
        total_earned: 0,
        total_spent: 0
    };

    const total_transactions = result.count || 0;
    const total_points_earned = result.total_earned || 0;
    const total_points_spent = result.total_spent || 0;
    const net_points = total_points_earned - total_points_spent;

    responseSuccess(res, {
        total_transactions,
        total_points_earned,
        total_points_spent,
        net_points
    });
};

