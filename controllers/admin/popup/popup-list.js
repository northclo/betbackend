import PopupModel from "../../../models/Popup.js";
import {
  responseBadRequest,
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";
import {
  toPopupDto,
  normalizeStatus,
} from "./popup-utils.js";
import { t } from "../../../helper/translation.js";

export const listPopups = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const { 
      status, 
      keyword,
      startDate,
      endDate,
      page = 1, 
      limit = 10 
    } = req.query;

    const filter = {};

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus) {
      filter.status = normalizedStatus;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return responseBadRequest(res, t("invalid_startdate_format"));
        }
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return responseBadRequest(res, t("invalid_enddate_format"));
        }
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
      
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
          return responseBadRequest(res, t("start_date_before_end_date"));
        }
      }
    }

    if (keyword && String(keyword).trim().length > 0) {
      const keywordRegex = new RegExp(String(keyword).trim(), "i");
      filter.$or = [
        { title: keywordRegex },
        { content: keywordRegex },
      ];
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const [popups, total] = await Promise.all([
      PopupModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      PopupModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    const items = (await Promise.all(popups.map((popup) => toPopupDto(popup)))).filter(
      (item) => item !== null
    );

    return responseSuccess(res, {
      list: items,
      page: pageNumber,
      pageSize: pageSize,
      limit: pageSize,
      total,
      totalPages,
    });
  } catch (error) {
    console.error("Error to list popups:", error);
    return responseServerError(res);
  }
};

