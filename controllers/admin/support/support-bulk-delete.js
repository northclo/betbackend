import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseBadRequest,
  responseSuccess,
  responseServerError,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";

export const bulkDeleteSupportTickets = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return responseBadRequest(res, t("ticket_ids_required"));
    }

    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return responseBadRequest(res, t("no_valid_ticket_ids"));
    }

    const result = await SupportMessage.deleteMany({
      _id: { $in: validIds }
    });

    return responseSuccess(
      res,
      { deletedCount: result.deletedCount },
      t("successfully_deleted_tickets", result.deletedCount)
    );
  } catch (error) {
    console.error("Error bulk deleting support tickets:", error);
    return responseServerError(res);
  }
};

