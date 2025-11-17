import mongoose from "mongoose";

import BettingResultModel from "../../../models/BettingResult.js";
import PartnerModel from "../../../models/Partner.js";
import { responseSuccess } from "../../../helper/response.js";

const toObjectId = (value) => {
    if (!value) return null;
    return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

const buildDateFilter = (startDate, endDate) => {
    const dateFilter = {};

    if (startDate) {
        const start = new Date(startDate);
        if (!Number.isNaN(start.getTime())) {
            dateFilter.$gte = start;
        }
    }

    if (endDate) {
        const end = new Date(endDate);
        if (!Number.isNaN(end.getTime())) {
            end.setHours(23, 59, 59, 999);
            dateFilter.$lte = end;
        }
    }

    return dateFilter;
};

const fetchAccessiblePartners = async (adminId) => {
    if (!adminId) return { partnerIds: [], partners: [] };

    const roots = await PartnerModel.aggregate([
        {
            $match: {
                $or: [
                    { admin_id: new mongoose.Types.ObjectId(adminId) },
                    { user_id: new mongoose.Types.ObjectId(adminId) }
                ],
            },
        },
        {
            $graphLookup: {
                from: "partners",
                startWith: "$_id",
                connectFromField: "_id",
                connectToField: "parent_partner_id",
                as: "subs",
            },
        },
        {
            $project: {
                allPartners: { $concatArrays: [["$$ROOT"], "$subs"] },
            },
        },
        { $unwind: "$allPartners" },
        {
            $replaceRoot: { newRoot: "$allPartners" },
        },
        {
            $project: {
                _id: 1,
                nickname: { $ifNull: ["$nickname", ""] },
                partner_id: { $ifNull: ["$partner_id", ""] },
            },
        },
    ]);

    if (!roots.length) {
        return { partnerIds: [], partners: [] };
    }

    const uniqueMap = new Map();
    roots.forEach((doc) => {
        const key = doc._id.toString();
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, {
                id: key,
                nickname: doc.nickname || "",
                partnerId: doc.partner_id || "",
            });
        }
    });

    const partners = Array.from(uniqueMap.values());
    const partnerIds = partners.map((partner) => new mongoose.Types.ObjectId(partner.id));

    return { partnerIds, partners };
};

export const getBettingSettlementProfit = async (req, res) => {
    const { startDate, endDate, partner = "all", page = 1, pageSize = 20 } = req.query;
    const numericPage = Number(page) > 0 ? Number(page) : 1;
    const numericPageSize = Number(pageSize) > 0 ? Number(pageSize) : 20;

    const { partnerIds: accessiblePartnerIds, partners } = await fetchAccessiblePartners(req.session?._id);

    if (!accessiblePartnerIds.length) {
        return responseSuccess(res, {
            summary: {
                totalBetAmount: 0,
                totalPayout: 0,
                totalProfit: 0,
                settledRounds: 0,
            },
            settlements: {
                total: 0,
                page: numericPage,
                pageSize: numericPageSize,
                items: [],
            },
            partners,
        });
    }

    let filteredPartnerIds = accessiblePartnerIds;

    if (partner && partner !== "all") {
        const requestedPartnerId = toObjectId(partner);

        if (requestedPartnerId) {
            const isAccessible = accessiblePartnerIds.some(
                (id) => id.toString() === requestedPartnerId.toString()
            );

            if (!isAccessible) {
                filteredPartnerIds = [];
            } else {
                const partnerWithDescendants = await PartnerModel.aggregate([
                    {
                        $match: {
                            _id: requestedPartnerId,
                        },
                    },
                {
                    $graphLookup: {
                        from: "partners",
                        startWith: "$_id",
                        connectFromField: "_id",
                        connectToField: "parent_partner_id",
                        as: "subs",
                    },
                },
                {
                    $project: {
                        allPartners: { $concatArrays: [["$$ROOT"], "$subs"] },
                    },
                },
                { $unwind: "$allPartners" },
                {
                    $replaceRoot: { newRoot: "$allPartners" },
                },
                    {
                        $project: { _id: 1 },
                    },
                ]);

                const descendantIds = partnerWithDescendants.map((doc) => doc._id.toString());
                filteredPartnerIds = accessiblePartnerIds.filter((id) => descendantIds.includes(id.toString()));
            }
        } else {
            filteredPartnerIds = [];
        }
    }

    if (!filteredPartnerIds.length) {
        return responseSuccess(res, {
            summary: {
                totalBetAmount: 0,
                totalPayout: 0,
                totalProfit: 0,
                settledRounds: 0,
            },
            settlements: {
                total: 0,
                page: numericPage,
                pageSize: numericPageSize,
                items: [],
            },
            partners,
        });
    }

    const dateFilter = buildDateFilter(startDate, endDate);
    const basePipeline = [
        {
            $match: {
                betting_status: "complete",
            },
        },
        {
            $addFields: {
                settled_at: {
                    $ifNull: ["$updatedAt", "$createdAt"],
                },
            },
        },
    ];

    if (Object.keys(dateFilter).length) {
        basePipeline.push({
            $match: {
                settled_at: dateFilter,
            },
        });
    }

    basePipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user",
            },
        },
        {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $addFields: {
                effectivePartnerId: {
                    $ifNull: ["$user.own_partner_id", "$user.partner_id"],
                },
            },
        },
        {
            $match: {
                effectivePartnerId: { $in: filteredPartnerIds },
                user: { $ne: null },
            },
        },
        {
            $lookup: {
                from: "partners",
                localField: "effectivePartnerId",
                foreignField: "_id",
                as: "partner",
            },
        },
        {
            $addFields: {
                partner: {
                    $arrayElemAt: ["$partner", 0],
                },
            },
        }
    );

    const aggregation = await BettingResultModel.aggregate([
        ...basePipeline,
        {
            $facet: {
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalBetAmount: { $sum: { $ifNull: ["$bet_amount", 0] } },
                            totalPayout: { $sum: { $ifNull: ["$earning_amount", 0] } },
                            roundHashes: {
                                $addToSet: {
                                    $concat: [
                                        { $toString: { $ifNull: ["$effectivePartnerId", ""] } },
                                        "|",
                                        {
                                            $cond: [
                                                { $ifNull: ["$total_no", false] },
                                                { $toString: "$total_no" },
                                                { $ifNull: ["$game_id", ""] },
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    },
                ],
                totalCount: [
                    {
                        $addFields: {
                            normalizedRoundId: {
                                $cond: [
                                    { $ifNull: ["$total_no", false] },
                                    { $toString: "$total_no" },
                                    { $ifNull: ["$game_id", ""] },
                                ],
                            },
                        },
                    },
                    {
                        $group: {
                            _id: {
                                partnerId: "$effectivePartnerId",
                                normalizedRoundId: "$normalizedRoundId",
                            },
                        },
                    },
                    {
                        $count: "total",
                    },
                ],
                settlements: [
                    {
                        $addFields: {
                            normalizedRoundId: {
                                $cond: [
                                    { $ifNull: ["$total_no", false] },
                                    { $toString: "$total_no" },
                                    { $ifNull: ["$game_id", ""] },
                                ],
                            },
                        },
                    },
                    {
                        $group: {
                            _id: {
                                partnerId: "$effectivePartnerId",
                                normalizedRoundId: "$normalizedRoundId",
                                totalNo: "$total_no",
                                todayNo: "$today_no",
                                gameId: "$game_id",
                            },
                            betAmount: { $sum: { $ifNull: ["$bet_amount", 0] } },
                            payout: { $sum: { $ifNull: ["$earning_amount", 0] } },
                            settledAt: { $max: "$settled_at" },
                            partnerName: { $first: { $ifNull: ["$partner.nickname", ""] } },
                            partnerCode: { $first: { $ifNull: ["$partner.partner_id", ""] } },
                        },
                    },
                    {
                        $addFields: {
                            profit: { $subtract: ["$betAmount", "$payout"] },
                        },
                    },
                    {
                        $sort: { settledAt: -1 },
                    },
                    {
                        $skip: (numericPage - 1) * numericPageSize,
                    },
                    {
                        $limit: numericPageSize,
                    },
                ],
            },
        },
        {
            $addFields: {
                summary: {
                    $let: {
                        vars: { summary: { $arrayElemAt: ["$summary", 0] } },
                        in: {
                            totalBetAmount: { $ifNull: ["$$summary.totalBetAmount", 0] },
                            totalPayout: { $ifNull: ["$$summary.totalPayout", 0] },
                            totalProfit: {
                                $subtract: [
                                    { $ifNull: ["$$summary.totalBetAmount", 0] },
                                    { $ifNull: ["$$summary.totalPayout", 0] },
                                ],
                            },
                            settledRounds: {
                                $size: { $ifNull: ["$$summary.roundHashes", []] },
                            },
                        },
                    },
                },
            },
        },
        {
            $project: {
                summary: 1,
                totalCount: 1,
                settlements: 1,
            },
        },
    ]);

    const [{ summary, totalCount, settlements }] = aggregation || [
        { summary: {}, totalCount: [{ total: 0 }], settlements: [] },
    ];

    const totalItems = totalCount?.[0]?.total || 0;
    const paginatedItems = (Array.isArray(settlements) ? settlements : []).map((item) => {
        if (!item || typeof item !== "object") {
            return {
                partnerId: "",
                totalNo: null,
                todayNo: null,
                gameId: "",
                betAmount: 0,
                payout: 0,
                profit: 0,
                settledAt: null,
                partnerName: "",
                partnerCode: "",
            };
        }

        const id = item._id || {};
        return {
            partnerId: id.partnerId?.toString() || "",
            totalNo: id.totalNo ?? null,
            todayNo: id.todayNo ?? null,
            gameId: id.gameId || "",
            betAmount: Number.isFinite(item.betAmount) ? Number(item.betAmount) : 0,
            payout: Number.isFinite(item.payout) ? Number(item.payout) : 0,
            profit: Number.isFinite(item.profit) ? Number(item.profit) : 0,
            settledAt: item.settledAt || null,
            partnerName: item.partnerName || "",
            partnerCode: item.partnerCode || "",
        };
    });

    return responseSuccess(res, {
        summary: {
            totalBetAmount: Number.isFinite(summary?.totalBetAmount) ? Number(summary.totalBetAmount) : 0,
            totalPayout: Number.isFinite(summary?.totalPayout) ? Number(summary.totalPayout) : 0,
            totalProfit: Number.isFinite(summary?.totalProfit) ? Number(summary.totalProfit) : 0,
            settledRounds: Number.isFinite(summary?.settledRounds) ? Number(summary.settledRounds) : 0,
        },
        settlements: {
            total: Number.isFinite(totalItems) ? Number(totalItems) : 0,
            page: numericPage,
            pageSize: numericPageSize,
            items: Array.isArray(paginatedItems) ? paginatedItems : [],
        },
        partners: Array.isArray(partners) ? partners : [],
    });
};

