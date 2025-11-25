import gameResultService from "../../services/gameResultService.js";
import { t } from "../../helper/translation.js";

export const getResultsByDate = async (req, res) => {
    try {
        const { date, mode } = req.query;
        if (!date) {
            return res.status(400).json({ error: t("date_parameter_required") });
        }

        const results = await gameResultService.getResultsByDate(date, mode);
        res.status(200).json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: t("failed_get_results") });
    }
};

export const getLatestResults = async (req, res) => {
    try {
        const results = await gameResultService.getLatestResults();
        res.status(200).json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: t("failed_get_results") });
    }
};

export const getResultsbyIndex = async (req, res) => {
    try {
        const { index, days } = req.query;
        if (!index) {
            return res.status(400).json({ error: t("index_parameter_required") });
        }
        if (!days) {
            return res.status(400).json({ error: t("days_parameter_required") });
        }

        const results = await gameResultService.getResultsbyIndex(index, days);
        res.status(200).json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: t("failed_get_results") });
    }
};