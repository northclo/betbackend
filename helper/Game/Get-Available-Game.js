import GameResultModel from "../../models/GameResult.js"
import { getCurrentTime } from "../Time/Get-Current-Time.js";

export const getAvailableGame = async () => {
    return await GameResultModel
        .find({
            end_time_stamp: { $exists: false },
            start_time_stamp: {
                $gte: getCurrentTime(),
                $lte: getCurrentTime() + 180000
            }
        })
        .sort({ start_time_stamp: 1 });
}