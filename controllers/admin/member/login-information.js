import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
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
    return date.getTime();
};

const buildSearchStage = (searchField, searchRegex) => {
    if (!searchRegex) return [];

    switch (searchField) {
        case "user_nickname":
            return [{ $match: { "user.user_nickname": searchRegex } }];
        case "user_id":
            return [
                {
                    $match: {
                        $or: [
                            { "user.user_name": searchRegex },
                            { "user.user_email": searchRegex },
                            { user_id_text: searchRegex },
                        ],
                    },
                },
            ];
        case "distributor":
            return [
                {
                    $match: {
                        $or: [
                            { "own_partner.nickname": searchRegex },
                            { "own_partner.partner_id": searchRegex },
                            { "partner.nickname": searchRegex },
                            { "partner.partner_id": searchRegex },
                        ],
                    },
                },
            ];
        case "ip_address":
            return [{ $match: { ip_address: searchRegex } }];
        case "location":
            return [{ $match: { location: searchRegex } }];
        case "organ":
            return [{ $match: { device: searchRegex } }];
        default:
            return [
                {
                    $match: {
                        $or: [
                            { "user.user_nickname": searchRegex },
                            { "user.user_name": searchRegex },
                            { "user.user_email": searchRegex },
                            { user_id_text: searchRegex },
                            { ip_address: searchRegex },
                            { location: searchRegex },
                            { device: searchRegex },
                            { "own_partner.nickname": searchRegex },
                            { "partner.nickname": searchRegex },
                        ],
                    },
                },
            ];
    }
};

export const getMemberLoginInformation = async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            searchField = "",
            search = "",
            page = 1,
            pageSize = 10,
        } = req.query;

        const start = normalizeDate(startDate);
        const end = normalizeDate(endDate, true);

        const filter = {};
        if (start || end) {
            filter.login_date = {};
            if (start) filter.login_date.$gte = start;
            if (end) filter.login_date.$lte = end;
        }

        const searchRegex = search ? new RegExp(search, "i") : null;

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limit = Math.max(parseInt(pageSize, 10) || 10, 1);
        const skip = (pageNumber - 1) * limit;

        const basePipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: "$user" },
            {
                $lookup: {
                    from: "block_ips",
                    localField: "ip_address",
                    foreignField: "ip_address",
                    as: "block_ip",
                },
            },
            {
                $lookup: {
                    from: "partners",
                    localField: "user.own_partner_id",
                    foreignField: "_id",
                    as: "own_partner",
                },
            },
            {
                $lookup: {
                    from: "partners",
                    localField: "user.partner_id",
                    foreignField: "_id",
                    as: "partner",
                },
            },
            {
                $addFields: {
                    own_partner: { $arrayElemAt: ["$own_partner", 0] },
                    partner: { $arrayElemAt: ["$partner", 0] },
                    block_ip: { $gt: [{ $size: "$block_ip" }, 0] },
                    user_id_text: { $toString: "$user._id" },
                },
            },
        ];

        const searchStages = buildSearchStage(searchField, searchRegex);

        const pipeline = [
            ...basePipeline,
            ...searchStages,
            {
                $facet: {
                    data: [
                        { $sort: { login_date: -1 } },
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $project: {
                                _id: 0,
                                key: { $toString: "$_id" },
                                history_id: { $toString: "$_id" },
                                user_id: "$user_id_text",
                                user_nickname: "$user.user_nickname",
                                own_partner_id: "$own_partner.partner_id",
                                own_partner_nickname: "$own_partner.nickname",
                                own_partner_role: "$own_partner.role",
                                partner_id: "$partner.partner_id",
                                partner_nickname: "$partner.nickname",
                                partner_role: "$partner.role",
                                ip_address: 1,
                                block_ip: 1,
                                location: 1,
                                organ: "$device",
                                mobile: "$mobile",
                                login_time: {
                                    $dateToString: {
                                        format: "%Y-%m-%d %H:%M:%S",
                                        date: { $toDate: "$login_date" },
                                    },
                                },
                            },
                        },
                    ],
                    total: [
                        { $count: "count" },
                    ],
                },
            },
        ];

        const aggregation = await UserLoginHistoryModel.aggregate(pipeline);

        const list = aggregation[0]?.data || [];
        const total = aggregation[0]?.total?.[0]?.count || 0;

        responseSuccess(res, {
            list,
            total,
            page: pageNumber,
            pageSize: limit,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
