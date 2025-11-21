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
      let objectId = null;
      
      if (mongoose.Types.ObjectId.isValid(idString)) {
        objectId = new mongoose.Types.ObjectId(idString);
      } else {
        try {
          const partner = await PartnerModel.findOne({ partner_id: idString }).lean();
          if (partner && partner._id) {
            objectId = partner._id;
          }
        } catch (error) {
          console.error(`Error normalizing partner ID ${idString}:`, error);
        }
      }
      
      if (objectId) {
        normalizedIds.push(objectId);
      }
    }

    return normalizedIds;
  } catch (error) {
    console.error("Error to normalize partner ids:", error);
    return [];
  }
};

