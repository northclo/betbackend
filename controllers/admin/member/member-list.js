import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const getMemberList = async (req, res) => {
    try {
        let {
            duration = "import_exchange_betting",
            startDate,
            endDate,
            userStatus,
            partnerId,
            includeSubPartners,
            searchField,
            search,
            sort = "created_date",
            page = 1,
            pageSize = 10
        } = req.query;

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.max(Math.min(parseInt(pageSize, 10) || 10, 100), 1);
        const skip = (pageNumber - 1) * limit;

        const normalizeDate = (value, isEnd = false) => {
            if (!value) return null;
            if (typeof value !== 'string') return null;
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return null;
            if (isEnd) {
                date.setHours(23, 59, 59, 999);
            }
            return date;
        };

        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate, true);

        if (startDate && !start) {
            return responseBadRequest(res, t("invalid_start_date"));
        }
        if (endDate && !end) {
            return responseBadRequest(res, t("invalid_end_date"));
        }
        if (start && end && start > end) {
            return responseBadRequest(res, t("start_date_before_end_date"));
        }

        let filter = {};

        if (userStatus) {
            filter.user_status = userStatus;
        }

        const searchRegex = search ? new RegExp(search, "i") : null;
        if (search && searchField) {
            const textFieldMap = {
                user_nickname: "user_nickname",
                memo: "memo_note",
                bank_owner: "bank_owner_name",
                phone_number: "phone_number",
                bank_account: "bank_number",
                recommended_user: "recommend_id"
            };

            switch (searchField) {
                case "cash_remained_over":
                case "cash_remained_under": {
                    const amount = Number(search);
                    if (!Number.isNaN(amount)) {
                        const operator = searchField === "cash_remained_over" ? "$gte" : "$lte";
                        filter.own_money = {
                            ...(filter.own_money || {}),
                            [operator]: amount
                        };
                    }
                    break;
                }
                case "user_id": {
                    filter.$and = filter.$and || [];
                    const idConditions = [
                        { user_email: searchRegex },
                        { user_name: searchRegex }
                    ];
                    filter.$and.push({
                        $or: [
                            ...idConditions,
                            {
                                $expr: {
                                    $regexMatch: {
                                        input: { $toString: "$_id" },
                                        regex: searchRegex.source,
                                        options: searchRegex.flags
                                    }
                                }
                            }
                        ]
                    });
                    break;
                }
                default: {
                    const fieldName = textFieldMap[searchField];
                    if (fieldName) {
                        filter[fieldName] = searchRegex;
                    }
                    break;
                }
            }
        }

        if (partnerId) {
            try {
                const partner = await PartnerModel.findOne({ partner_id: partnerId }).select("_id").lean();
                if (!partner) {
                    return responseBadRequest(res, t("partner_not_found"));
                }
                
                const partnerObjectId = partner._id;
                let targetPartnerIds = [partnerObjectId];
                
                if (includeSubPartners === 'true') {
                    const getSubPartnerIds = async (parentId) => {
                        const subPartners = await PartnerModel.find({ parent_partner_id: parentId }).select("_id").lean();
                        const subIds = subPartners.map(p => p._id);
                        let allSubIds = [...subIds];
                        for (const subId of subIds) {
                            const nestedSubs = await getSubPartnerIds(subId);
                            allSubIds = [...allSubIds, ...nestedSubs];
                        }
                        return allSubIds;
                    };
                    const subPartnerIds = await getSubPartnerIds(partnerObjectId);
                    targetPartnerIds = [partnerObjectId, ...subPartnerIds];
                }
                
                const partnerFilter = {
                    partner_id: { $in: targetPartnerIds }
                };
                if (filter.$and) {
                    filter.$and.push(partnerFilter);
                } else if (filter.$or) {
                    filter.$and = [filter.$or, partnerFilter];
                    delete filter.$or;
                } else {
                    Object.assign(filter, partnerFilter);
                }
            } catch (error) {
                console.error("Error fetching partner:", error);
                return responseBadRequest(res, t("error_processing_partner_filter"));
            }
        }

        const isCreatedDate = duration === "created_date" && (start || end);
        const isPasswordChangedDate = duration === "password_changed_date" && (start || end);
        const isConnectedDate = duration === "connected_date" && (start || end);
        const isLastImportDate = duration === "last_import_date" && (start || end);
        const applyFundDateFilter = (duration === "import_exchange_betting" || duration === "last_import_date") && (start || end);
        const applyBettingDateFilter = duration === "import_exchange_betting" && (start || end);

        if (isCreatedDate) {
            if (start) filter.createdAt = { ...(filter.createdAt || {}), $gte: start };
            if (end) filter.createdAt = { ...(filter.createdAt || {}), $lte: end };
        }

        if (isPasswordChangedDate) {
            if (start) filter.password_change_time = { ...(filter.password_change_time || {}), $gte: start.getTime() };
            if (end) filter.password_change_time = { ...(filter.password_change_time || {}), $lte: end.getTime() };
        }

        const buildRangeQuery = () => {
            const range = {};
            if (start) range.$gte = start;
            if (end) range.$lte = end;
            return Object.keys(range).length ? range : null;
        };

        const bettingDateRange = applyBettingDateFilter ? buildRangeQuery() : null;
        const fundDateRange = applyFundDateFilter ? buildRangeQuery() : null;

        const basePipeline = [
            { $match: filter },
            {
                $addFields: {
                    own_money: { $ifNull: ["$own_money", 0] }
                }
            },
            {
                $lookup: {
                    from: "partners",
                    localField: "partner_id",
                    foreignField: "_id",
                    as: "partners"
                }
            },
            {
                $addFields: {
                    partner: {
                        $cond: {
                            if: { $gt: [{ $size: "$partners" }, 0] },
                            then: { $arrayElemAt: ["$partners", 0] },
                            else: null
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "user_login_histories",
                    let: { userId: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$user_id", "$$userId"] } } },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { createdAt: 1 } }
                    ],
                    as: "login_history"
                }
            },
            {
                $addFields: {
                    last_login_time: { $arrayElemAt: ["$login_history.createdAt", 0] }
                }
            },
            {
                $unwind: {
                    path: "$login_history",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "betting_results",
                    let: { userId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$user_id", "$$userId"] },
                                ...(bettingDateRange ? { createdAt: bettingDateRange } : {})
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalEarningAmount: { $sum: "$earning_amount" },
                                totalWinCount: {
                                    $sum: {
                                        $cond: [{ $eq: ["$win", true] }, 1, 0]
                                    }
                                },
                                totalBettingAmount: { $sum: "$bet_amount" }
                            }
                        }
                    ],
                    as: "betting_stats"
                }
            },
            {
                $lookup: {
                    from: "transaction_histories",
                    let: { userId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$user_id", "$$userId"] },
                                fund_status: "COMPLETE",
                                ...(fundDateRange ? { createdAt: fundDateRange } : {})
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalImportAmount: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$fund_type", "CHARGE"] },
                                            "$fund_amount",
                                            0
                                        ]
                                    }
                                },
                                totalExchangeAmount: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ["$fund_type", "EXCHANGE"] },
                                            "$fund_amount",
                                            0
                                        ]
                                    }
                                },
                                lastImportTime: {
                                    $max: {
                                        $cond: [
                                            { $eq: ["$fund_type", "CHARGE"] },
                                            "$createdAt",
                                            null
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    as: "fund_stats"
                }
            },
            {
                $lookup: {
                    from: "users",
                    let: { partnerId: "$partner_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $ne: ["$$partnerId", null] },
                                        { $eq: ["$partner_id", "$$partnerId"] }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: "betting_results",
                                let: { memberId: "$_id" },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: { $eq: ["$user_id", "$$memberId"] },
                                            ...(bettingDateRange ? { createdAt: bettingDateRange } : {})
                                        }
                                    },
                                    {
                                        $group: {
                                            _id: null,
                                            memberEarning: { $sum: "$earning_amount" }
                                        }
                                    }
                                ],
                                as: "member_earnings"
                            }
                        },
                        {
                            $addFields: {
                                memberEarning: {
                                    $ifNull: [{ $arrayElemAt: ["$member_earnings.memberEarning", 0] }, 0]
                                }
                            }
                        },
                        { $group: { _id: null, partnerTotalEarning: { $sum: "$memberEarning" } } }
                    ],
                    as: "partner_earnings"
                }
            },
            {
                $addFields: {
                    totalEarningAmount: {
                        $ifNull: [{ $arrayElemAt: ["$betting_stats.totalEarningAmount", 0] }, 0]
                    },
                    totalWinCount: {
                        $ifNull: [{ $arrayElemAt: ["$betting_stats.totalWinCount", 0] }, 0]
                    },
                    totalBettingAmount: {
                        $ifNull: [{ $arrayElemAt: ["$betting_stats.totalBettingAmount", 0] }, 0]
                    },
                    totalImportAmount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.totalImportAmount", 0] }, 0]
                    },
                    totalExchangeAmount: {
                        $ifNull: [{ $arrayElemAt: ["$fund_stats.totalExchangeAmount", 0] }, 0]
                    },
                    last_import_time: {
                        $arrayElemAt: ["$fund_stats.lastImportTime", 0]
                    },
                    totalPartnerEarning: {
                        $ifNull: [{ $arrayElemAt: ["$partner_earnings.partnerTotalEarning", 0] }, 0]
                    }
                }
            }
        ];

        if (isConnectedDate) {
            const loginMatch = {};
            if (start || end) {
                const dateCondition = {};
                if (start) dateCondition.$gte = start;
                if (end) dateCondition.$lte = end;
                loginMatch.last_login_time = dateCondition;
                basePipeline.push({ $match: loginMatch });
            }
        }

        if (isLastImportDate) {
            const importMatch = {};
            if (start) {
                importMatch.last_import_time = { ...(importMatch.last_import_time || {}), $gte: start };
            }
            if (end) {
                importMatch.last_import_time = { ...(importMatch.last_import_time || {}), $lte: end };
            }
            if (Object.keys(importMatch).length) {
                basePipeline.push({ $match: importMatch });
            }
        }

        basePipeline.push(
            {
                $project: {
                    betting_stats: 0,
                    partner_earnings: 0,
                    fund_stats: 0,
                    partners: 0
                }
            },
            {
                $addFields: {
                    user_id: { $toString: "$_id" }
                }
            }
        );

        const parseSort = (value) => {
            if (!value) return ["created_date", -1];
            const [field, direction = "desc"] = value.split(":");
            return [field, direction.toLowerCase() === "asc" ? 1 : -1];
        };

        const [sortField, sortDirection] = parseSort(sort);
        let sortStage;
        switch (sortField) {
            case "created_date":
                sortStage = { createdAt: sortDirection };
                break;
            case "owned_money":
                sortStage = { own_money: sortDirection };
                break;
            case "owned_point":
                sortStage = { point: sortDirection };
                break;
            case "connect_date":
                sortStage = { last_login_time: sortDirection };
                break;
            case "import_money":
                sortStage = { totalImportAmount: sortDirection };
                break;
            case "exchange_money":
                sortStage = { totalExchangeAmount: sortDirection };
                break;
            default:
                sortStage = { createdAt: -1 };
        }

        const aggregation = await UserModel.aggregate([
            {
                $facet: {
                    data: [
                        ...basePipeline,
                        { $sort: sortStage },
                        { $skip: skip },
                        { $limit: limit }
                    ],
                    total: [
                        ...basePipeline,
                        { $count: "count" }
                    ]
                }
            }
        ]);

        const users = aggregation[0]?.data || [];
        const total =
            aggregation[0]?.total && aggregation[0].total.length
                ? aggregation[0].total[0].count
                : 0;

        const statusCountFilter = { ...filter };
        delete statusCountFilter.user_status;

        if (isCreatedDate) {
            if (start) statusCountFilter.createdAt = { ...(statusCountFilter.createdAt || {}), $gte: start };
            if (end) statusCountFilter.createdAt = { ...(statusCountFilter.createdAt || {}), $lte: end };
        }

        if (isPasswordChangedDate) {
            if (start) statusCountFilter.password_change_time = { ...(statusCountFilter.password_change_time || {}), $gte: start.getTime() };
            if (end) statusCountFilter.password_change_time = { ...(statusCountFilter.password_change_time || {}), $lte: end.getTime() };
        }

        const statusCounts = await UserModel.aggregate([
            { $match: statusCountFilter },
            {
                $group: {
                    _id: "$user_status",
                    count: { $sum: 1 }
                }
            }
        ]);

        const counts = {
            all: total,
            normal: 0,
            wait: 0,
            stop: 0,
            cancel: 0,
            danger: 0,
            tester: 0
        };

        statusCounts.forEach(item => {
            if (item._id && counts.hasOwnProperty(item._id)) {
                counts[item._id] = item.count;
            }
        });

        responseSuccess(res, {
            list: users,
            total,
            page: pageNumber,
            pageSize: limit,
            statusCounts: counts
        });
    } catch (error) {
        console.error("Error to get member list:", error);
        return responseServerError(res);
    }
};


export const getMemberById = async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return responseBadRequest(res, t("user_id_required"));
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return responseBadRequest(res, t("invalid_user_id_format"));
        }

        const user = await UserModel.findById(id).lean();
        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }

        return responseSuccess(res, user);
    } catch (error) {
        console.error("Error to get member by id:", error);
        return responseServerError(res);
    }
};

export const updateMemberList = async (req, res) => {
    try {
        const { _id, password, exchange_secure_number, ...updateData } = req.body;

        if (!_id) {
            return responseBadRequest(res, t("user_id_required"));
        }

        if (!mongoose.Types.ObjectId.isValid(_id)) {
            return responseBadRequest(res, t("invalid_user_id_format"));
        }

        const user = await UserModel.findById(_id);
        if (!user) {
            return responseBadRequest(res, t("user_not_found"));
        }

        if (updateData.user_nickname !== undefined) {
            const nickname = updateData.user_nickname?.trim();
            if (!nickname) {
                return responseBadRequest(res, t("nickname_required"));
            }
            const nicknameRegex = /^[a-zA-Z0-9]{2,10}$/;
            if (!nicknameRegex.test(nickname)) {
                return responseBadRequest(res, t("user_nickname_invalid_format"));
            }
            const existingUserByNickname = await UserModel.findOne({ 
                user_nickname: nickname,
                _id: { $ne: user._id }
            });
            if (existingUserByNickname) {
                return responseBadRequest(res, t("user_nickname_exists"));
            }
        }

        if (updateData.user_email !== undefined) {
            const email = updateData.user_email?.trim();
            if (!email) {
                return responseBadRequest(res, t("email_required"));
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return responseBadRequest(res, t("invalid_email_format"));
            }
            const existingUserByEmail = await UserModel.findOne({ 
                user_email: email,
                _id: { $ne: user._id }
            });
            if (existingUserByEmail) {
                return responseBadRequest(res, t("user_email_already_exists"));
            }
        }

        if (updateData.user_name !== undefined) {
            const userName = updateData.user_name?.trim();
            if (!userName) {
                return responseBadRequest(res, t("user_name_required"));
            }
            const userNameRegex = /^[a-zA-Z0-9]{4,12}$/;
            if (!userNameRegex.test(userName)) {
                return responseBadRequest(res, t("invalid_user_name_format"));
            }
            const existingUserByName = await UserModel.findOne({ 
                user_name: userName,
                _id: { $ne: user._id }
            });
            if (existingUserByName) {
                return responseBadRequest(res, t("user_name_already_exists"));
            }
        }

        if (updateData.bank_owner_name !== undefined) {
            const bankOwnerName = updateData.bank_owner_name?.trim();
            if (!bankOwnerName) {
                return responseBadRequest(res, t("bank_owner_name_required"));
            }
        }

        if (password) {
            if (password.trim().length < 6) {
                return responseBadRequest(res, t("password_min_length_6"));
            }
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        if (exchange_secure_number) {
            const salt = await bcrypt.genSalt(10);
            updateData.exchange_secure_number = await bcrypt.hash(exchange_secure_number, salt);
        }

        await UserModel.updateOne({ _id }, updateData);
        return responseSuccess(res);
    } catch (error) {
        console.error("Error to update member list:", error);
        return responseServerError(res);
    }
}

export const createMemberList = async (req, res) => {
    try {
        const { user_nickname, user_email, password, exchange_secure_number, partner_id, ...otherData } = req.body;

        if (!user_nickname || !user_email) {
            return responseBadRequest(res, t("user_nickname_email_required"));
        }

        if (!password) {
            return responseBadRequest(res, t("password_required"));
        }

        if (password.length < 6) {
            return responseBadRequest(res, t("password_min_length_6"));
        }

        const existingUser = await UserModel.findOne({ user_email });
        if (existingUser) {
            return responseBadRequest(res, t("user_email_already_exists"));
        }

        if (partner_id && !mongoose.Types.ObjectId.isValid(partner_id)) {
            return responseBadRequest(res, t("invalid_partner_id_format"));
        }

        if (partner_id) {
            const partner = await PartnerModel.findById(partner_id);
            if (!partner) {
                return responseBadRequest(res, t("partner_not_found"));
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const exchangePasswordToHash = exchange_secure_number;
        const hashedExchangePassword = await bcrypt.hash(exchangePasswordToHash, salt);

        await UserModel.create({
            user_nickname,
            user_email,
            password: hashedPassword,
            exchange_secure_number: hashedExchangePassword,
            ownpartner_id: partner_id || undefined,
            bank_id: otherData.bank_id || '',
            bank_number: otherData.bank_number || '',
            bank_owner_name: otherData.bank_owner_name || '',
            ...otherData
        });

        return responseSuccess(res);
    } catch (error) {
        console.error("Error to create member list:", error);
        return responseServerError(res);
    }
}

export const deleteMemberList = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return responseBadRequest(res, t("user_id_required"));
        }

        const ids = id.split(',').map(id => id.trim()).filter(id => id.length > 0);

        if (ids.length === 0) {
            return responseBadRequest(res, t("at_least_one_valid_user_id_required"));
        }

        const invalidIds = ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return responseBadRequest(res, t("invalid_user_id_format_list", invalidIds.join(', ')));
        }

        const users = await UserModel.find({ _id: { $in: ids } }).select('_id').lean();
        const foundIds = users.map(user => user._id.toString());
        const notFoundIds = ids.filter(id => !foundIds.includes(id));

        if (notFoundIds.length > 0) {
            return responseBadRequest(res, `Users not found: ${notFoundIds.join(', ')}`);
        }

        await UserModel.deleteMany({
            _id: { $in: ids }
        });

        return responseSuccess(res);
    } catch (error) {
        console.error("Error to delete member list:", error);
        return responseServerError(res);
    }
}