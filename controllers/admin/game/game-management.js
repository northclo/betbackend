import moment from "moment";
import GameResultModel from "../../../models/GameResult.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";

const ALLOWED_STATUS = ["", "register", "under", "end", "finish", "cancel"];
const ALLOWED_SEARCH_FIELDS = ["total_no", "today_no"];

const buildStatusFilter = (status, now) => {
    switch (status) {
        case "register":
            return { start_time_stamp: { $gt: now } };
        case "under":
            return {
                start_time_stamp: { $lte: now },
                end_time_stamp: { $gt: now }
            };
        case "end":
            return {
                end_time_stamp: { $lte: now },
                cancel_time_stamp: { $gt: now }
            };
        case "finish":
            return {
                end_time_stamp: { $lte: now },
                $or: [
                    { cancel_time_stamp: { $exists: false } },
                    { cancel_time_stamp: null },
                    { cancel_time_stamp: { $lte: 0 } }
                ]
            };
        case "cancel":
            return { cancel_time_stamp: { $lte: now } };
        default:
            return {};
    }
};

export const getGameManagement = async (req, res) => {
    const { status = "", searchField, search } = req.query;
    const normalizedStatus = status.trim().toLowerCase();
    const now = Date.now();

    if (!ALLOWED_STATUS.includes(normalizedStatus)) {
        return responseBadRequest(res, "Invalid status filter.");
    }

    const filter = buildStatusFilter(normalizedStatus, now);

    if (searchField || search) {
        if (!searchField || !search) {
            return responseBadRequest(res, "Both searchField and search must be provided.");
        }
        if (!ALLOWED_SEARCH_FIELDS.includes(searchField)) {
            return responseBadRequest(res, "Invalid search field.");
        }

        const numericSearch = Number(search);
        if (!Number.isFinite(numericSearch)) {
            return responseBadRequest(res, "Search value must be a valid number.");
        }
        filter[searchField] = numericSearch;
    }

    const gameResult = await GameResultModel.find(filter).sort({ start_time_stamp: -1 });

    const result = gameResult.map((element) => {
        const startStamp = element.start_time_stamp ?? 0;
        const endStamp = element.end_time_stamp ?? 0;
        const cancelStamp = element.cancel_time_stamp ?? null;

        let gameStatus = "f";
        if (startStamp > now) {
            gameStatus = "r";
        } else if (startStamp <= now && now < endStamp) {
            gameStatus = "s";
        } else if (cancelStamp && endStamp <= now && now < cancelStamp) {
            gameStatus = "e";
        } else if (cancelStamp && cancelStamp <= now) {
            gameStatus = "c";
        } else {
            gameStatus = "f";
        }

        return {
            key: element._id.toString(),
            total_no: element.total_no,
            today_no: element.today_no,
            list: element.list,
            startTime: startStamp ? moment(startStamp).format("YYYY-MM-DD HH:mm") : "",
            remainedTime: Math.max(0, startStamp - now),
            odd: element.odd,
            under: element.under,
            status: gameStatus
        };
    });

    responseSuccess(res, result);
};