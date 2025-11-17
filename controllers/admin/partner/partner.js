import mongoose from 'mongoose';
import PartnerModel from '../../../models/Partner.js';
import UserModel from '../../../models/User.js';
import { responseBadRequest, responseSuccess } from '../../../helper/response.js';
import { t } from '../../../helper/translation.js';

// Build hierarchical tree from flat partner list
const buildTree = (root) => {
    const map = new Map();
    root.subs.forEach(doc => {
        doc.subs = [];
        map.set(doc._id.toString(), doc);
    });

    root.subs.forEach(doc => {
        if (doc.parent_partner_id && map.has(doc.parent_partner_id.toString())) {
            map.get(doc.parent_partner_id.toString()).subs.push(doc);
        }
    });

    root.subs = root.subs.filter(doc => String(doc.parent_partner_id) === String(root._id));
    return root;
};

// Clean and flatten data for response
const cleanData = (node, search) => {
    const matchesSearch = !search || node.nickname.includes(search) || node.partner_id.includes(search);
    let data = [];

    if (matchesSearch) {
        const owner = node.owner?.[0] || {};

        const ownerBalance = owner.own_money || 0;

        data.push({
            role: node.role,
            nickname: node.nickname,
            id: node.partner_id,
            subs: node.subs.length,
            members: node.members.length,
            money: ownerBalance,
            point: owner.point || 0,
            simpleBetRate: owner.simple_bet_rate || 0,
            combinedBetRate: owner.combined_bet_rate || 0,
            matchNumberBetRate: owner.match_num_bet_rate || 0,
            betMoneyUnit: node.bet_money_unit,
            holdingMoney: ownerBalance,
            holdingPoint: owner.point || 0,
        });

        node.members?.forEach(member => {
            const memberBalance = member.own_money || 0;
            data.push({
                role: "user",
                nickname: member.user_nickname,
                id: member.user_nickname,
                subs: 0,
                members: 0,
                money: memberBalance,
                point: member.point,
                simpleBetRate: member.simple_bet_rate,
                combinedBetRate: member.combined_bet_rate,
                matchNumberBetRate: member.match_num_bet_rate,
                betMoneyUnit: node.bet_money_unit,
                holdingMoney: memberBalance,
                holdingPoint: member.point
            });
        });
    }

    node.subs?.forEach(sub => {
        data.push(...cleanData(sub, search));
    });

    return data;
};


export const getPartner = async (req, res) => {
    const { search = '' } = req.query;
    const userId = req.session._id;

    const results = await PartnerModel.aggregate([
        {
            $match: {
                user_id: new mongoose.Types.ObjectId(userId),
            }
        },
        {
            $graphLookup: {
                from: 'partners',
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'parent_partner_id',
                as: 'subs'
            }
        },
        {
            $addFields: {
                allPartners: { $concatArrays: [['$$ROOT'], '$subs'] }
            }
        },
        { $unwind: '$allPartners' },
        {
            $lookup: {
                from: 'users',
                let: { ownerId: '$allPartners.user_id', partnerId: '$allPartners._id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $or: [
                                    { $eq: ['$_id', '$$ownerId'] },
                                    { $eq: ['$partner_id', '$$partnerId'] }
                                ]
                            }
                        }
                    }
                ],
                as: 'allPartners.users'
            }
        },
        {
            $addFields: {
                'allPartners.owner': {
                    $filter: { input: '$allPartners.users', as: 'u', cond: { $eq: ['$$u._id', '$allPartners.user_id'] } }
                },
                'allPartners.members': {
                    $filter: { input: '$allPartners.users', as: 'u', cond: { $ne: ['$$u._id', '$allPartners.user_id'] } }
                }
            }
        },
        {
            $group: {
                _id: '$_id',
                root: { $first: '$$ROOT' },
                partners: { $push: '$allPartners' }
            }
        },
        {
            $addFields: {
                'root.subs': {
                    $filter: {
                        input: '$partners',
                        as: 'p',
                        cond: { $ne: ['$$p._id', '$root._id'] }
                    }
                }
            }
        },
        {
            $addFields: {
                'root.subs': { $sortArray: { input: '$root.subs', sortBy: { createdAt: 1 } } }
            }
        },
        { $replaceRoot: { newRoot: '$root' } }
    ]);

    if (!results.length) return responseSuccess(res, []);

    const root = results[0];
    root.owner = root.allPartners.owner;
    root.members = [];

    const partnerTree = buildTree(root);
    const data = cleanData(partnerTree, search);

    responseSuccess(res, data);
};

// Clean and flatten data for response
const cleanPartnerList = (node) => {
    let data = [];

    data.push({
        role: node.role,
        nickname: node.nickname,
        id: node.partner_id,
        betRateType: node.bet_rate_type,
        deadline: node.deadline,
        cancelBet: node.cancel_bet,
        cancelBetRange: node.cancel_bet_range,
        betMoneyUnit: node.bet_money_unit,
        onetimeBetMin: node.onetime_bet_min,
        onetimeBetMax: node.onetime_bet_max,
        onetimeEarningMax: node.onetime_earning_max,
        oneroundBetMax: node.oneround_bet_max,
        oneroundEarningMax: node.oneround_earning_max,
        oneroundBetMaxSlot: node.oneround_bet_max_slot,
        oneroundEarningMaxSlot: node.oneround_earning_max_slot,
        allRoundsBetMax: node.all_rounds_bet_max,
        allRoundsBetMaxBySlots: node.all_rounds_bet_max_by_slots,
    });

    node.subs?.forEach(sub => {
        data.push(...cleanPartnerList(sub));
    });

    return data;
};

export const getPartnerList = async (req, res) => {
    const userId = req.session._id;

    const results = await PartnerModel.aggregate([
        {
            $match: {
                user_id: new mongoose.Types.ObjectId(userId),
            }
        },
        {
            $graphLookup: {
                from: 'partners',
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'parent_partner_id',
                as: 'subs'
            }
        },
    ])

    if (!results.length) return responseSuccess(res, [])

    const root = results[0];
    const partner = buildTree(root)

    return responseSuccess(res, [partner])
}

export const deletePartner = async (req, res) => {
    const { id, role } = req.query;

    if (role == "user") {
        await UserModel.deleteOne({ user_nickname: id })
    } else {
        await PartnerModel.deleteOne({ role: role, partner_id: id })
    }

    responseSuccess(res)
}

export const increaseCash = async (req, res) => {
    const { role, id } = req.body;
    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount)) {
        return responseBadRequest(res, t("invalid_amount"));
    }

    let user;

    if (role === "user") {
        user = await UserModel.findOne({ user_nickname: id });
        if (!user) return responseBadRequest(res, t("user_not_found"));

    } else {
        const partner = await PartnerModel.findOne({ partner_id: id });
        if (!partner) return responseBadRequest(res, t("partner_not_found"));

        user = await UserModel.findOne({ own_partner_id: partner._id });
        if (!user) return responseBadRequest(res, t("linked_user_not_found"));
    }

    if (amount < 0 && (user.own_money || 0) + amount < 0) {
        return responseBadRequest(res, t("insufficient_funds"));
    }

    const updateInc = {};

    if (amount > 0) {
        updateInc.own_money = amount;
        const pendingOffset = Math.min(user.pending_addfund_balance || 0, amount);
        if (pendingOffset > 0) {
            updateInc.pending_addfund_balance = -pendingOffset;
        }
    } else if (amount < 0) {
        updateInc.own_money = amount;
        const refundOffset = Math.min(user.pending_refund_balance || 0, Math.abs(amount));
        if (refundOffset > 0) {
            updateInc.pending_refund_balance = -refundOffset;
        }
    }

    if (Object.keys(updateInc).length) {
        await UserModel.updateOne(
            { _id: user._id },
            { $inc: updateInc }
        );
    }

    if (amount === 0) {
        return responseSuccess(res);
    }

    return responseSuccess(res);
};
