import PartnerModel from "../../../models/Partner.js";
import mongoose from "mongoose";

export const getSubPartnerIds = async (userId) => {
  const results = await PartnerModel.aggregate([
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(userId),
      }
    },
    {
      $graphLookup: {
        from: 'partners',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parent_partner_id',
        as: 'subs'
      }
    },
  ]);

  if (!results.length) return [];

  const root = results[0];
  const allPartnerIds = [
    root._id.toString(),
    ...(root.subs || []).map(sub => sub._id.toString())
  ];

  return allPartnerIds;
};

export const normalizePartnerIds = async (partnerIds) => {
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
};

