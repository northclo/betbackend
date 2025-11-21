import BettingResultModel from "../../../models/BettingResult.js";
import GameResultModel from "../../../models/GameResult.js";
import { responseSuccess, responseServerError } from "../../../helper/response.js";

const MAX_PAGE_SIZE = 50;

export const getBettingHistory = async (req, res) => {
    try {
        const userId = req.session._id;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSizeRaw = parseInt(req.query.pageSize, 10) || 10;
        const pageSize = Math.min(Math.max(1, pageSizeRaw), MAX_PAGE_SIZE);

        const filter = { user_id: userId };

        const [total, bettingResults] = await Promise.all([
            BettingResultModel.countDocuments(filter),
            BettingResultModel.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * pageSize)
                .limit(pageSize)
                .select({
                    game_id: 1,
                    bet_amount: 1,
                    betting_type: 1,
                    betting_rate: 1,
                    number_sort: 1,
                    win: 1,
                    earning_amount: 1,
                    total_no: 1,
                    today_no: 1,
                    betting_status: 1,
                    history_view: 1,
                    createdAt: 1,
                    updatedAt: 1,
                })
                .lean(),
        ]);

        const gameIds = [...new Set(bettingResults.map(item => item.game_id))];
        const gameResults = await GameResultModel.find({ game_id: { $in: gameIds } })
            .select({ game_id: 1, end_time_stamp: 1 })
            .lean();
        
        const gameResultMap = {};
        gameResults.forEach(game => {
            gameResultMap[game.game_id] = game.end_time_stamp;
        });

        const items = bettingResults.map(item => ({
            ...item,
            game_end_time: gameResultMap[item.game_id] || null,
        }));

        const totalPages = Math.ceil(total / pageSize);

        return responseSuccess(res, {
            items,
            pagination: {
                total,
                page,
                pageSize,
                totalPages,
            },
        });
    } catch (error) {
        console.error("Error fetching betting history:", error);
        return responseServerError(res);
    }
};

