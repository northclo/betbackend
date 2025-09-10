import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
import { responseSuccess } from "../../../helper/response.js";

export const getMemberLoginInformation = async (req, res) => {
    try {
        const { startDate, endDate, searchField, search } = req.query;

        const filter = {};

        if (searchField && search) {
            filter[searchField] = search;
        }

        if (startDate || endDate) {
            filter.login_date = {};
            if (startDate) filter.login_date.$gt = new Date(startDate);
            if (endDate) filter.login_date.$lt = new Date(endDate);
        }

        const result = await UserLoginHistoryModel.find(filter);

        responseSuccess(res, result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
