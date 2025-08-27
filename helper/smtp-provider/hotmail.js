import nodemailer from "nodemailer";

import { config } from "../../config/index.js";

// Setup gmail transporter
const transporter = nodemailer.createTransport({
  service: "hotmail",
  auth: {
    user: config.HOTMAIL_USER,
    pass: config.HOTMAIL_PASS,
  },
});

/**
 * @summary
 * This featuer sends message to user via hotmail using nodemailer
 *
 * @param {string} name - service name
 * @param {string} email - user email
 * @param {string} subject - message subject
 * @param {string} text - message
 */
export const smtpProviderForHotmail = async (name, email, subject, text) => {
  await transporter.sendMail({
    from: name,
    to: email,
    subject: subject,
    text: text,
  });
};
