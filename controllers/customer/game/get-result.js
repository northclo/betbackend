import GameResultModel from "../../../models/GameResult.js";
import BettingResultModel from "../../../models/BettingResult.js";
import { responseSuccess } from "../../../helper/response.js";

export const getGameResult = async (req, res) => {
    const user_id = req.session._id;

    const game = await GameResultModel.findOne({ _id: '68c40bdb87e94d503f8822e3' });

    const bettingHistory = await BettingResultModel.find({ game_id: 'e3df3bd1-71a7-4b66-bfe7-045cdd176334', user_id: user_id });
    bettingHistory.forEach(element => {
        let win = false;
        let earning_amount = 0;
        let match = true;
        switch (element.betting_type) {
            case 'odd':
                if (game.odd) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate;
                }
                break;
            case 'even':
                if (!game.odd) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate;
                }
                break;
            case 'under':
                if (game.under) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate;
                }
                break;
            case 'over':
                if (!game.under) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate;
                }
                break;
            case 'odd_under':
                if (game.odd && game.under) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate;
                }
                break;
            case 'odd_over':
                if (game.odd && !game.under) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate;
                }
                break;
            case 'even_under':
                if (!game.odd && game.under) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate;
                }
                break;
            case 'even_over':
                if (!game.odd && !game.under) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate;
                }
                break;
            case 'match_13':
                for (let index = 0; index < 3; index++) {
                    if (element.number_sort[index] !== game.list[index]) match = false;
                }

                if (match) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate
                }
                break;
            case 'match_14':
                for (let index = 0; index < 4; index++) {
                    if (element.number_sort[index] !== game.list[index]) match = false;
                }

                if (match) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate
                }
                break;
            case 'match_16':
                for (let index = 0; index < 6; index++) {
                    if (element.number_sort[index] !== game.list[index]) match = false;
                }

                if (match) {
                    win = true;
                    earning_amount = element.bet_amount * element.betting_rate
                }
                break;
            default:
                break;
        }

        // updateBettingHistory(element._id, win, earning_amount);
    });

    responseSuccess(res)
}

const updateBettingHistory = async (_id, win, earning_amount) => {
    const result = await BettingResultModel.updateOne({ _id: _id }, {
        win: win,
        earning_amount: earning_amount
    })
}