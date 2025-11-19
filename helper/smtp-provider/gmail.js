import nodemailer from "nodemailer";

import { config } from "../../config/index.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.GMAIL_USER,
    pass: config.GMAIL_PASS,
  },
});

export const smtpProviderForGmail = async (name, email, subject, text) => {
  await transporter.sendMail({
    from: name,
    to: email,
    subject: subject,
    text: text,
  });
};
