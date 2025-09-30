import GameResultModel from "../../models/GameResult.js"
import { responseBadRequest } from "../../helper/response.js";
import { config } from "../../config/index.js";
import { io } from '../../server.js'
import { updateBetting } from "../../helper/Betting/Update-Betting.js";
import { getCurrentTime } from "../../helper/Time/Get-Current-Time.js";

const checkIp = (req) => {
    const allowIp = config.ALLOW_IP;
    if (!allowIp) return true;

    const allowIps = allowIp.split(",")
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    return allowIps.includes(ip);
}

export const startGame = async (req, res) => {
    if (!req.headers["authorization"] || req.headers["authorization"] !== config.AUTH_KEY) return responseBadRequest(res);
    if (!checkIp(req)) return responseBadRequest(res);

    const { game_id, device_id, time_stamp } = req.body;

    const gameResult = await GameResultModel.findOne({ game_id: game_id });

    if (gameResult) {
        await GameResultModel.updateOne({ game_id: game_id },
            {
                device_id: device_id,
                start_time_stamp: time_stamp
            }
        )
    } else {
        await GameResultModel.create({
            game_id: game_id,
            device_id: device_id,
            // start_time_stamp: getCurrentTime() + 182000
            start_time_stamp: time_stamp
        })
    }

    setTimeout(() => {
        io.emit('start_game', { game_id: game_id })
        // }, 2000);
    }, time_stamp - getCurrentTime())

    return res.status(200).json({ result: 0 });
}

export const endGame = async (req, res) => {
    if (!req.headers["authorization"] || req.headers["authorization"] !== config.AUTH_KEY) return responseBadRequest(res);
    if (!checkIp(req)) return responseBadRequest(res);

    const { list, manual_valid, total_no, today_no, current_no, time_stamp, game_id, device_id } = req.body;

    const gameResult = await GameResultModel.findOne({ game_id: game_id });

    if (!gameResult) return responseBadRequest(res);

    const odd = list[0] % 2 !== 0;
    const under = list[0] + list[1] + list[2] <= 10.5;

    updateBetting(game_id, odd, under, list, today_no, total_no)

    await GameResultModel.updateOne({ game_id: game_id }, {
        list: list,
        total_no: total_no,
        today_no: today_no,
        // end_time_stamp: gameResult.start_time_stamp + 2000,
        end_time_stamp: time_stamp,
        current_no: current_no,
        device_id: device_id,
        manual_valid: manual_valid,
        odd: odd,
        under: under
    });

    setTimeout(() => {
        io.emit('end_game', { game_id: game_id });
        // }, gameResult.start_time_stamp + 2000 - getCurrentTime());
    }, time_stamp - getCurrentTime())

    return res.status(200).json({ result: 0 });
}