import gameResultService from "../services/gameResultService.js";

export const getResultsByDate = async (req, res) => {
  try {
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
    const results = await gameResultService.getLatestResults();
    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get results" });
  }
};