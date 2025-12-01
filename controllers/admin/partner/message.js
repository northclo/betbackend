import moment from "moment";
import PartnerMessageModel from "../../../models/PartnerMessage.js";
import PartnerModel from "../../../models/Partner.js";
import { responseBadRequest, responseSuccess, responseServerError, responseUnAutherized, responsePermissionDenied } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { partnerType } from "../../../const/type.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const sendMessage = async (req, res) => {
    try {
        const currentPartnerId = req.session?._id;
        if (!currentPartnerId) {
            return responseUnAutherized(res);
        }

        const currentPartner = await PartnerModel.findById(currentPartnerId).lean();
        if (!currentPartner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        const isHeadquater = currentPartner.role === partnerType.headquater;
        const hasPartnerAccessPermission = currentPartner.partner_access_permission === true;

        if (!isHeadquater && !hasPartnerAccessPermission) {
            return responsePermissionDenied(res);
        }

        const { id, title, content, expire } = req.body;
        const senderId = req.session._id;

        if (!title || !title.trim()) {
            return responseBadRequest(res, t("title_required"));
        }

        if (!content || !content.trim()) {
            return responseBadRequest(res, t("content_required"));
        }

        let receiverIds = [];
        if (id) {
            const targetPartner = await PartnerModel.findOne({ partner_id: id.trim() });
            if (!targetPartner) {
                return responseBadRequest(res, t("partner_not_found"));
            }
            const accessiblePartnerIds = await fetchAccessiblePartnerIds(targetPartner._id);
            const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);
            receiverIds = [...accessibleUserIds, ...accessiblePartnerIds];
        }

        let expireAt = null;

        if (expire && expire !== "0" && expire !== "::No period set::") {
            if (expire === "full moon" || expire === "moon") {
                expireAt = moment().endOf('month').valueOf();
            } else if (expire === "a week") {
                expireAt = moment().add(1, 'week').valueOf();
            } else if (expire === "month") {
                expireAt = moment().add(1, 'month').valueOf();
            } else {
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

        const message = await PartnerMessageModel.create({
            sender: senderId,
            receivers: receiverIds,
            title: title.trim(),
            content: content.trim(),
            expire_at: expireAt
        });

        if (receiverIds.length > 0) {
            try {
                const io = req.app.get("io");
                
                if (io) {
                    const sender = await PartnerModel.findById(senderId).select("nickname").lean();
                    const senderName = sender?.nickname || t("admin");
                    
                    const notificationData = {
                        targetIds: receiverIds,
                        messageId: message._id.toString(),
                        title: message.title,
                        content: message.content,
                        sender: senderName,
                        createdAt: message.createdAt,
                    };
                    
                    io.emit("new_group_message", notificationData);
                }
            } catch (socketError) {
                console.error("Error emitting socket event for group message:", socketError);
            }
        }

        return responseSuccess(res);
    } catch (error) {
        console.error("Error sending message:", error);
        return responseServerError(res);
    }
}