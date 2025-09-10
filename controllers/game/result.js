import gameResultService from "../../services/gameResultService.js";
import { config } from "../../config/index.js";
import { responseBadRequest } from "../../helper/response.js";

const checkIp = (req) => {
    const allowIp = config.ALLOW_IP;
    if(allowIp.length == 0 ) {
        return true;
    }
    const allowIps = allowIp.split(",")
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    if (allowIps.includes(ip)) {
        return true;
    } else {
        return false;
    }
}

export const getResultsByDate = async (req, res) => {
    try {
        if (!checkIp(req)) {
            return responseBadRequest(res);
        }

        const { date, mode } = req.query;
        if (!date) {
            return res.status(400).json({ error: "Date query parameter is required" });
        }

        const results = await gameResultService.getResultsByDate(date, mode);
        res.status(200).json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get results" });
    }
};

export const getLatestResults = async (req, res) => {
    try {
        if (!checkIp(req)) {
            return responseBadRequest(res);
        }

        const results = await gameResultService.getLatestResults();
        res.status(200).json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get results" });
    }
};

export const getResultsbyIndex = async (req, res) => {
    try {
        if (!checkIp(req)) {
            return responseBadRequest(res);
        }

        const { index, days } = req.query;
        if (!index) {
            return res.status(400).json({ error: "index query parameter is required" });
        }
        if (!days) {
            return res.status(400).json({ error: "days query parameter is required" });
        }

        const results = await gameResultService.getResultsbyIndex(index, days);
        res.status(200).json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get results" });
    }
};