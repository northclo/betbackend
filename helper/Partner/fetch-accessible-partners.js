import mongoose from "mongoose";
import PartnerModel from "../../models/Partner.js";
import UserModel from "../../models/User.js";


export const fetchAccessiblePartnerIds = async (partnerId) => {
    if (!partnerId) return [];

    try {
        const partnerObjectId = new mongoose.Types.ObjectId(partnerId);
        
        const results = await PartnerModel.aggregate([
            {
                $match: {
                    _id: partnerObjectId
                }
            },
            {
                $graphLookup: {
                    from: "partners",
                    startWith: "$_id",
                    connectFromField: "_id",
                    connectToField: "parent_partner_id",
                    as: "subs",
                },
            },
            {
                $project: {
                    allPartners: { $concatArrays: [["$$ROOT"], "$subs"] },
                },
            },
            { $unwind: "$allPartners" },
            {
                $replaceRoot: { newRoot: "$allPartners" },
            },
            {
                $project: {
                    _id: 1,
                },
            },
        ]);

        if (!results.length) {
            return [partnerObjectId];
        }

        return results.map((doc) => doc._id);
    } catch (error) {
        console.error("Error fetching accessible partner IDs:", error);
        return [];
    }
};

export const fetchAccessibleUserIds = async (accessiblePartnerIds) => {
    if (!accessiblePartnerIds || accessiblePartnerIds.length === 0) {
        return [];
    }

    try {
        const users = await UserModel.find({
            $or: [
                { partner_id: { $in: accessiblePartnerIds } },
                { ownpartner_id: { $in: accessiblePartnerIds } }
            ]
        }).select("_id").lean();

        return users.map((user) => user._id);
    } catch (error) {
        console.error("Error fetching accessible user IDs:", error);
        return [];
    }
};
