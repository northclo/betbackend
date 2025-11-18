import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { responseBadRequest, responseSuccess } from "../../../helper/response.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { t } from "../../../helper/translation.js";

export const registerUser = async (req, res) => {
    try {
        const payload = req.body;
        const adminId = req.session._id;

        if (!payload.nickname || !payload.nickname.trim()) {
            return responseBadRequest(res, t("nickname_required"));
        }

        if (!payload.password || !payload.password.trim()) {
            return responseBadRequest(res, t("password_required"));
        }

        if (!payload.userName || !payload.userName.trim()) {
            return responseBadRequest(res, t("user_name_required"));
        }

        const existingUser = await UserModel.findOne({ user_nickname: payload.nickname.trim() });
        if (existingUser) {
            return responseBadRequest(res, t("nickname_exists"));
        }

        let partnerId = null;
        if (payload.partner) {
            const partner = await PartnerModel.findOne({ partner_id: payload.partner });
            if (partner) {
                partnerId = partner._id;
            }
        } else {
            const adminPartner = await PartnerModel.findOne({
                $or: [
                    { admin_id: new mongoose.Types.ObjectId(adminId) },
                    { user_id: new mongoose.Types.ObjectId(adminId) }
                ]
            });
            if (adminPartner) {
                partnerId = adminPartner._id;
            }
        }

        if (!partnerId) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(payload.password.trim(), salt);

        await UserModel.create({
            user_nickname: payload.nickname.trim(),
            user_email: payload.nickname.trim() + "@gmail.com",
            password: hashedPassword,
            user_name: payload.userName.trim(),
            partner_id: partnerId,
            phone_number: payload.phoneNumber || '',
            bank_id: payload.bankName || '',
            bank_number: payload.bankNumber || '',
            bank_owner_name: payload.bankOwner || '',
            memo_note: payload.memo || '',
            simple_bet_rate: payload.simpleBetRate ? Number(payload.simpleBetRate) : null,
            combined_bet_rate: payload.combinedBetRate ? Number(payload.combinedBetRate) : null,
            match_num_bet_rate: payload.matchNumberBetRate ? Number(payload.matchNumberBetRate) : null,
        });

        responseSuccess(res);
    } catch (error) {
        console.error('Error registering user:', error);
        return responseBadRequest(res, t("failed_register_user"));
    }
}