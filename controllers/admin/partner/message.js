import moment from "moment";
import PartnerMessageModel from "../../../models/PartnerMessage.js";
import PartnerModel from "../../../models/Partner.js";
import { responseBadRequest, responseSuccess, responseServerError, responseUnAutherized, responsePermissionDenied } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { messageType, partnerType } from "../../../const/type.js";
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

        const { id, title, content, expire, type } = req.body;
        const senderId = req.session._id;

        if (!title || !title.trim()) {
            return responseBadRequest(res, t("title_required"));
        }

        if (!content || !content.trim()) {
            return responseBadRequest(res, t("content_required"));
        }

        if (!type) {
            return responseBadRequest(res, t("type_required"));
        }

        const validTypes = [messageType.groupMessasge, messageType.notice];
        if (!validTypes.includes(type)) {
            return responseBadRequest(res, t("invalid_message_type"));
        }

        let receiverId = null;
        if (id && type === messageType.groupMessasge) {
            const targetPartner = await PartnerModel.findOne({ partner_id: id.trim() });
            if (!targetPartner) {
                return responseBadRequest(res, t("partner_not_found"));
            }
            receiverId = targetPartner._id;
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
            receiver: receiverId,
            title: title.trim(),
            content: content.trim(),
            expire_at: expireAt,
            type: type
        });

        if (type === messageType.groupMessasge && receiverId) {
            try {
                const io = req.app.get("io");
                const onlineUsers = req.app.get("onlineUsers");
                
                if (io && onlineUsers) {
                    const accessiblePartnerIds = await fetchAccessiblePartnerIds(receiverId);
                    
                    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);
                    
                    const sender = await PartnerModel.findById(senderId).select("nickname").lean();
                    const senderName = sender?.nickname || t("admin");
                    
                    const notificationData = {
                        messageId: message._id.toString(),
                        title: message.title,
                        content: message.content,
                        sender: senderName,
                        receiverPartnerId: receiverId.toString(),
                        createdAt: message.createdAt,
                    };
                    
                    let notifiedCount = 0;
                    for (const userId of accessibleUserIds) {
                        const userIdStr = userId.toString();
                        if (onlineUsers.has(userIdStr)) {
                            const socketId = onlineUsers.get(userIdStr);
                            io.to(socketId).emit("new_group_message", notificationData);
                            notifiedCount++;
                        }
                    }
                    
                    console.log(`Sent group message notification to ${notifiedCount} online users`);
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