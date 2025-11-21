import BankAccountModel from "../../../models/BankAccount.js";
import {
  responseSuccess,
  responseUnAutherized,
  responseServerError,
} from "../../../helper/response.js";

export const listBankAccounts = async (req, res) => {
  try {
    const adminId = req?.session?._id;
    if (!adminId) {
      return responseUnAutherized(res);
    }

    const {
      keyword = "",
      page = 1,
      limit = 10,
      sort = "createdAt",
      order = "desc"
    } = req.query;

    const filter = {};

    if (keyword && String(keyword).trim().length > 0) {
      const keywordRegex = new RegExp(String(keyword).trim(), "i");
      filter.bank_name = keywordRegex;
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const skip = (pageNumber - 1) * pageSize;

    const sortOrder = order === "asc" ? 1 : -1;
    const sortField = sort === "bank_name" ? "bank_name" : "createdAt";
    const sortConfig = { [sortField]: sortOrder };

    const [bankAccounts, total] = await Promise.all([
      BankAccountModel.find(filter)
        .sort(sortConfig)
        .skip(skip)
        .limit(pageSize)
        .lean(),
      BankAccountModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    const items = bankAccounts.map((bankAccount) => ({
      id: bankAccount._id.toString(),
      _id: bankAccount._id.toString(),
      bank_name: bankAccount.bank_name,
      createdAt: bankAccount.createdAt ? new Date(bankAccount.createdAt).toISOString() : null,
      updatedAt: bankAccount.updatedAt ? new Date(bankAccount.updatedAt).toISOString() : null,
    }));

    return responseSuccess(res, {
      list: items,
      items: items,
      page: pageNumber,
      pageSize: pageSize,
      limit: pageSize,
      total,
      totalPages,
    });
  } catch (error) {
    console.error("Error to list bank accounts:", error);
    return responseServerError(res);
  }
};

