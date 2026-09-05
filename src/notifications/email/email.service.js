const azureProvider = require('./providers/azure');
const nodemailerProvider = require('./providers/nodemailer');
const { logger } = require('../../utils/logger');
const { EMAIL_CHANNELS, resolveSender, BRAND_NAME } = require('./email.constants');
const templates = require('./email.templates');
const env = require('../../config/env');

/**
 * Universal email dispatcher.
 * Prefers Nodemailer when SMTP is configured (supports "Medzoos" display name in From header),
 * then falls back to Azure Communication Services SDK.
 */
const sendEmail = async (toOrOptions, subject, html, senderKeyOrOptions) => {
  let options = {};

  if (typeof toOrOptions === 'object' && toOrOptions !== null && !Array.isArray(toOrOptions)) {
    options = { ...toOrOptions };
  } else {
    options = {
      to: toOrOptions,
      subject,
      html,
    };
    if (typeof senderKeyOrOptions === 'string') {
      options.senderKey = senderKeyOrOptions;
    } else if (typeof senderKeyOrOptions === 'object' && senderKeyOrOptions !== null) {
      options = { ...options, ...senderKeyOrOptions };
    }
  }

  if (!options.to || !options.subject) {
    logger.warn('[EmailService] Missing required recipient or subject. Skipping.');
    return { success: false, reason: 'missing_parameters' };
  }

  const hasSmtp = Boolean(
    (env.SMTP_USER || process.env.SMTP_USER) && (env.SMTP_PASS || process.env.SMTP_PASS),
  );

  if (hasSmtp) {
    try {
      return await nodemailerProvider.sendEmail(options);
    } catch (smtpErr) {
      logger.warn(
        `[EmailService] SMTP failed (${smtpErr.message}), attempting Azure SDK fallback...`,
      );
      try {
        return await azureProvider.sendEmail(options);
      } catch (azureErr) {
        logger.error(
          `[EmailService] Both SMTP and Azure SDK failed: ${azureErr.message}`,
        );
        throw azureErr;
      }
    }
  }

  try {
    return await azureProvider.sendEmail(options);
  } catch (azureErr) {
    logger.error(
      `[EmailService] Azure SDK failed and SMTP is not configured: ${azureErr.message}`,
    );
    throw azureErr;
  }
};

/**
 * Sends a password reset email from security@medzoos.pk
 */
async function sendPasswordResetEmail({ to, name, email, resetUrl, role = 'patient', code = null, expiresInMinutes = 15 }) {
  const recipientEmail = to || email;
  if (!recipientEmail) return;

  const html = templates.passwordResetTemplate({
    name,
    email: recipientEmail,
    resetUrl,
    role,
    code,
    expiresInMinutes,
  });

  return sendEmail({
    to: recipientEmail,
    subject: code
      ? `${code} is your Medzoos password reset code`
      : `Reset your Medzoos Password`,
    html,
    senderKey: 'DONOTREPLY',
    senderAddress: EMAIL_CHANNELS.DONOTREPLY.address,
    replyTo: EMAIL_CHANNELS.SECURITY.address,
  });
}

/**
 * Sends a welcome email upon registration from auth@medzoos.pk
 */
async function sendWelcomeEmail({ to, name, email, role = 'patient', loginUrl }) {
  const recipientEmail = to || email;
  if (!recipientEmail) return;

  const html = templates.welcomeTemplate({
    name,
    email: recipientEmail,
    role,
    loginUrl,
  });

  return sendEmail({
    to: recipientEmail,
    subject: 'Welcome to Medzoos Healthcare',
    html,
    senderKey: 'DONOTREPLY',
    senderAddress: EMAIL_CHANNELS.DONOTREPLY.address,
    replyTo: EMAIL_CHANNELS.SUPPORT.address,
  });
}

/**
 * Sends a 6-digit OTP verification code from auth@medzoos.pk
 */
async function sendOtpEmail({ to, name, code, purpose = 'login', expiresInMinutes = 10 }) {
  if (!to || !code) return;

  const html = templates.otpVerificationTemplate({
    name,
    code,
    purpose,
    expiresInMinutes,
  });

  return sendEmail({
    to,
    subject: `${code} is your Medzoos verification code`,
    html,
    senderKey: 'DONOTREPLY',
    senderAddress: EMAIL_CHANNELS.DONOTREPLY.address,
    replyTo: EMAIL_CHANNELS.SUPPORT.address,
  });
}

/**
 * Sends a partner application received notice from verify@medzoos.pk
 */
async function sendPartnerApplicationEmail({ to, businessName, contactName, role = 'vendor' }) {
  if (!to) return;

  const html = templates.partnerApplicationReceivedTemplate({
    businessName,
    contactName,
    role,
  });

  return sendEmail({
    to,
    subject: `Application Received: Medzoos ${role.toUpperCase()} Partner Program`,
    html,
    senderKey: 'VERIFY',
    senderAddress: EMAIL_CHANNELS.VERIFY.address,
  });
}

/**
 * Sends a partner status change email (Approved, Active, Rejected) from verify@medzoos.pk
 */
async function sendPartnerStatusEmail({ to, businessName, contactName, role = 'vendor', status = 'approved', note = '', dashboardUrl }) {
  if (!to) return;

  const html = templates.partnerStatusTemplate({
    businessName,
    contactName,
    role,
    status,
    note,
    dashboardUrl,
  });

  return sendEmail({
    to,
    subject: `Medzoos Partner Status Update: ${String(status).toUpperCase()}`,
    html,
    senderKey: 'VERIFY',
    senderAddress: EMAIL_CHANNELS.VERIFY.address,
  });
}

/**
 * Sends an order confirmation and invoice email from accounts@medzoos.pk
 */
async function sendOrderConfirmationEmail({ to, order, customer, items = [], total = 0, shippingAddress, trackingUrl }) {
  const recipientEmail = to || customer?.email;
  if (!recipientEmail) return;

  const orderId = String(order?.id || '').slice(0, 8).toUpperCase();
  const html = templates.orderConfirmationTemplate({
    order,
    customer,
    items,
    total,
    shippingAddress,
    trackingUrl,
  });

  return sendEmail({
    to: recipientEmail,
    subject: `Order Confirmation #${orderId} — Medzoos Pharmacy`,
    html,
    senderKey: 'ACCOUNTS',
    senderAddress: EMAIL_CHANNELS.ACCOUNTS.address,
  });
}

/**
 * Sends doctor consultation appointment status updates from DoNotReply@medzoos.pk
 */
async function sendAppointmentNotification({ to, appointment, doctorName, customerName, slot, mode = 'video', meetingUrl, status = 'confirmed' }) {
  if (!to) return;

  const html = templates.appointmentBookingTemplate({
    appointment,
    doctorName,
    customerName,
    slot,
    mode,
    meetingUrl,
    status,
  });

  return sendEmail({
    to,
    subject: `Doctor Appointment ${String(status).toUpperCase()} — Medzoos Health`,
    html,
    senderKey: 'DONOTREPLY',
    senderAddress: EMAIL_CHANNELS.DONOTREPLY.address,
  });
}

/**
 * Sends lab test booking confirmation from DoNotReply@medzoos.pk
 */
async function sendLabBookingNotification({ to, booking, testName, customerName, sampleType, address, scheduledAt }) {
  if (!to) return;

  const html = templates.labBookingTemplate({
    booking,
    testName,
    customerName,
    sampleType,
    address,
    scheduledAt,
  });

  return sendEmail({
    to,
    subject: `Lab Booking Confirmed: ${testName || 'Diagnostic Test'} — Medzoos Labs`,
    html,
    senderKey: 'DONOTREPLY',
    senderAddress: EMAIL_CHANNELS.DONOTREPLY.address,
  });
}

/**
 * Sends notification when diagnostic lab test report is ready from DoNotReply@medzoos.pk
 */
async function sendLabReportReadyNotification({ to, booking, testName, customerName, reportUrl }) {
  if (!to) return;

  const html = templates.labReportReadyTemplate({
    booking,
    testName,
    customerName,
    reportUrl,
  });

  return sendEmail({
    to,
    subject: `Your Diagnostic Lab Report is Ready — Medzoos Labs`,
    html,
    senderKey: 'DONOTREPLY',
    senderAddress: EMAIL_CHANNELS.DONOTREPLY.address,
  });
}

/**
 * Sends auto-reply to user and admin notification for contact inquiries
 */
async function sendContactInquiryEmails({ inquiry, userEmail, userName, inquiryType = 'General', subject = '', message = '' }) {
  const email = userEmail || inquiry?.email;
  const name = userName || [inquiry?.first_name, inquiry?.last_name].filter(Boolean).join(' ');
  const ticketId = inquiry?.id?.slice(0, 8);

  // 1. Auto-acknowledgment to user
  if (email) {
    const userHtml = templates.contactInquiryUserTemplate({
      name,
      inquiryType: inquiryType || inquiry?.type,
      subject: subject || inquiry?.subject,
      ticketId,
      message: message || inquiry?.message,
    });

    void sendEmail({
      to: email,
      subject: `We received your inquiry [#${ticketId || 'MED'}] — Medzoos Support`,
      html: userHtml,
      senderKey: 'CONTACT',
      senderAddress: EMAIL_CHANNELS.CONTACT.address,
    }).catch((err) => logger.warn(`Contact user auto-ack failed: ${err.message}`));
  }

  // 2. Alert to Medzoos Admin & Support
  const adminRecipient = EMAIL_CHANNELS.ADMIN.address || 'admin@medzoos.pk';
  const adminHtml = templates.renderBaseTemplate({
    title: 'New Contact Inquiry',
    preheader: `New ${inquiryType || 'General'} inquiry from ${name || email}`,
    bodyHtml: `
      <p style="margin-top: 0;">A new contact inquiry has been received on ${templates.BRAND.name}.</p>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 22px 0; background-color: #f8fafc; border: 1px solid ${templates.BRAND.border}; border-radius: 12px;">
        <tr>
          <td style="padding: 20px;">
            <table border="0" cellpadding="6" cellspacing="0" width="100%" style="font-size: 14px;">
              <tr><td style="color: ${templates.BRAND.textMuted}; width: 120px;">Reference</td><td style="font-weight: 700; color: ${templates.BRAND.primary};">#${templates.escapeHtml(ticketId || 'Inquiry')}</td></tr>
              <tr><td style="color: ${templates.BRAND.textMuted};">From</td><td style="font-weight: 600;">${templates.escapeHtml(name || 'Unknown')} &lt;${templates.escapeHtml(email || '')}&gt;</td></tr>
              <tr><td style="color: ${templates.BRAND.textMuted};">Category</td><td style="font-weight: 600;">${templates.escapeHtml(inquiryType || inquiry?.type || 'General')}</td></tr>
              <tr><td style="color: ${templates.BRAND.textMuted};">Subject</td><td>${templates.escapeHtml(subject || inquiry?.subject || 'N/A')}</td></tr>
            </table>
          </td>
        </tr>
      </table>
      <div style="background: #f8fafc; padding: 16px 18px; border-radius: 10px; border-left: 4px solid ${templates.BRAND.accent}; font-size: 14px; line-height: 1.6; color: ${templates.BRAND.text};">
        ${templates.escapeHtml(message || inquiry?.message || '')}
      </div>
    `,
    showTrustStrip: false,
    showTitleIcon: false,
  });

  void sendEmail({
    to: adminRecipient,
    subject: `[Inquiry Alert] ${inquiryType || 'General'}: ${subject || name || email}`,
    html: adminHtml,
    senderKey: 'ADMIN',
    senderAddress: EMAIL_CHANNELS.ADMIN.address,
  }).catch((err) => logger.warn(`Contact admin alert failed: ${err.message}`));
}

/**
 * Sends a review and rating request from feedback@medzoos.pk
 */
async function sendFeedbackRequestEmail({ to, customerName, serviceType = 'order', referenceId, feedbackUrl }) {
  if (!to) return;

  const html = templates.feedbackRequestTemplate({
    customerName,
    serviceType,
    referenceId,
    feedbackUrl,
  });

  return sendEmail({
    to,
    subject: `How was your Medzoos experience?`,
    html,
    senderKey: 'FEEDBACK',
    senderAddress: EMAIL_CHANNELS.FEEDBACK.address,
  });
}

/**
 * Sends a security alert notification from security@medzoos.pk
 */
async function sendSecurityAlertEmail({ to, name, title = 'Security Alert', details, actionUrl }) {
  if (!to) return;

  const html = templates.securityAlertTemplate({
    title,
    name,
    details,
    actionUrl,
  });

  return sendEmail({
    to,
    subject: `[Security Notice] ${title} — Medzoos`,
    html,
    senderKey: 'SECURITY',
    senderAddress: EMAIL_CHANNELS.SECURITY.address,
  });
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendOtpEmail,
  sendPartnerApplicationEmail,
  sendPartnerStatusEmail,
  sendOrderConfirmationEmail,
  sendAppointmentNotification,
  sendLabBookingNotification,
  sendLabReportReadyNotification,
  sendContactInquiryEmails,
  sendFeedbackRequestEmail,
  sendSecurityAlertEmail,
  EMAIL_CHANNELS,
  resolveSender,
};
