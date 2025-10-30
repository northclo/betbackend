import moment from "moment-timezone";
import { config } from "../../config/index.js";

export const getCurrentTime = () => {
    
    console.log("timezone config--->", config.TIME_ZONE);
    
    const currentTime = moment().tz(config.TIME_ZONE).valueOf();

    return currentTime;
}