import moment from "moment";
import UserLoginHistoryModel from "../../../models/UserLoginHistory.js";
import { responseSuccess } from "../../../helper/response.js";

export const getMemberLoginInformation = async (req, res) => {
    try {
        const { startDate, endDate, searchField, search } = req.query;

        // Base login_date filter
        const filter = {};
        if (startDate || endDate) {
            filter.login_date = {};
            if (startDate) filter.login_date.$gt = new Date(startDate).getTime();
            if (endDate) filter.login_date.$lt = new Date(endDate).getTime();
        }

        // Dynamic filters
        let userFilter = {};
        let partnerFilter = {};
        if (searchField && search) {
            if (["user_nickname", "user_id"].includes(searchField)) {
                userFilter = { [`user.${searchField}`]: { $regex: search, $options: "i" } };
            } else if (searchField === "distributor") {
                partnerFilter = { "partner.role": { $regex: search, $options: "i" } };
            } else {
                filter[searchField] = { $regex: search };
            }
        }

        const pipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: "$user" },
            ...(Object.keys(userFilter).length ? [{ $match: userFilter }] : []),
            {
                $lookup: {
                    from: "block_ips",
                    localField: "ip_address",
                    foreignField: "ip_address",
                    as: "block_ip",
                },
            },
            {
                $lookup: {
                    from: "partners",
                    localField: "user.own_partner_id",
                    foreignField: "_id",
                    as: "own_partner",
                },
            },
            {
                $lookup: {
                    from: "partners",
                    localField: "user.partner_id",
                    foreignField: "_id",
                    as: "partner",
                },
            },
            ...(Object.keys(partnerFilter).length
                ? [
                    {
                        $match: {
                            $or: [
                                { "own_partner.role": partnerFilter["partner.role"] },
                                { "partner.role": partnerFilter["partner.role"] },
                            ],
                        },
                    },
                ]
                : []),
        ];

        const result = await UserLoginHistoryModel.aggregate(pipeline);

        const data = result.map((element) => ({
            user_id: element.user.user_nickname || "",
            user_nickname: element.user.user_nickname || "",
            own_partner_id: element.own_partner[0]?.partner_id || "",
            own_partner_nickname: element.own_partner[0]?.nickname || "",
            own_partner_role: element.own_partner[0]?.role || "",
            partner_id: element.partner[0]?.partner_id || "",
            partner_nickname: element.partner[0]?.nickname || "",
            partner_role: element.partner[0]?.role || "",
            ip_address: element.ip_address,
            block_ip: element.block_ip.length > 0,
            location: element.location,
            login_time: moment(element.login_date).format("YYYY-MM-DD HH:mm:ss"),
            mobile: element.mobile || "",
        }));

        responseSuccess(res, data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
