import mongoose from 'mongoose';
import PartnerModel from '../../../models/Partner.js';
import { responseSuccess, responseUnAutherized } from '../../../helper/response.js';
import { partnerType } from '../../../const/type.js';

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
        data.push({
            role: node.role,
            nickname: node.nickname,
            id: node.partner_id,
            subs: node.subs.length,
            members: node.members.length,
            money: owner.own_money || 0,
            point: owner.point || 0,
            simpleBetRate: owner.simple_bet_rate || 0,
            combinedBetRate: owner.combined_bet_rate || 0,
            matchNumberBetRate: owner.match_num_bet_rate || 0,
            betMoneyUnit: node.bet_money_unit,
            holdingMoney: 0,
            holdingPoint: 0
        });

        node.members?.forEach(member => {
            data.push({
                role: "user",
                nickname: member.user_nickname,
                id: member.user_nickname,
                subs: 0,
                members: 0,
                money: member.own_money,
                point: member.point,
                simpleBetRate: member.simple_bet_rate,
                combinedBetRate: member.combined_bet_rate,
                matchNumberBetRate: member.match_num_bet_rate,
                betMoneyUnit: node.bet_money_unit,
                holdingMoney: 0,
                holdingPoint: 0
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

    if (!mongoose.Types.ObjectId.isValid(userId)) return responseUnAutherized(res);

    const results = await PartnerModel.aggregate([
        {
            $match: {
                user_id: new mongoose.Types.ObjectId(userId),
                role: partnerType.headquater,
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

    if (!results.length) return responseSuccess(res, '', []);

    const root = results[0];
    root.owner = root.allPartners.owner;
    root.members = [];

    const partnerTree = buildTree(root);
    const data = cleanData(partnerTree, search);

    responseSuccess(res, '', data);
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
                role: partnerType.headquater,
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

    if (!results.length) return responseSuccess(res, '', [])

    const root = results[0];
    const partner = buildTree(root)

    return responseSuccess(res, '', [partner])
}