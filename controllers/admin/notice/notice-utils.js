import PartnerModel from "../../../models/Partner.js";
import mongoose from "mongoose";

export const normalizePartnerIds = async (partnerIds) => {
  try {
    if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
      return [];
    }

    const normalizedIds = [];
    for (const partnerId of partnerIds) {
      if (!partnerId) continue;
      
      const idString = String(partnerId).trim();
      
      if (mongoose.Types.ObjectId.isValid(idString)) {
        normalizedIds.push(idString);
      } else {
        try {
          const partner = await PartnerModel.findOne({ partner_id: idString }).lean();
          if (partner && partner._id) {
            normalizedIds.push(partner._id.toString());
          }
        } catch (error) {
          console.error(`Error normalizing partner ID ${idString}:`, error);
        }
      }
    }

    return normalizedIds;
  } catch (error) {
    console.error("Error to normalize partner ids:", error);
    return [];
  }
};

