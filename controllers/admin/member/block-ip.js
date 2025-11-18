import BlockIpModel from "../../../models/BlockIp.js";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const blockIp = async (req, res) => {
    try {
        const { ip, block } = req.body;

        if (!ip || typeof ip !== 'string' || ip.trim() === '') {
            return responseBadRequest(res, t("ip_address_required"));
        }

        if (typeof block !== 'boolean') {
            return responseBadRequest(res, t("block_status_must_be_boolean"));
        }

        const actionUserId = req.session?._id || null;
        const blockedIp = await BlockIpModel.findOne({ ip_address: ip });

        if (block) {
            if (!blockedIp) {
                await BlockIpModel.create({
                    ip_address: ip,
                    action_user_id: actionUserId
                });
                return responseSuccess(res, { blocked: true }, t("ip_address_blocked_successfully"));
            }
            return responseSuccess(res, { blocked: true }, t("ip_address_already_blocked"));
        } else {
            if (blockedIp) {
                await BlockIpModel.deleteOne({ ip_address: ip });
                return responseSuccess(res, { blocked: false }, t("ip_address_unblocked_successfully"));
            }
            return responseSuccess(res, { blocked: false }, t("ip_address_already_unblocked"));
        }
    } catch (err) {
        return responseServerError(res);
    }
}

export const getBlockedIps = async (req, res) => {
    try {
        const blockedIps = await BlockIpModel.find({})
            .sort({ createdAt: -1 })
            .lean();

        const formattedList = blockedIps.map(item => ({
            id: item._id.toString(),
            ip_address: item.ip_address,
            registration_date: item.createdAt
        }));

        return responseSuccess(res, { list: formattedList });
    } catch (err) {
        console.error("Error fetching blocked IPs:", err);
        return responseServerError(res);
    }
}

export const removeBlockedIp = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return responseBadRequest(res, t("ip_id_required"));
        }

        const result = await BlockIpModel.deleteOne({ _id: id });

        if (result.deletedCount === 0) {
            return responseBadRequest(res, t("blocked_ip_not_found"));
        }

        return responseSuccess(res, null, t("blocked_ip_removed_successfully"));
    } catch (err) {
        console.error("Error removing blocked IP:", err);
        return responseServerError(res);
    }
}