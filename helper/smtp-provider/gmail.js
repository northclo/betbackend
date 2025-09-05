import nodemailer from "nodemailer";

import { config } from "../../config/index.js";

// Setup gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.GMAIL_USER,
    pass: config.GMAIL_PASS,
  },
});

/**
 * @summary
 * This featuer sends message to user via google mail using nodemailer
 *
 * @param {string} name - service name
 * @param {string} email - user email
 * @param {string} subject - message subject
 * @param {string} text - message
 */
export const smtpProviderForGmail = async (name, email, subject, text) => {
  await transporter.sendMail({
    from: name,
    to: email,
    subject: subject,
    text: text,
  });
};
