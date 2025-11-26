import mongoose from "mongoose";
import SupportMessage from "../../../models/SupportMessage.js";
import {
  responseBadRequest,
  responseSuccess,
  responseServerError,
  responseUnAutherized,
} from "../../../helper/response.js";
import { t } from "../../../helper/translation.js";
import { fetchAccessiblePartnerIds, fetchAccessibleUserIds } from "../../../helper/Partner/fetch-accessible-partners.js";

export const bulkDeleteSupportTickets = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const accessiblePartnerIds = await fetchAccessiblePartnerIds(adminId);
    const accessibleUserIds = await fetchAccessibleUserIds(accessiblePartnerIds);

    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return responseBadRequest(res, t("ticket_ids_required"));
    }

    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return responseBadRequest(res, t("no_valid_ticket_ids"));
    }

    const tickets = await SupportMessage.find({
      _id: { $in: validIds }
    }).select("writer").lean();

    const allAccessibleIds = [...accessibleUserIds, ...accessiblePartnerIds];
    const accessibleTicketIds = tickets
      .filter(ticket => allAccessibleIds.some(aid => aid.toString() === ticket.writer.toString()))
      .map(ticket => ticket._id);

    if (accessibleTicketIds.length === 0) {
      return responseSuccess(
        res,
        { deletedCount: 0 },
        t("successfully_deleted_tickets", 0)
      );
    }

    const result = await SupportMessage.deleteMany({
      _id: { $in: accessibleTicketIds }
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

