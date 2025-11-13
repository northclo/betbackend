import BlockIpModel from "../../../models/BlockIp.js";
import { responseSuccess, responseBadRequest, responseServerError } from "../../../helper/response.js";

export const blockIp = async (req, res) => {
    try {
        const { ip, block } = req.body;

        if (!ip || typeof ip !== 'string' || ip.trim() === '') {
            return responseBadRequest(res, "IP address is required.");
        }

        if (typeof block !== 'boolean') {
            return responseBadRequest(res, "Block status must be a boolean value.");
        }

        const blockedIp = await BlockIpModel.findOne({ ip_address: ip });

        if (block) {
            if (!blockedIp) {
                await BlockIpModel.create({
                    ip_address: ip
                });
                return responseSuccess(res, { blocked: true }, "IP address blocked successfully.");
            }
            return responseSuccess(res, { blocked: true }, "IP address is already blocked.");
        } else {
            if (blockedIp) {
                await BlockIpModel.deleteOne({ ip_address: ip });
                return responseSuccess(res, { blocked: false }, "IP address unblocked successfully.");
            }
            return responseSuccess(res, { blocked: false }, "IP address is already unblocked.");
        }
    } catch (err) {
        return responseServerError(res);
    }
}