import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import PartnerModel from '../../../models/Partner.js';
import UserModel from '../../../models/User.js';
import { responseBadRequest, responseSuccess, responseServerError, responseUnAutherized, responsePermissionDenied } from '../../../helper/response.js';
import { t } from '../../../helper/translation.js';
import { partnerType } from '../../../const/type.js';

const checkPartnerAccess = async (req) => {
    const currentPartnerId = req.session?._id;
    if (!currentPartnerId) {
        return { allowed: false, error: responseUnAutherized };
    }

    const currentPartner = await PartnerModel.findById(currentPartnerId).lean();
    if (!currentPartner) {
        return { allowed: false, error: (res) => responseBadRequest(res, t("partner_not_found")) };
    }

    const isHeadquater = currentPartner.role === partnerType.headquater;
    const hasPartnerAccessPermission = currentPartner.partner_access_permission === true;

    if (!isHeadquater && !hasPartnerAccessPermission) {
        return { allowed: false, error: responsePermissionDenied };
    }

    return { allowed: true, partner: currentPartner };
};

const buildTree = (root) => {
    if (!root || !root.subs) {
        root.subs = [];
        return root;
    }

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
            onetimeEarningMin: node.onetime_earning_min || null,
        });

        node.members?.forEach(member => {
            const memberBalance = member.own_money || 0;
            data.push({
                role: "user",
                nickname: member.user_nickname,
                id: member.user_nickname,
                userId: member._id ? member._id.toString() : null,
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
    try {
        const accessCheck = await checkPartnerAccess(req);
        if (!accessCheck.allowed) {
            return accessCheck.error(res);
        }

        const { search = '' } = req.query;
        const partnerId = req.session._id;

        if (!partnerId) {
            return responseBadRequest(res, t("partner_id_required"));
        }

        const results = await PartnerModel.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(partnerId)
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

        if (!results.length) {
            return responseSuccess(res, []);
        }

        const root = results[0];
        if (root.allPartners) {
            root.owner = root.allPartners.owner || [];
            root.members = root.allPartners.members || [];
        } else {
            root.owner = [];
            root.members = [];
        }

        const partnerTree = buildTree(root);
        const data = cleanData(partnerTree, search);

        return responseSuccess(res, data);
    } catch (error) {
        console.error("Error getting partner:", error);
        return responseServerError(res);
    }
};

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
        onetimeEarningMin: node.onetime_earning_min,
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

const transformPartnerForTree = (node) => {
    if (!node || !node.partner_id) return null;

    const transformed = {
        id: node.partner_id,
        nickname: node.nickname || '',
        subs: []
    };

    if (node.subs && Array.isArray(node.subs) && node.subs.length > 0) {
        transformed.subs = node.subs
            .map(sub => transformPartnerForTree(sub))
            .filter(Boolean);
    }

    return transformed;
};

export const getPartnerList = async (req, res) => {
    try {
        const accessCheck = await checkPartnerAccess(req);
        if (!accessCheck.allowed) {
            return accessCheck.error(res);
        }

        const partnerId = req.session._id;

        if (!partnerId) {
            return responseBadRequest(res, t("partner_id_required"));
        }

        const results = await PartnerModel.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(partnerId)
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
        ]);

        if (!results.length) {
            return responseSuccess(res, []);
        }

        const root = results[0];
        const partner = buildTree(root);
        const transformedPartner = transformPartnerForTree(partner);

        return responseSuccess(res, transformedPartner ? [transformedPartner] : []);
    } catch (error) {
        console.error("Error getting partner list:", error);
        return responseServerError(res);
    }
};

export const deletePartner = async (req, res) => {
    try {
        const accessCheck = await checkPartnerAccess(req);
        if (!accessCheck.allowed) {
            return accessCheck.error(res);
        }

        const { id } = req.query;

        if (!id) {
            return responseBadRequest(res, t("value_required"));
        }

        const partner = await PartnerModel.findOne({ partner_id: id.trim() });
        if (!partner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        const subPartners = await PartnerModel.countDocuments({ parent_partner_id: partner._id });
        if (subPartners > 0) {
            return responseBadRequest(res, t("cannot_delete_partner_with_sub_partners"));
        }

        const memberCount = await UserModel.countDocuments({ partner_id: partner._id });
        if (memberCount > 0) {
            return responseBadRequest(res, t("cannot_delete_partner_with_members"));
        }

        await PartnerModel.deleteOne({ partner_id: id.trim() });

        return responseSuccess(res);
    } catch (error) {
        console.error("Error deleting partner:", error);
        return responseServerError(res);
    }
};

export const increaseCash = async (req, res) => {
    try {
        const { id, amount, role } = req.body;

        const currentPartnerId = req.session?._id;
        if (!currentPartnerId) {
            return responseUnAutherized(res);
        }

        const currentPartner = await PartnerModel.findById(currentPartnerId).lean();
        if (!currentPartner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        const isHeadquater = currentPartner.role === partnerType.headquater;
        const hasPartnerAccessPermission = currentPartner.partner_access_permission === true;

        if (!isHeadquater && !hasPartnerAccessPermission) {
            return responsePermissionDenied(res);
        }

        const hasMoneyChangePermission = currentPartner.sub_partner_money_change === true;

        if (!isHeadquater && !hasMoneyChangePermission) {
            return responsePermissionDenied(res);
        }

        if (!id) {
            return responseBadRequest(res, t("value_required"));
        }

        if (amount === undefined || amount === null || amount === '') {
            return responseBadRequest(res, t("amount_required"));
        }

        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount)) {
            return responseBadRequest(res, t("invalid_amount"));
        }

        if (role === 'user') {
            const user = await UserModel.findOne({ user_nickname: id.trim() });
            if (!user) {
                return responseBadRequest(res, t("user_not_found"));
            }

            if (numAmount < 0) {
                const currentBalance = user.own_money || 0;
                if (currentBalance + numAmount < 0) {
                    return responseBadRequest(res, t("insufficient_funds"));
                }
            }

            await UserModel.updateOne(
                { _id: user._id },
                { $inc: { own_money: numAmount } }
            );

            return responseSuccess(res);
        }

        const partner = await PartnerModel.findOne({ partner_id: id.trim() });
        if (!partner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        if (numAmount < 0) {
            const currentBalance = partner.deposit_approved_amount || 0;
            if (currentBalance + numAmount < 0) {
                return responseBadRequest(res, t("insufficient_funds"));
            }
        }

        await PartnerModel.updateOne(
            { _id: partner._id },
            { $inc: { deposit_approved_amount: numAmount } }
        );

        return responseSuccess(res);
    } catch (error) {
        console.error("Error increasing cash:", error);
        return responseServerError(res);
    }
};

export const getPartnerById = async (req, res) => {
    try {
        const accessCheck = await checkPartnerAccess(req);
        if (!accessCheck.allowed) {
            return accessCheck.error(res);
        }

        const { id } = req.query;

        if (!id) {
            return responseBadRequest(res, t("value_required"));
        }

        const partner = await PartnerModel.findOne({ partner_id: id.trim() }).lean();
        if (!partner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        return responseSuccess(res, partner);
    } catch (error) {
        console.error("Error getting partner by id:", error);
        return responseServerError(res);
    }
};

export const updatePartner = async (req, res) => {
    try {
        const accessCheck = await checkPartnerAccess(req);
        if (!accessCheck.allowed) {
            return accessCheck.error(res);
        }

        const { id } = req.body;

        if (!id) {
            return responseBadRequest(res, t("value_required"));
        }

        const partner = await PartnerModel.findOne({ partner_id: id.trim() });
        if (!partner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        const payload = req.body;
        const updateData = {};

        if (payload.nickname !== undefined) {
            const nickname = payload.nickname?.trim();
            if (!nickname) {
                return responseBadRequest(res, t("nickname_required"));
            }
            const nicknameRegex = /^[A-Za-z][A-Za-z0-9_-]{2,9}$/;
            if (!nicknameRegex.test(nickname)) {
                return responseBadRequest(res, t("nickname_invalid_format"));
            }
            const existingPartnerByNickname = await PartnerModel.findOne({ 
                nickname: nickname,
                _id: { $ne: partner._id }
            });
            if (existingPartnerByNickname) {
                return responseBadRequest(res, t("partner_nickname_exists"));
            }
            updateData.nickname = nickname;
        }

        if (payload.password && payload.password.trim()) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(payload.password.trim(), salt);
        }

        if (payload.exchangePassword && payload.exchangePassword.trim()) {
            const salt = await bcrypt.genSalt(10);
            updateData.exchange_password = await bcrypt.hash(payload.exchangePassword.trim(), salt);
        }

        if (payload.phoneNumber !== undefined) {
            updateData.phone_number = payload.phoneNumber || '';
        }

        if (payload.bank !== undefined) {
            const bank = typeof payload.bank === "string" ? payload.bank.trim() : payload.bank;
            if (!bank) {
                return responseBadRequest(res, t("bank_required"));
            }
            updateData.bank_id = bank;
        }

        if (payload.account !== undefined) {
            const account = payload.account?.trim();
            if (!account) {
                return responseBadRequest(res, t("bank_account_required"));
            }
            updateData.bank_number = account;
        }

        if (payload.name !== undefined) {
            const name = payload.name?.trim();
            if (!name) {
                return responseBadRequest(res, t("bank_owner_name_required"));
            }
            updateData.bank_owner_name = name;
        }

        if (payload.dapol !== undefined) {
            updateData.simple_bet_rate = payload.dapol ? Number(payload.dapol) : null;
        }
        if (payload.danpol !== undefined) {
            updateData.combined_bet_rate = payload.danpol ? Number(payload.danpol) : null;
        }
        if (payload.numberMatch !== undefined) {
            updateData.match_num_bet_rate = payload.numberMatch ? Number(payload.numberMatch) : null;
        }

        if (payload.currencyRolling !== undefined) {
            updateData.currency_rolling = payload.currencyRolling?.check || false;
            if (payload.currencyRolling?.amount !== undefined) {
                updateData.deposit_approved_amount = Number(payload.currencyRolling.amount) || 0;
            }
        }

        if (payload.permissions !== undefined) {
            if (payload.permissions.partnerPageAccess !== undefined) {
                updateData.partner_access_permission = payload.permissions.partnerPageAccess;
            }
            if (payload.permissions.subPartnerCreate !== undefined) {
                updateData.sub_partner_creation_permission = payload.permissions.subPartnerCreate;
            }
            if (payload.permissions.memberCreate !== undefined) {
                updateData.user_creation_permission = payload.permissions.memberCreate;
            }
            if (payload.permissions.partnerSettlement !== undefined) {
                updateData.sub_partner_settlement_rate = payload.permissions.partnerSettlement;
            }
            if (payload.permissions.moneyChange !== undefined) {
                updateData.sub_partner_money_change = payload.permissions.moneyChange;
            }
        }

        if (payload.gameSetting !== undefined) {
            if (payload.gameSetting.dividendType !== undefined) {
                updateData.bet_rate_type = payload.gameSetting.dividendType || 'A';
            }
            if (payload.gameSetting.deadline !== undefined) {
                updateData.deadline = payload.gameSetting.deadline ? Number(payload.gameSetting.deadline) : null;
            }
            if (payload.gameSetting.cancelBet !== undefined) {
                updateData.cancel_bet = payload.gameSetting.cancelBet || false;
                if (payload.gameSetting.cancelBet) {
                    updateData.cancel_bet_range = {
                        end_time: payload.gameSetting.cancelBetEndTime ? Number(payload.gameSetting.cancelBetEndTime) : 0,
                        max_time: payload.gameSetting.cancelBetMaxTime ? Number(payload.gameSetting.cancelBetMaxTime) : 0,
                        perday_time: payload.gameSetting.cancelBetPerday ? Number(payload.gameSetting.cancelBetPerday) : 0,
                    };
                } else {
                    updateData.cancel_bet_range = undefined;
                }
            }
            if (payload.gameSetting.betUnit !== undefined) {
                updateData.bet_money_unit = payload.gameSetting.betUnit || '';
            }
            if (payload.gameSetting.oneTimeBetMin !== undefined) {
                updateData.onetime_bet_min = payload.gameSetting.oneTimeBetMin ? Number(payload.gameSetting.oneTimeBetMin) : null;
            }
            if (payload.gameSetting.oneTimeBetMax !== undefined) {
                updateData.onetime_bet_max = payload.gameSetting.oneTimeBetMax ? Number(payload.gameSetting.oneTimeBetMax) : null;
            }
            if (payload.gameSetting.oneTimeEarningMin !== undefined) {
                updateData.onetime_earning_min = payload.gameSetting.oneTimeEarningMin ? Number(payload.gameSetting.oneTimeEarningMin) : null;
            }
            if (payload.gameSetting.oneTimeEarningMax !== undefined) {
                updateData.onetime_earning_max = payload.gameSetting.oneTimeEarningMax ? Number(payload.gameSetting.oneTimeEarningMax) : null;
            }
            if (payload.gameSetting.oneRoundBetMax !== undefined) {
                updateData.oneround_bet_max = payload.gameSetting.oneRoundBetMax ? Number(payload.gameSetting.oneRoundBetMax) : null;
            }
            if (payload.gameSetting.oneRoundEarningMax !== undefined) {
                updateData.oneround_earning_max = payload.gameSetting.oneRoundEarningMax ? Number(payload.gameSetting.oneRoundEarningMax) : null;
            }
            if (payload.gameSetting.oneRoundBetMaxPerSlot !== undefined) {
                updateData.oneround_bet_max_slot = payload.gameSetting.oneRoundBetMaxPerSlot ? Number(payload.gameSetting.oneRoundBetMaxPerSlot) : null;
            }
            if (payload.gameSetting.oneRoundEarningMaxPerSlot !== undefined) {
                updateData.oneround_earning_max_slot = payload.gameSetting.oneRoundEarningMaxPerSlot ? Number(payload.gameSetting.oneRoundEarningMaxPerSlot) : null;
            }
            if (payload.gameSetting.allRoundsBetMax !== undefined) {
                updateData.all_rounds_bet_max = payload.gameSetting.allRoundsBetMax ? Number(payload.gameSetting.allRoundsBetMax) : null;
            }
            if (payload.gameSetting.allRoundsBetMaxBySlots !== undefined && Array.isArray(payload.gameSetting.allRoundsBetMaxBySlots)) {
                updateData.all_rounds_bet_max_by_slots = payload.gameSetting.allRoundsBetMaxBySlots.map(slot => ({
                    bet_type: slot.bet_type || '',
                    slot_bet_max: slot.slot_bet_max ? Number(slot.slot_bet_max) : null,
                    public: slot.public || false
                }));
            }
        }

        await PartnerModel.updateOne(
            { _id: partner._id },
            { $set: updateData }
        );

        return responseSuccess(res, { message: t("partner_updated_successfully") });
    } catch (error) {
        console.error("Error updating partner:", error);
        return responseServerError(res);
    }
};
