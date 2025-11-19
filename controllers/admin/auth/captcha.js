import svgCaptcha from 'svg-captcha';
import { responseSuccess, responseServerError } from '../../../helper/response.js';

export const getCaptcha = async (req, res) => {
    try {
        const captcha = svgCaptcha.create({
            size: 4,
            noise: 2,
            color: true,
            background: '#f2f2f2'
        });

        req.session.captcha = captcha.text;
        res.type('svg');
        responseSuccess(res, captcha);
    } catch (error) {
        console.error("Error to generate captcha:", error);
        return responseServerError(res);
    }
}