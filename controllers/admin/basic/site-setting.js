import isEmpty from "is-empty";
import { responseSuccess } from "../../../helper/response.js";
import SiteSettingModel from "../../../models/site-setting.js";

export const getSiteSetting = async (req, res) => {
    const siteSetting = await SiteSettingModel.find();

    let result;
    if (isEmpty(siteSetting)) {
        result = await SiteSettingModel.create({})
    } else {
        result = siteSetting;
    }
    responseSuccess(res, '', result);
}

export const updateSiteSetting = async (req, res) => {
    const siteSetting = await SiteSettingModel.find();

    if (isEmpty(siteSetting)) {
        await SiteSettingModel.create(req.body);
        responseSuccess(res)
    } else {
        await SiteSettingModel.updateOne({ _id: siteSetting[0]._id }, req.body);
        responseSuccess(res)
    }
}