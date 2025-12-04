import { responseSuccess, responseServerError, responseUnAutherized, responseBadRequest } from "../../../helper/response.js";
import SettingModel from "../../../models/Setting.js";
import PartnerModel from "../../../models/Partner.js";
import { partnerType } from "../../../const/type.js";
import { t } from "../../../helper/translation.js";

export const getAlarmSettings = async (req, res) => {
    try {
        const currentPartnerId = req.session?._id;
        if (!currentPartnerId) {
            return responseUnAutherized(res);
        }

        const currentPartner = await PartnerModel.findById(currentPartnerId).lean();
        if (!currentPartner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        const setting = await SettingModel.findOneAndUpdate(
            {},
            {},
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true
            }
        );

        const alarmSettings = setting.alarm_settings || {
            withdrawal_alarm: {
                sound_file: "alarm1.mp3",
                volume: 100
            },
            deposit_alarm: {
                sound_file: "alarm2.mp3",
                volume: 100
            },
            customer_alert: {
                sound_file: "alarm3.mp3",
                volume: 100
            }
        };

        const formattedSettings = {
            withdrawalAlarm: {
                soundFile: alarmSettings.withdrawal_alarm?.sound_file || "alarm1.mp3",
                volume: alarmSettings.withdrawal_alarm?.volume ?? 100
            },
            depositAlarm: {
                soundFile: alarmSettings.deposit_alarm?.sound_file || "alarm2.mp3",
                volume: alarmSettings.deposit_alarm?.volume ?? 100
            },
            customerAlert: {
                soundFile: alarmSettings.customer_alert?.sound_file || "alarm3.mp3",
                volume: alarmSettings.customer_alert?.volume ?? 100
            }
        };

        return responseSuccess(res, formattedSettings);
    } catch (error) {
        console.error("Error fetching alarm settings:", error);
        return responseServerError(res);
    }
};

export const updateAlarmSettings = async (req, res) => {
    try {
        const currentPartnerId = req.session?._id;
        if (!currentPartnerId) {
            return responseUnAutherized(res);
        }

        const currentPartner = await PartnerModel.findById(currentPartnerId).lean();
        if (!currentPartner) {
            return responseBadRequest(res, t("partner_not_found"));
        }

        const { alarmType, soundFile, volume } = req.body;

        if (!alarmType) {
            return responseBadRequest(res, t("alarm_type_required"));
        }

        const validAlarmTypes = ["withdrawalAlarm", "depositAlarm", "customerAlert"];
        if (!validAlarmTypes.includes(alarmType)) {
            return responseBadRequest(res, t("invalid_alarm_type"));
        }

        if (volume !== undefined && (volume < 0 || volume > 100)) {
            return responseBadRequest(res, t("volume_must_be_between_0_and_100"));
        }

        const alarmTypeMap = {
            withdrawalAlarm: "withdrawal_alarm",
            depositAlarm: "deposit_alarm",
            customerAlert: "customer_alert"
        };

        const backendAlarmType = alarmTypeMap[alarmType];
        const updatePath = `alarm_settings.${backendAlarmType}`;

        const updateData = {};
        if (soundFile !== undefined) {
            updateData[`${updatePath}.sound_file`] = soundFile;
        }
        if (volume !== undefined) {
            updateData[`${updatePath}.volume`] = Number(volume);
        }

        await SettingModel.findOneAndUpdate(
            {},
            { $set: updateData },
            { 
                upsert: true, 
                new: true,
                setDefaultsOnInsert: true
            }
        );

        return responseSuccess(res, { status: true, message: "Alarm setting updated successfully" });
    } catch (error) {
        console.error("Error updating alarm settings:", error);
        return responseServerError(res);
    }
};

