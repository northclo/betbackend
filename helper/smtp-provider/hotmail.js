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

export const smtpProviderForHotmail = async (name, email, subject, text) => {
  await transporter.sendMail({
    from: name,
    to: email,
    subject: subject,
    text: text,
  });
};
