import isEmpty from "is-empty";
import { responseSuccess } from "../../../helper/response.js";
import SettingModel from "../../../models/Setting.js";

export const getSiteSetting = async (req, res) => {
    const siteSetting = await SettingModel.find();

    let result;
    if (isEmpty(siteSetting)) {
        result = await SettingModel.create({})
    } else {
        result = siteSetting;
    }
    responseSuccess(res, '', result);
}

export const updateSiteSetting = async (req, res) => {
    const siteSetting = await SettingModel.find();

    if (isEmpty(siteSetting)) {
        await SettingModel.create(req.body);
        responseSuccess(res)
    } else {
        await SettingModel.updateOne({ _id: siteSetting[0]._id }, req.body);
        responseSuccess(res)
    }
}