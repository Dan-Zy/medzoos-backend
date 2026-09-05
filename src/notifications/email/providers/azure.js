const { EmailClient } = require('@azure/communication-email');
const env = require('../../../config/env');
const { logger } = require('../../../utils/logger');
const { resolveSender, BRAND_NAME, EMAIL_CHANNELS } = require('../email.constants');

let emailClient = null;

function getEmailClient() {
  if (!emailClient) {
    const connectionString =
      env.AZURE_COMMUNICATION_CONNECTION_STRING ||
      process.env.AZURE_COMMUNICATION_CONNECTION_STRING;

    if (!connectionString) {
      throw new Error(
        'Azure Communication Services connection string is missing. Please set AZURE_COMMUNICATION_CONNECTION_STRING in .env'
      );
    }

    emailClient = new EmailClient(connectionString);
  }
  return emailClient;
}

/**
 * Sends an email using Azure Communication Services SDK.
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email or array of emails
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content fallback
 * @param {string} [options.senderKey] - Channel key (e.g. 'AUTH', 'SECURITY', 'ACCOUNTS', 'DONOTREPLY')
 * @param {string} [options.senderAddress] - Direct verified sender email (e.g. 'auth@medzoos.pk')
 * @param {string} [options.replyTo] - Reply-To email
 * @returns {Promise<{ success: boolean, messageId: string, status: string }>}
 */
async function sendEmail({
  to,
  subject,
  html,
  text,
  senderKey = 'DONOTREPLY',
  senderAddress,
  replyTo,
}) {
  const client = getEmailClient();
  const resolved = resolveSender(senderAddress || senderKey);
  const actualSender = resolved.address;
  const replyToAddress = replyTo || EMAIL_CHANNELS.SUPPORT?.address || 'support@medzoos.pk';

  const recipientsList = (Array.isArray(to) ? to : [to])
    .map((addr) => {
      const clean = String(addr || '').trim();
      return clean ? { address: clean } : null;
    })
    .filter(Boolean);

  if (!recipientsList.length) {
    throw new Error('No valid recipients provided for email.');
  }

  const plainTextContent =
    text ||
    html
      .replace(/<style[^>]*>.*<\/style>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const message = {
    senderAddress: actualSender,
    content: {
      subject,
      plainText: plainTextContent,
      html,
    },
    recipients: {
      to: recipientsList,
    },
    replyTo: [
      {
        address: replyToAddress,
        displayName: BRAND_NAME,
      },
    ],
  };

  try {
    logger.info(
      `[AzureEmail] Sending "${subject}" from <${actualSender}> (${resolved.displayName}) to ${recipientsList
        .map((r) => r.address)
        .join(', ')}`
    );

    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();

    if (result.status === 'Succeeded') {
      logger.info(
        `[AzureEmail] Successfully dispatched "${subject}" (ID: ${result.id})`
      );
      return {
        success: true,
        messageId: result.id,
        status: result.status,
      };
    } else {
      const errorMsg = `Azure email send ended with status: ${result.status} (ID: ${result.id})`;
      logger.error(`[AzureEmail] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  } catch (error) {
    logger.error(`[AzureEmail] Dispatch failed: ${error.message}`);
    throw error;
  }
}

module.exports = {
  sendEmail,
  getEmailClient,
};
