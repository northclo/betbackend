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

const fetchAccessiblePartners = async (userId) => {
    if (!userId) return { partnerIds: [], partners: [] };

    const roots = await PartnerModel.aggregate([
        {
            $match: {
                user_id: new mongoose.Types.ObjectId(userId),
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
            const partnerWithDescendants = await PartnerModel.aggregate([
                {
                    $match: {
                        _id: requestedPartnerId,
                        _id: { $in: accessiblePartnerIds },
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
            $unwind: "$user",
        },
        {
            $match: {
                "user.own_partner_id": { $in: filteredPartnerIds },
            },
        },
        {
            $lookup: {
                from: "partners",
                localField: "user.own_partner_id",
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
                                        { $toString: { $ifNull: ["$user.own_partner_id", ""] } },
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
                settlements: [
                    {
                        $group: {
                            _id: {
                                partnerId: "$user.own_partner_id",
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
                settlements: 1,
            },
        },
    ]);

    const [{ summary, settlements }] = aggregation || [{ summary: {}, settlements: [] }];

    const totalItems = settlements.length;
    const startIndex = (numericPage - 1) * numericPageSize;
    const endIndex = startIndex + numericPageSize;
    const paginatedItems = settlements.slice(startIndex, endIndex).map((item) => ({
        partnerId: item._id.partnerId?.toString() || "",
        totalNo: item._id.totalNo ?? null,
        todayNo: item._id.todayNo ?? null,
        gameId: item._id.gameId || "",
        betAmount: item.betAmount || 0,
        payout: item.payout || 0,
        profit: item.profit || 0,
        settledAt: item.settledAt || null,
        partnerName: item.partnerName || "",
        partnerCode: item.partnerCode || "",
    }));

    return responseSuccess(res, {
        summary: {
            totalBetAmount: summary?.totalBetAmount || 0,
            totalPayout: summary?.totalPayout || 0,
            totalProfit: summary?.totalProfit || 0,
            settledRounds: summary?.settledRounds || 0,
        },
        settlements: {
            total: totalItems,
            page: numericPage,
            pageSize: numericPageSize,
            items: paginatedItems,
        },
        partners,
    });
};

