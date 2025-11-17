import moment from "moment";
import PartnerMessageModal from "../../../models/PartnerMessage.js";
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const sendMessage = async (req, res) => {
    const { title, content, expire, type, partnerId } = req.body;
    const userId = req.session._id;

    if (!title || !title.trim()) {
        return responseBadRequest(res, t("title_required"));
    }

    if (!content || !content.trim()) {
        return responseBadRequest(res, t("content_required"));
    }

    if (!type) {
        return responseBadRequest(res, t("type_required"));
    }

    let expireAt = null;

    // Handle expire values
    if (expire && expire !== "0" && expire !== "::No period set::") {
        if (expire === "full moon" || expire === "moon") {
            expireAt = moment().endOf('month').valueOf();
        } else if (expire === "a week") {
            expireAt = moment().add(1, 'week').valueOf();
        } else if (expire === "month") {
            expireAt = moment().add(1, 'month').valueOf();
        } else {
            // Parse format like "1 day", "3 hours", "30 minutes", etc.
            const parts = String(expire).trim().split(' ');
            if (parts.length >= 2) {
                const amount = Number(parts[0]);
                const unit = parts[1].toLowerCase();
                
                if (isNaN(amount) || amount <= 0) {
                    return responseBadRequest(res, t("invalid_expire_format"));
                }

                const validUnits = ['minute', 'minutes', 'hour', 'hours', 'day', 'days', 'week', 'weeks', 'month', 'months'];
                const normalizedUnit = unit.endsWith('s') ? unit : unit + 's';
                
                if (!validUnits.includes(normalizedUnit)) {
                    return responseBadRequest(res, t("invalid_expire_unit"));
                }

                expireAt = moment().add(amount, normalizedUnit).valueOf();
            } else {
                return responseBadRequest(res, t("invalid_expire_format"));
            }
        }
    }

    await PartnerMessageModal.create({
        partner_id: partnerId || null,
        sender: userId,
        title: title.trim(),
        content: content.trim(),
        expire_at: expireAt,
        type: type
    })

    responseSuccess(res)
}