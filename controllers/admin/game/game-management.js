import moment from "moment";
import GameResultModel from "../../../models/GameResult.js";
import { responseSuccess } from "../../../helper/response.js";

export const getGameManagement = async (req, res) => {
    const { status, searchField, search } = req.query;

    const filter = {};
    if (searchField && search) {
        filter[searchField] = search;
    }

    if (status == 'register') {
        filter.start_time_stamp = { $gt: Date.now() };
    } else if (status == 'under') {
        filter.start_time_stamp = { $gt: Date.now() };
        filter.end_time_stamp = { $lt: Date.now() };
    } else {
        filter.end_time_stamp = { $lt: Date.now() };
    }

    const gameResult = await GameResultModel.find(filter);

    let result = []
    gameResult.forEach(element => {
        let gameStatus = 'c';
        if (element.start_time_stamp > Date.now()) {
            gameStatus = 'r';
        } else if (element.start_time_stamp < Date.now() && Date.now() < element.end_time_stamp) {
            gameStatus = 's';
        } else if (element.end_time_stamp < Date.now()) {
            gameStatus = 'e'
        }
        result.push({
            total_no: element.total_no,
            today_no: element.today_no,
            list: element.list,
            startTime: moment(element.start_time_stamp).format("YYYY-MM-DD HH:mm"),
            remainedTime: element.start_time_stamp - Date.now(),
            odd: element.odd,
            under: element.under,
            status: gameStatus
        })
    });
    responseSuccess(res, result)
}