import BettingResultModel from "../../../models/BettingResult.js";
import GameResultModel from "../../../models/GameResult.js";
import GameSettingModel from "../../../models/GameSetting.js";
import PartnerModel from "../../../models/Partner.js";
import { responseBadRequest, responseServerError, responseSuccess } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import { getCurrentTime } from "../../../helper/Time/Get-Current-Time.js";
import mongoose from "mongoose";
import { t } from "../../../helper/translation.js";
import TransactionModel from "../../../models/TransactionHistory.js";

const VALID_BET_TYPES = new Set([
    "odd",
    "even",
    "under",
    "over",
    "odd_under",
    "odd_over",
    "even_under",
    "even_over",
    "number_13",
    "number_14",
    "number_16",
]);

const NUMBER_SORT_LENGTH = {
    number_13: 3,
    number_14: 4,
    number_16: 6,
};

export const StartGame = async (req, res) => {
    try {
        const { game_id, bettingType, bettingAmount, bettingRate, numberSort } = req.body;
        const userId = req.session._id;

        if (!game_id || !VALID_BET_TYPES.has(bettingType)) {
            return responseBadRequest(res, t("invalid_betting_request"));
        }

        const amount = Number(bettingAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return responseBadRequest(res, t("betting_amount_positive"));
        }

        const rate = Number(bettingRate);
        if (!Number.isFinite(rate) || rate <= 0) {
            return responseBadRequest(res, t("betting_rate_positive"));
        }

        let sanitizedNumberSort = [];
        if (NUMBER_SORT_LENGTH[bettingType]) {
            if (!Array.isArray(numberSort) || numberSort.length !== NUMBER_SORT_LENGTH[bettingType]) {
                return responseBadRequest(res, t("number_sort_invalid"));
            }

            sanitizedNumberSort = numberSort.map((val) => Number(val));
            const allNumbers = sanitizedNumberSort.every(
                (val) => Number.isInteger(val) && val >= 1 && val <= 6
            );
            if (!allNumbers) {
                return responseBadRequest(res, t("number_sort_values_range"));
            }

            const uniqueCount = new Set(sanitizedNumberSort).size;
            if (uniqueCount !== sanitizedNumberSort.length) {
                return responseBadRequest(res, t("number_sort_values_unique"));
            }

            sanitizedNumberSort.sort((a, b) => a - b);
        }

        const gameSetting = await GameSettingModel.findOne({ name: 'PowerballGame' }).lean();
        if (gameSetting && gameSetting.activate === false) {
            const inactiveMessage = gameSetting.inactive_message || t("game_is_currently_disabled");
            return responseBadRequest(res, inactiveMessage);
        }

        let user = await UserModel.findOne({ _id: userId }).lean();
        let partnerObjectId = null;
        if (!user) {
            user = await PartnerModel.findById(userId).lean();
            if (!user) {
                return responseBadRequest(res, t("user_not_found"));
            }
            partnerObjectId = user._id;
        } else {
            partnerObjectId = user.partner_id || user.ownpartner_id;
        }

        const availableBalance = user.own_money ?? 0;

        const game = await GameResultModel.findOne({ game_id });
        if (!game || !game.start_time_stamp) {
            return responseBadRequest(res, t("game_not_available_betting"));
        }

        if (availableBalance < amount) {
            return responseBadRequest(res, t("not_enough_balance"));
        }

        let partner = null;
        if (partnerObjectId) {
            partner = await PartnerModel.findOne({ _id: partnerObjectId }).lean();
        }

        const potentialEarning = amount * rate;

        if (partner && partner.bet_money_unit) {
            const betUnit = Number(partner.bet_money_unit);
            if (betUnit > 0 && amount % betUnit !== 0) {
                return responseBadRequest(res, t("bet_amount_must_be_multiple_of_unit", betUnit));
            }
        }

        if (partner && partner.onetime_bet_min !== null && partner.onetime_bet_min !== undefined && partner.onetime_bet_min > 0) {
            if (amount < partner.onetime_bet_min) {
                return responseBadRequest(res, t("bet_amount_below_minimum", partner.onetime_bet_min));
            }
        }

        if (partner && partner.onetime_bet_max !== null && partner.onetime_bet_max !== undefined && partner.onetime_bet_max > 0) {
            if (amount > partner.onetime_bet_max) {
                return responseBadRequest(res, t("bet_amount_exceeds_maximum", partner.onetime_bet_max));
            }
        }

        if (partner && partner.onetime_earning_max !== null && partner.onetime_earning_max !== undefined && partner.onetime_earning_max > 0) {
            if (potentialEarning > partner.onetime_earning_max) {
                return responseBadRequest(res, t("potential_earning_exceeds_maximum", partner.onetime_earning_max));
            }
        }

        const existingRoundBets = await BettingResultModel.find({
            user_id: userId,
            game_id: game_id,
            betting_status: { $ne: 'CANCEL' }
        }).lean();

        const roundBetTotal = existingRoundBets.reduce((sum, bet) => sum + (bet.bet_amount || 0), 0);
        const roundEarningTotal = existingRoundBets.reduce((sum, bet) => {
            const betEarning = (bet.bet_amount || 0) * (bet.betting_rate || 0);
            return sum + betEarning;
        }, 0);

        if (partner && partner.oneround_bet_max !== null && partner.oneround_bet_max !== undefined && partner.oneround_bet_max > 0) {
            if (roundBetTotal + amount > partner.oneround_bet_max) {
                return responseBadRequest(res, t("round_bet_total_exceeds_maximum", partner.oneround_bet_max, roundBetTotal));
            }
        }

        if (partner && partner.oneround_earning_max !== null && partner.oneround_earning_max !== undefined && partner.oneround_earning_max > 0) {
            const newRoundEarningTotal = roundEarningTotal + potentialEarning;
            if (newRoundEarningTotal > partner.oneround_earning_max) {
                return responseBadRequest(res, t("round_earning_total_exceeds_maximum", partner.oneround_earning_max, roundEarningTotal));
            }
        }

        const existingSlotBets = existingRoundBets.filter(bet => bet.betting_type === bettingType);
        const slotBetTotal = existingSlotBets.reduce((sum, bet) => sum + (bet.bet_amount || 0), 0);
        const slotEarningTotal = existingSlotBets.reduce((sum, bet) => {
            const betEarning = (bet.bet_amount || 0) * (bet.betting_rate || 0);
            return sum + betEarning;
        }, 0);

        if (partner && partner.oneround_bet_max_slot !== null && partner.oneround_bet_max_slot !== undefined && partner.oneround_bet_max_slot > 0) {
            if (slotBetTotal + amount > partner.oneround_bet_max_slot) {
                return responseBadRequest(res, t("slot_bet_total_exceeds_maximum", partner.oneround_bet_max_slot, slotBetTotal));
            }
        }

        if (partner && partner.oneround_earning_max_slot !== null && partner.oneround_earning_max_slot !== undefined && partner.oneround_earning_max_slot > 0) {
            const newSlotEarningTotal = slotEarningTotal + potentialEarning;
            if (newSlotEarningTotal > partner.oneround_earning_max_slot) {
                return responseBadRequest(res, t("slot_earning_total_exceeds_maximum", partner.oneround_earning_max_slot, slotEarningTotal));
            }
        }

        if (partner && partner.all_rounds_bet_max !== null && partner.all_rounds_bet_max !== undefined && partner.all_rounds_bet_max > 0) {
            const allRoundsBetTotal = await BettingResultModel.aggregate([
                {
                    $match: {
                        user_id: new mongoose.Types.ObjectId(userId),
                        betting_status: { $ne: 'CANCEL' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$bet_amount' }
                    }
                }
            ]);

            const currentAllRoundsTotal = allRoundsBetTotal.length > 0 ? allRoundsBetTotal[0].total : 0;
            if (currentAllRoundsTotal + amount > partner.all_rounds_bet_max) {
                return responseBadRequest(res, t("all_rounds_bet_total_exceeds_maximum", partner.all_rounds_bet_max, currentAllRoundsTotal));
            }
        }

        if (partner && partner.all_rounds_bet_max_by_slots && Array.isArray(partner.all_rounds_bet_max_by_slots) && partner.all_rounds_bet_max_by_slots.length > 0) {
            const getSlotCategories = (bettingType) => {
                const categories = [];
                
                if (bettingType === 'number_13') {
                    categories.push('match_1_3');
                } else if (bettingType === 'number_14') {
                    categories.push('match_1_4');
                } else if (bettingType === 'number_16') {
                    categories.push('match_1_6');
                }
                else if (['odd_under', 'odd_over', 'even_under', 'even_over'].includes(bettingType)) {
                    categories.push('oeuo');
                }
                else if (['under', 'over'].includes(bettingType)) {
                    categories.push('unov');
                    categories.push('oedv');
                }
                else if (['odd', 'even'].includes(bettingType)) {
                    categories.push('oedv');
                }
                
                return categories;
            };

            const slotCategories = getSlotCategories(bettingType);
            
            for (const slotCategory of slotCategories) {
                const slotLimit = partner.all_rounds_bet_max_by_slots.find(slot => slot.bet_type === slotCategory);
                if (slotLimit && slotLimit.slot_bet_max !== null && slotLimit.slot_bet_max !== undefined && slotLimit.slot_bet_max > 0) {
                    const allBets = await BettingResultModel.find({
                        user_id: new mongoose.Types.ObjectId(userId),
                        betting_status: { $ne: 'CANCEL' }
                    }).lean();

                    let currentSlotTotal = 0;
                    for (const bet of allBets) {
                        const betCategories = getSlotCategories(bet.betting_type);
                        if (betCategories.includes(slotCategory)) {
                            currentSlotTotal += (bet.bet_amount || 0);
                        }
                    }

                    if (currentSlotTotal + amount > slotLimit.slot_bet_max) {
                        return responseBadRequest(res, t("all_rounds_slot_bet_total_exceeds_maximum", slotLimit.slot_bet_max, currentSlotTotal));
                    }
                }
            }
        }

        if (gameSetting && gameSetting.duplicate_betting === true && gameSetting.duplicate_betting_limit > 0) {
            const timeLimit = getCurrentTime() - (gameSetting.duplicate_betting_limit * 1000);
            
            const recentBets = await BettingResultModel.find({
                user_id: userId,
                game_id: game_id,
                betting_type: bettingType,
                bet_amount: amount,
                betting_status: { $ne: 'CANCEL' },
                createdAt: {
                    $gte: new Date(timeLimit)
                }
            }).limit(1);

            if (recentBets.length > 0) {
                return responseBadRequest(res, t("duplicate_betting_not_allowed"));
            }

            if (sanitizedNumberSort && sanitizedNumberSort.length > 0) {
                const recentBetsWithNumber = await BettingResultModel.find({
                    user_id: userId,
                    game_id: game_id,
                    betting_type: bettingType,
                    bet_amount: amount,
                    number_sort: sanitizedNumberSort,
                    betting_status: { $ne: 'CANCEL' },
                    createdAt: {
                        $gte: new Date(timeLimit)
                    }
                }).limit(1);

                if (recentBetsWithNumber.length > 0) {
                    return responseBadRequest(res, t("duplicate_betting_not_allowed"));
                }
            }
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            let bettingPointRate = 0;
            
            if (['odd', 'even', 'under', 'over'].includes(bettingType)) {
                bettingPointRate = user.simple_bet_rate || 0;
            } else if (['odd_under', 'odd_over', 'even_under', 'even_over'].includes(bettingType)) {
                bettingPointRate = user.combined_bet_rate || 0;
            } else if (['number_13', 'number_14', 'number_16'].includes(bettingType)) {
                bettingPointRate = user.match_num_bet_rate || 0;
            }
            
            const result = await BettingResultModel.create([{
                user_id: userId,
                game_id,
                betting_type: bettingType,
                betting_rate: rate,
                bet_amount: amount,
                number_sort: sanitizedNumberSort,
                betting_status: "WAIT",
                win: false,
                earning_amount: 0,
                betting_point_rate: bettingPointRate,
                betting_point_value: 0,
                partner_bet_benefit: 0,
                history_view: true,
            }], { session });

            const bettingResultId = result[0]._id.toString();

            await TransactionModel.create([{
                user_id: userId,
                fund_type: "BETTING",
                fund_status: "WAIT",
                fund_amount: -amount,
                request_send_date: new Date(),
                comment: `Bet ID: ${bettingResultId}`
            }], { session });

            let updateBalance = await UserModel.updateOne(
                { _id: userId },
                { $inc: { own_money: -amount } },
                { session }
            );

            if (!updateBalance.modifiedCount) {
                updateBalance = await PartnerModel.updateOne(
                    { _id: userId },
                    { $inc: { own_money: -amount } },
                    { session }
                );
            }

            if (!updateBalance.modifiedCount) {
                await session.abortTransaction();
                await session.endSession();
                return responseBadRequest(res, t("failed_update_balance"));
            }

            await session.commitTransaction();
            await session.endSession();

            const createdBet = result[0];
            return responseSuccess(res, {
                _id: createdBet._id,
                bet_amount: createdBet.bet_amount,
                betting_rate: createdBet.betting_rate,
                betting_type: createdBet.betting_type,
                game_id: createdBet.game_id,
                number_sort: createdBet.number_sort,
                betting_status: createdBet.betting_status,
                win: createdBet.win,
                earning_amount: createdBet.earning_amount,
                history_view: createdBet.history_view,
            });
        } catch (error) {
            await session.abortTransaction();
            await session.endSession();
            throw error;
        }
    } catch (error) {
        console.error("Error starting game:", error);
        return responseServerError(res);
    }
};