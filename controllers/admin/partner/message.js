import moment from "moment";
import PartnerMessageModal from "../../../models/PartnerMessage.js";
import { responseSuccess } from "../../../helper/response.js";

export const sendMessage = async (req, res) => {
    const { title, content, expire, type, partnerId } = req.body;
    const userId = req.session._id;

    let expireAt = Date.now()
    if (expire === "moon") {
        expireAt = moment().endOf('month').valueOf();
    } else {
        const current = moment(Date.now());
        const formattedExpireAt = current.add(Number(expire.split(' ')[0]), expire.split(" ")[1]);
        expireAt = formattedExpireAt.valueOf()
    }

    await PartnerMessageModal.create({
        partner_id: partnerId,
        sender: userId,
        title: title,
        content: content,
        expire_at: expireAt,
        type: type
    })

    responseSuccess(res)
}