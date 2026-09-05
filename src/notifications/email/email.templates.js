/**
 * Medzoos Branded Email Templates
 * Premium responsive HTML with inline styles for maximum email client compatibility.
 */

const BRAND = {
  name: 'Medzoos',
  tagline: "Pakistan's Premier Healthcare & Pharmacy Network",
  primary: '#082B3F',
  primaryLight: '#17618E',
  accent: '#0EA5E9',
  accentSoft: '#E0F2FE',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  bg: '#F1F5F9',
  white: '#FFFFFF',
  success: '#059669',
  successBg: '#ECFDF5',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  siteUrl: 'https://medzoos.pk',
  logoOnDark: 'https://medzoos.pk/images/medzoos-wordmark-on-dark.png',
  logoLight: 'https://medzoos.pk/images/medzoos-wordmark.png',
  supportEmail: 'support@medzoos.pk',
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderBrandHeader() {
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="background-color: ${BRAND.white}; padding: 32px 32px 24px 32px; border-radius: 16px 16px 0 0; text-align: center; border-bottom: 1px solid ${BRAND.border};">
          <a href="${BRAND.siteUrl}" target="_blank" style="text-decoration: none;">
            <img
              src="${BRAND.logoLight}"
              alt="${BRAND.name}"
              width="180"
              height="44"
              style="display: block; margin: 0 auto; width: 180px; max-width: 72%; height: auto; border: 0; outline: none; text-decoration: none;"
            />
          </a>
        </td>
      </tr>
    </table>
  `;
}

function renderTitleIcon() {
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 18px 0;">
      <tr>
        <td align="center">
          <div style="display: inline-block; width: 56px; height: 56px; border-radius: 999px; background-color: ${BRAND.accentSoft}; line-height: 56px; text-align: center;">
            <span style="font-size: 24px; color: ${BRAND.primaryLight};">&#128737;</span>
          </div>
        </td>
      </tr>
    </table>
  `;
}

function renderTitleUnderline() {
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: -8px 0 24px 0;">
      <tr>
        <td align="center">
          <div style="width: 56px; height: 3px; border-radius: 999px; background: linear-gradient(90deg, ${BRAND.accent} 0%, ${BRAND.primaryLight} 100%);"></div>
        </td>
      </tr>
    </table>
  `;
}

function renderOtpBlock(code, expiresInMinutes = 10) {
  return `
    <p>Your verification code is <strong>${escapeHtml(String(code || ''))}</strong>. It expires in <strong>${expiresInMinutes} minutes</strong>.</p>
  `;
}

function renderCallout(content, variant = 'info') {
  const styles = {
    info: { bg: BRAND.accentSoft, border: BRAND.accent, text: '#0369A1' },
    success: { bg: BRAND.successBg, border: BRAND.success, text: '#166534' },
    warning: { bg: BRAND.warningBg, border: BRAND.warning, text: '#9A3412' },
    danger: { bg: BRAND.dangerBg, border: BRAND.danger, text: '#991B1B' },
  };
  const s = styles[variant] || styles.info;

  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 22px 0;">
      <tr>
        <td style="background-color: ${s.bg}; border-left: 4px solid ${s.border}; border-radius: 0 10px 10px 0; padding: 16px 18px; font-size: 14px; line-height: 1.55; color: ${s.text};">
          ${content}
        </td>
      </tr>
    </table>
  `;
}

function renderBaseTemplate({
  title = 'Medzoos Notification',
  preheader = '',
  bodyHtml = '',
  showTitleIcon = true,
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; padding: 0; background-color: ${BRAND.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${BRAND.text}; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    a { color: ${BRAND.primaryLight}; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .content-cell { padding: 28px 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.bg};">
  <div style="display: none; font-size: 1px; color: ${BRAND.bg}; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">
    ${escapeHtml(preheader || title)}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${BRAND.bg}; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; margin: 0 auto;">

          <!-- Brand Header -->
          <tr>
            <td style="padding: 0;">
              ${renderBrandHeader()}
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content-cell" style="background-color: ${BRAND.white}; padding: 36px 36px 40px 36px; border-left: 1px solid ${BRAND.border}; border-right: 1px solid ${BRAND.border};">

              ${showTitleIcon ? renderTitleIcon() : ''}

              <h1 style="margin: 0 0 0 0; font-size: 26px; font-weight: 700; color: ${BRAND.primary}; line-height: 1.35; letter-spacing: -0.3px; text-align: center;">
                ${escapeHtml(title)}
              </h1>

              ${showTitleIcon ? renderTitleUnderline() : '<div style="height: 20px;"></div>'}

              <div style="font-size: 16px; line-height: 1.65; color: ${BRAND.text};">
                ${bodyHtml}
              </div>

            </td>
          </tr>

          <!-- Bottom spacing -->
          <tr>
            <td style="background-color: ${BRAND.white}; padding: 0 36px 32px 36px; border-left: 1px solid ${BRAND.border}; border-right: 1px solid ${BRAND.border}; border-bottom: 1px solid ${BRAND.border}; border-radius: 0 0 16px 16px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);">
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// -------------------------------------------------------------
// Specialized Email Templates
// -------------------------------------------------------------

function passwordResetTemplate({ name, email, resetUrl, role = 'account', code = null, expiresInMinutes = 15 }) {
  const title = 'Reset Your Password';
  const preheader = code
    ? `Your password reset code is ${code}`
    : `Password reset request for your ${role} account`;
  const greeting = name ? `Hello ${escapeHtml(name)},` : 'Hello,';

  const bodyHtml = `
    <p style="margin-top: 0;">${greeting}</p>
    <p>We received a request to reset the password for your <strong>${escapeHtml(role)}</strong> account linked to <strong>${escapeHtml(email)}</strong>.</p>
    ${
      code
        ? renderOtpBlock(code, expiresInMinutes)
        : `<p>Follow the steps on the Medzoos reset page to choose a new password. This request expires in <strong>${expiresInMinutes} minutes</strong>.</p>`
    }
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
    showTitleIcon: false,
  });
}

function welcomeTemplate({ name, email, role = 'patient', loginUrl = 'https://medzoos.pk/login' }) {
  const title = 'Welcome to Medzoos';
  const preheader = `Welcome, ${name || 'valued member'}! Your account is ready.`;
  const greeting = name ? `Welcome, ${escapeHtml(name)}!` : 'Welcome!';

  const bodyHtml = `
    <p style="margin-top: 0;">${greeting}</p>
    <p>Thank you for joining <strong>${BRAND.name}</strong> — your complete digital health platform. Your <strong>${escapeHtml(role)}</strong> account (<strong>${escapeHtml(email)}</strong>) is now active.</p>

    ${renderCallout(`
      <strong style="font-size: 15px;">What you can do on ${BRAND.name}:</strong>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 12px; font-size: 14px;">
        <tr><td style="padding: 6px 0;">&#128138; Order authentic medicines with home delivery</td></tr>
        <tr><td style="padding: 6px 0;">&#128104;&#8205;&#9877;&#65039; Book video &amp; in-clinic doctor consultations</td></tr>
        <tr><td style="padding: 6px 0;">&#128300; Schedule certified lab tests with home sampling</td></tr>
        <tr><td style="padding: 6px 0;">&#128196; Manage prescriptions &amp; health records securely</td></tr>
      </table>
    `, 'info')}

    <p>You're all set — log in to explore your dashboard: <a href="${escapeHtml(loginUrl)}" style="color: ${BRAND.primaryLight};">${escapeHtml(loginUrl)}</a></p>
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
  });
}

function otpVerificationTemplate({ name, code, purpose = 'login', expiresInMinutes = 10 }) {
  const title = 'Your Verification Code';
  const preheader = `Your ${BRAND.name} verification code is ${code}`;
  const greeting = name
    ? `Hello <strong style="color: ${BRAND.primaryLight};">${escapeHtml(name)}</strong>,`
    : 'Hello,';

  const bodyHtml = `
    <p style="margin-top: 0; text-align: center;">${greeting}</p>
    <p style="text-align: center;">Use the code below to complete your <strong>${escapeHtml(purpose)}</strong> on ${BRAND.name}.</p>
    ${renderOtpBlock(code, expiresInMinutes)}
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
    showTitleIcon: false,
  });
}

function partnerApplicationReceivedTemplate({ businessName, contactName, role = 'vendor' }) {
  const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
  const title = 'Partner Application Received';
  const preheader = `We received your application for ${businessName}.`;

  const bodyHtml = `
    <p style="margin-top: 0;">Dear ${escapeHtml(contactName || businessName)},</p>
    <p>Thank you for applying to join the ${BRAND.name} Partner Network for <strong>${escapeHtml(businessName)}</strong> as a <strong>${escapeHtml(roleTitle)}</strong>.</p>
    ${renderCallout(`
      <strong>Status: Under Review</strong><br/>
      Our compliance team will review your documentation within 1–2 business days.
    `, 'success')}
    <p>Once approved, you'll receive an activation email with portal credentials to start managing your operations.</p>
  `;

  return renderBaseTemplate({ title, preheader, bodyHtml });
}

function partnerStatusTemplate({ businessName, contactName, role = 'partner', status = 'approved', note = '', dashboardUrl = 'https://medzoos.pk' }) {
  const isApproved = ['approved', 'active'].includes(status.toLowerCase());
  const statusLabel = isApproved ? 'Approved & Activated' : status.toUpperCase();
  const title = `Partner Status: ${statusLabel}`;
  const preheader = `Your ${role} account for ${businessName} has been ${status.toLowerCase()}.`;

  const bodyHtml = `
    <p style="margin-top: 0;">Dear ${escapeHtml(contactName || businessName)},</p>
    <p>Here's an update on your <strong>${escapeHtml(role)}</strong> partnership for <strong>${escapeHtml(businessName)}</strong> on ${BRAND.name}.</p>
    ${renderCallout(`
      <strong>Account Status: ${escapeHtml(statusLabel)}</strong>
      ${note ? `<br/><span style="margin-top: 6px; display: inline-block;">${escapeHtml(note)}</span>` : ''}
    `, isApproved ? 'success' : 'warning')}
    ${
      isApproved
        ? `<p>Your partner portal is ready. Log in to manage orders, appointments, and connect with patients nationwide: <a href="${escapeHtml(dashboardUrl)}" style="color: ${BRAND.primaryLight};">${escapeHtml(dashboardUrl)}</a></p>`
        : `<p>If you need to submit additional documents or believe this status is incorrect, our compliance team can help.</p>`
    }
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
  });
}

function orderConfirmationTemplate({ order, customer, items = [], total = 0, shippingAddress = null, trackingUrl = 'https://medzoos.pk/orders' }) {
  const orderIdShort = String(order?.id || '').slice(0, 8).toUpperCase();
  const title = `Order Confirmed — #${orderIdShort}`;
  const preheader = `Thank you! Order #${orderIdShort} — PKR ${total.toLocaleString()}`;

  const itemsRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid ${BRAND.border}; font-size: 14px; color: ${BRAND.text};">
          <strong>${escapeHtml(item.product_name || item.name || 'Medicine item')}</strong>
          ${item.dosage ? `<br/><span style="font-size: 12px; color: ${BRAND.textMuted};">${escapeHtml(item.dosage)}</span>` : ''}
        </td>
        <td align="center" style="padding: 12px 10px; border-bottom: 1px solid ${BRAND.border}; font-size: 14px; color: ${BRAND.textMuted};">
          &times;${escapeHtml(item.quantity || 1)}
        </td>
        <td align="right" style="padding: 12px 10px; border-bottom: 1px solid ${BRAND.border}; font-size: 14px; color: ${BRAND.primary}; font-weight: 600;">
          PKR ${Number(item.price || 0).toLocaleString()}
        </td>
      </tr>`
    )
    .join('');

  const bodyHtml = `
    <p style="margin-top: 0;">Dear ${escapeHtml(customer?.name || 'Customer')},</p>
    <p>Thank you for ordering with ${BRAND.name}. Order <strong>#${orderIdShort}</strong> is confirmed and being prepared by our verified pharmacy network.</p>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0; border: 1px solid ${BRAND.border}; border-radius: 12px; overflow: hidden;">
      <tr>
        <td colspan="3" style="background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryLight} 100%); padding: 14px 18px; font-weight: 700; font-size: 14px; color: #ffffff;">
          Order Summary
        </td>
      </tr>
      ${itemsRows}
      <tr>
        <td colspan="2" style="padding: 14px 10px; font-size: 15px; font-weight: 700; color: ${BRAND.primary};">Total</td>
        <td align="right" style="padding: 14px 10px; font-size: 18px; font-weight: 800; color: ${BRAND.accent};">
          PKR ${Number(total || 0).toLocaleString()}
        </td>
      </tr>
    </table>

    ${
      shippingAddress
        ? renderCallout(`<strong>Delivery Address:</strong> ${escapeHtml(shippingAddress)}`, 'info')
        : ''
    }

    <p>Track your order: <a href="${escapeHtml(trackingUrl)}" style="color: ${BRAND.primaryLight};">${escapeHtml(trackingUrl)}</a></p>
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
  });
}

function appointmentBookingTemplate({ appointment, doctorName, customerName, slot, mode = 'video', meetingUrl = null, status = 'confirmed' }) {
  const isConfirmed = status.toLowerCase() === 'confirmed';
  const title = `Appointment ${isConfirmed ? 'Confirmed' : 'Scheduled'}`;
  const preheader = `Consultation with ${doctorName || 'your doctor'} — ${slot || 'upcoming'}`;

  const bodyHtml = `
    <p style="margin-top: 0;">Dear ${escapeHtml(customerName || 'Patient')},</p>
    <p>Your healthcare consultation on ${BRAND.name} has been ${isConfirmed ? 'confirmed' : 'scheduled'}.</p>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 22px 0; background-color: #f8fafc; border: 1px solid ${BRAND.border}; border-radius: 12px;">
      <tr>
        <td style="padding: 20px;">
          <table border="0" cellpadding="6" cellspacing="0" width="100%" style="font-size: 14px;">
            <tr>
              <td style="color: ${BRAND.textMuted}; width: 130px;">Doctor</td>
              <td style="font-weight: 700; color: ${BRAND.primary};">${escapeHtml(doctorName || 'Verified Specialist')}</td>
            </tr>
            <tr>
              <td style="color: ${BRAND.textMuted};">Date &amp; Time</td>
              <td style="font-weight: 600;">${escapeHtml(slot || 'To be confirmed')}</td>
            </tr>
            <tr>
              <td style="color: ${BRAND.textMuted};">Type</td>
              <td style="font-weight: 600; color: ${BRAND.accent}; text-transform: capitalize;">${escapeHtml(mode)} Consultation</td>
            </tr>
            <tr>
              <td style="color: ${BRAND.textMuted};">Status</td>
              <td style="font-weight: 700; color: ${isConfirmed ? BRAND.success : BRAND.warning}; text-transform: capitalize;">${escapeHtml(status)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${
      meetingUrl
        ? `<p>Please join 5 minutes early: <a href="${escapeHtml(meetingUrl)}" style="color: ${BRAND.primaryLight};">${escapeHtml(meetingUrl)}</a></p>`
        : `<p>View full details in your patient portal: <a href="${BRAND.siteUrl}/account/appointments" style="color: ${BRAND.primaryLight};">${BRAND.siteUrl}/account/appointments</a></p>`
    }
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
  });
}

function labBookingTemplate({ booking, testName, customerName, sampleType = 'Home Sampling', address = '', scheduledAt = '' }) {
  const title = `Lab Test Confirmed`;
  const preheader = `${testName || 'Your diagnostic test'} booking is confirmed.`;

  const bodyHtml = `
    <p style="margin-top: 0;">Dear ${escapeHtml(customerName || 'Patient')},</p>
    <p>Your laboratory test booking on ${BRAND.name} is confirmed with our certified diagnostic partner.</p>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 22px 0; background-color: #f8fafc; border: 1px solid ${BRAND.border}; border-radius: 12px;">
      <tr>
        <td style="padding: 20px;">
          <table border="0" cellpadding="6" cellspacing="0" width="100%" style="font-size: 14px;">
            <tr><td style="color: ${BRAND.textMuted}; width: 130px;">Test</td><td style="font-weight: 700; color: ${BRAND.primary};">${escapeHtml(testName || 'Diagnostic Package')}</td></tr>
            <tr><td style="color: ${BRAND.textMuted};">Collection</td><td style="font-weight: 600;">${escapeHtml(sampleType)}</td></tr>
            ${scheduledAt ? `<tr><td style="color: ${BRAND.textMuted};">Schedule</td><td style="font-weight: 600;">${escapeHtml(scheduledAt)}</td></tr>` : ''}
            ${address ? `<tr><td style="color: ${BRAND.textMuted};">Location</td><td>${escapeHtml(address)}</td></tr>` : ''}
          </table>
        </td>
      </tr>
    </table>

    ${renderCallout('<strong>Fasting required?</strong> Avoid solid food for 8–12 hours before collection. Water is permitted.', 'info')}

    <p>View lab details: <a href="${BRAND.siteUrl}/account/reports" style="color: ${BRAND.primaryLight};">${BRAND.siteUrl}/account/reports</a></p>
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
  });
}

function labReportReadyTemplate({ booking, testName, customerName, reportUrl = 'https://medzoos.pk/account/reports' }) {
  const title = 'Your Lab Report is Ready';
  const preheader = `Results for ${testName || 'your test'} are now available.`;

  const bodyHtml = `
    <p style="margin-top: 0;">Dear ${escapeHtml(customerName || 'Patient')},</p>
    <p>Your diagnostic report for <strong>${escapeHtml(testName || 'your lab test')}</strong> has been reviewed and uploaded to your secure ${BRAND.name} health portal.</p>
    ${renderCallout('<strong>Report Status: Final &amp; Verified</strong><br/>Download the official PDF from your dashboard.', 'success')}
    <p>You can also share this report directly with your consulting physician on ${BRAND.name}.</p>

    <p>Download your report: <a href="${escapeHtml(reportUrl)}" style="color: ${BRAND.primaryLight};">${escapeHtml(reportUrl)}</a></p>
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
  });
}

function contactInquiryUserTemplate({ name, inquiryType = 'General', subject = '', ticketId = '' }) {
  const title = 'We Received Your Message';
  const preheader = `Thanks for contacting ${BRAND.name}. Reference #${ticketId || 'Inquiry'}`;

  const bodyHtml = `
    <p style="margin-top: 0;">Dear ${escapeHtml(name || 'Valued User')},</p>
    <p>Thank you for reaching out. We've received your <strong>${escapeHtml(inquiryType)}</strong> inquiry${subject ? ` about "<em>${escapeHtml(subject)}</em>"` : ''}.</p>
    ${renderCallout(`
      ${ticketId ? `<strong>Reference:</strong> #${escapeHtml(ticketId)}<br/>` : ''}
      <strong>Expected response:</strong> Within 2–4 hours during business hours.
    `, 'info')}
    <p>For urgent medical matters, please consult a telehealth doctor or call our hotline.</p>
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
  });
}

function feedbackRequestTemplate({ customerName, serviceType = 'order', referenceId = '', feedbackUrl = 'https://medzoos.pk/feedback' }) {
  const title = 'How Was Your Experience?';
  const preheader = `We'd love your feedback on your recent ${serviceType}.`;

  const bodyHtml = `
    <p style="margin-top: 0;">Dear ${escapeHtml(customerName || 'Customer')},</p>
    <p>Thank you for choosing ${BRAND.name} for your recent <strong>${escapeHtml(serviceType)}</strong>${referenceId ? ` (#${escapeHtml(referenceId)})` : ''}.</p>
    <p>Your feedback helps us improve and supports our verified pharmacy and doctor partners. It only takes a minute.</p>

    <p>Share your review: <a href="${escapeHtml(feedbackUrl)}" style="color: ${BRAND.primaryLight};">${escapeHtml(feedbackUrl)}</a></p>
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
  });
}

function securityAlertTemplate({ title = 'Security Alert', name = '', details = '', actionUrl = 'https://medzoos.pk/account/security' }) {
  const preheader = `Important security notice for your ${BRAND.name} account.`;

  const bodyHtml = `
    <p style="margin-top: 0;">Dear ${escapeHtml(name || 'Account Holder')},</p>
    <p>We detected an important security event on your ${BRAND.name} account:</p>
    ${renderCallout(`
      <strong>${escapeHtml(title)}</strong>
      ${details ? `<br/><span style="margin-top: 6px; display: inline-block;">${escapeHtml(details)}</span>` : ''}
    `, 'danger')}
    <p>If you authorized this activity, no action is needed. Otherwise, secure your account: <a href="${escapeHtml(actionUrl)}" style="color: ${BRAND.primaryLight};">${escapeHtml(actionUrl)}</a></p>
  `;

  return renderBaseTemplate({
    title,
    preheader,
    bodyHtml,
  });
}

module.exports = {
  BRAND,
  escapeHtml,
  renderBaseTemplate,
  passwordResetTemplate,
  welcomeTemplate,
  otpVerificationTemplate,
  partnerApplicationReceivedTemplate,
  partnerStatusTemplate,
  orderConfirmationTemplate,
  appointmentBookingTemplate,
  labBookingTemplate,
  labReportReadyTemplate,
  contactInquiryUserTemplate,
  feedbackRequestTemplate,
  securityAlertTemplate,
};
