import BlockIpModel from "../../../models/BlockIp.js";
import { responseSuccess } from "../../../helper/response.js";

export const blockIp = async (req, res) => {
    const { ip, block } = req.body;

    const blockedIp = await BlockIpModel.findOne({ ip_address: ip });

    if (blockedIp && block) {
        await BlockIpModel.deleteOne({ ip_address: ip });
    } else if (!blockedIp && !block) {
        await BlockIpModel.create({
            ip_address: ip
        });
    }

    responseSuccess(res)
}