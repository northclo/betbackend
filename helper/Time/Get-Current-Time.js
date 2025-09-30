import moment from "moment-timezone";
import { config } from "../../config/index.js";

export const getCurrentTime = () => {
    const currentTime = moment().tz(config.TIME_ZONE).valueOf();

    return currentTime;
}