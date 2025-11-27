import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import { responseBadRequest, responseSuccess, responseServerError } from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const getUserInfo = async (req, res) => {
    try {
        const userId = req.session._id;
        
        if (!userId) {
            return responseBadRequest(res, t("user_not_found"));
        }

        let user = await UserModel.findOne({ _id: userId }).lean();
        
        if (!user) {
            user = await PartnerModel.findById(userId).lean();
            if (!user) {
                return responseBadRequest(res, t("user_not_found"));
            }
            user.role = "partner";
        } else {
            user.role = "user";
        }

        delete user.password;
        delete user.exchange_secure_number;

        return responseSuccess(res, user);
    } catch (error) {
        console.error("Error in getUserInfo:", error);
        return responseServerError(res);
    }
};

