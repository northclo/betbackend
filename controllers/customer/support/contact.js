import requestIp from "request-ip";
import SupportMessage from "../../../models/SupportMessage.js";
import UserModel from "../../../models/User.js";
import PartnerModel from "../../../models/Partner.js";
import SettingModel from "../../../models/Setting.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { getAllParentPartnerIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const submitContact = async (req, res) => {
  try {
    const userId = req.session._id;

    if (!userId) {
      return responseUnAutherized(res);
    }

    const { title, question } = req.body;

    if (!title || String(title).trim().length === 0) {
      return responseBadRequest(res, t("title_required"));
    }

    if (!question || String(question).trim().length === 0) {
      return responseBadRequest(res, t("question_required"));
    }

    let user = await UserModel.findById(userId).lean();
    if (!user) {
      user = await PartnerModel.findById(userId).lean();
      if (!user) {
        return responseUnAutherized(res);
      }
    }

    const setting = await SettingModel.findOne().lean();

    if (setting?.customer_center) {
      const pendingInquiry = await SupportMessage.findOne({
        writer: userId,
        status: "PENDING",
      }).lean();

      if (pendingInquiry) {
        return responseBadRequest(res, t("cannot_submit_new_inquiry_with_pending"));
      }
    }

    const ipAddress = requestIp.getClientIp(req) || req.ip || req.connection?.remoteAddress || t("unknown");
  
    const cleanIp = ipAddress.replace(/^::ffff:/, "");

    const firstMessage = await SupportMessage.findOne({ writer: userId })
      .sort({ first_message_date: 1, createdAt: 1 })
      .lean();

    const firstMessageDate = firstMessage?.first_message_date || new Date();

    const supportMessage = await SupportMessage.create({
      writer: userId,
      title: String(title).trim(),
      question: String(question).trim(),
      status: "NEW",
      first_message_date: firstMessageDate,
      send_date: new Date(),
      ip_address: cleanIp,
    });

    try {
      const io = req.app.get("io");
      if (io) {
        const parentPartnerIds = await getAllParentPartnerIds(userId);

        io.emit("new_support_message", {
          parentPartnerIds: parentPartnerIds,
        });
      }
    } catch (socketError) {
      console.error("Error emitting socket event:", socketError);
    }

    return responseSuccess(
      res,
      {
        id: supportMessage._id.toString(),
        title: supportMessage.title,
        question: supportMessage.question,
        status: supportMessage.status,
      },
      t("question_submitted_successfully")
    );
  } catch (error) {
    console.error("Error submitting contact:", error);
    return responseServerError(res);
  }
};

