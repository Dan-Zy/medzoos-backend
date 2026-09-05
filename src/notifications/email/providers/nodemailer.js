const nodemailer = require('nodemailer');
const env = require('../../../config/env');
const { logger } = require('../../../utils/logger');
const { resolveSender, EMAIL_CHANNELS } = require('../email.constants');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    const smtpUser = env.SMTP_USER || process.env.SMTP_USER;
    const smtpPass = env.SMTP_PASS || process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      throw new Error(
        'SMTP credentials are missing. Please set SMTP_USER and SMTP_PASS in .env',
      );
    }

    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || process.env.SMTP_HOST || 'smtp.azurecomm.net',
      port: env.SMTP_PORT || Number(process.env.SMTP_PORT) || 587,
      secure: env.SMTP_SECURE || false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }
  return transporter;
}

/**
 * Sends an email using Nodemailer SMTP transport.
 * @param {Object} options
 * @param {string|string[]} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} [options.text]
 * @param {string} [options.senderKey]
 * @param {string} [options.senderAddress]
 * @param {string} [options.replyTo]
 */
const sendEmail = async ({
  to,
  subject,
  html,
  text,
  senderKey = 'DONOTREPLY',
  senderAddress,
  replyTo,
}) => {
  const resolved = resolveSender(senderAddress || senderKey);
  const from = resolved.fromFormatted;
  const transport = getTransporter();

  const toRecipients = Array.isArray(to) ? to.join(', ') : to;

  const mailOptions = {
    from,
    to: toRecipients,
    subject,
    html,
    text:
      text ||
      html
        .replace(/<style[^>]*>.*<\/style>/gis, '')
        .replace(/<[^>]+>/g, ' ')
        .trim(),
    replyTo: replyTo
      ? { name: resolved.displayName, address: replyTo }
      : { name: resolved.displayName, address: EMAIL_CHANNELS.SUPPORT.address },
  };

  try {
    const info = await transport.sendMail(mailOptions);
    logger.info(`[Nodemailer] Email "${subject}" sent to ${toRecipients} (MsgID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`[Nodemailer] Dispatch error: ${error.message}`);
    throw error;
  }
};

module.exports = { sendEmail, getTransporter };
