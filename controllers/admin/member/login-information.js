import moment from 'moment';
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
            const formatStartDate = new Date(startDate);
            const formatEndDate = new Date(endDate);
            filter.login_date = {};
            if (startDate) filter.login_date.$gt = formatStartDate.getTime();
            if (endDate) filter.login_date.$lt = formatEndDate.getTime();
        }

        const result = await UserLoginHistoryModel.aggregate([
            { $match: filter },
            {
                $lookup: {
                    from: 'users',
                    localField: "user_id",
                    foreignField: "_id",
                    as: 'user'
                }
            },
            {
                $lookup: {
                    from: 'block_ips',
                    localField: 'ip_address',
                    foreignField: 'ip_address',
                    as: 'block_ip'
                }
            },
            { $unwind: '$user' },
            {
                $lookup: {
                    from: 'partners',
                    localField: 'user.own_partner_id',
                    foreignField: "_id",
                    as: 'partner'
                }
            },
        ])

        let data = [];
        result.forEach(element => {
            data.push({
                id: element.user.user_nickname,
                ip: element.ip_address,
                block_ip: element.block_ip.length == 0 ? false : true,
                location: element.location,
                login_time: moment(element.login_date).format("YYYY-MM-DD HH-mm-ss"),
            })
        });

        responseSuccess(res, data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
