import BettingResultModel from "../../models/BettingResult.js";

export const updateBetting = async (gameId, odd, under, list, todayNo, totalNo) => {
    const bettingHistory = await BettingResultModel.find({ game_id: gameId });
    const numberSortColumn = new Set(['number_13', 'number_14', 'number_16']);

    const bulkOps = bettingHistory.reduce((ops, element) => {
        if (element.betting_status === "cancel") {
            return ops;
        }

        let win = true;

        if (numberSortColumn.has(element.betting_type)) {
            win = element.number_sort.every((val, idx) => list[idx] === val);
        } else {
            const conditions = element.betting_type.split("_");
            win = conditions.every(typeElement => {
                if (typeElement === "odd") return odd;
                if (typeElement === "even") return !odd;
                if (typeElement === "under") return under;
                if (typeElement === "over") return !under;
                return false;
            });
        }

        const earningAmount = win ? element.bet_amount * element.betting_rate : 0;

        ops.push({
            updateOne: {
                filter: { _id: element._id },
                update: {
                    $set: {
                        today_no: todayNo,
                        total_no: totalNo,
                        win,
                        earning_amount: earningAmount,
                        betting_status: "complete"
                    }
                }
            }
        });

        return ops;
    }, []);

    if (bulkOps.length) {
        await BettingResultModel.bulkWrite(bulkOps);
    }
};
