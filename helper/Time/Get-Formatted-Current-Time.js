import moment from "moment-timezone";
import { config } from "../../config/index.js";

export const getFormattedCurrentTime = () => {
    const currentTime = moment().tz(config.TIME_ZONE).format('YYYY-MM-DD HH:mm:ss');

    return currentTime;
}