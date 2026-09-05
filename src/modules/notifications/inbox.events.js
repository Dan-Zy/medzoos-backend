const inbox = require('./inbox.service');
const prisma = require('../../config/database');
const emailService = require('../../notifications/email/email.service');
const { logger } = require('../../utils/logger');
const env = require('../../config/env');

function statusLabel(status) {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function contactInquiry(inquiry) {
  const name = [inquiry.first_name, inquiry.last_name].filter(Boolean).join(' ');
  await inbox.notifyAdmins({
    type: 'contact_inquiry',
    title: 'New website inquiry',
    message: `${name || inquiry.email} submitted a ${inquiry.type || 'general'} query.`,
    link: '/admin/inquiries',
    data: { inquiryId: inquiry.id, email: inquiry.email, inquiryType: inquiry.type },
  });

  // Dispatch auto-acknowledgment to user and alert to admin
  try {
    void emailService.sendContactInquiryEmails({
      inquiry,
      userEmail: inquiry.email,
      userName: name,
      inquiryType: inquiry.type,
      subject: inquiry.subject,
      message: inquiry.message,
    });
  } catch (err) {
    logger.warn(`Contact inquiry email dispatch failed: ${err.message}`);
  }
}

async function partnerApplication(vendor) {
  await inbox.notifyAdmins({
    type: 'partner_application',
    title: 'New partner application',
    message: `${vendor.business_name} applied to join the pharmacy network.`,
    link: '/admin/vendors',
    data: { vendorId: vendor.id },
  });

  // Send application confirmation email from verify@medzoos.pk
  if (vendor.email) {
    try {
      void emailService.sendPartnerApplicationEmail({
        to: vendor.email,
        businessName: vendor.business_name,
        contactName: vendor.owner_name || vendor.contact_person,
        role: 'vendor',
      });
    } catch (err) {
      logger.warn(`Partner application confirmation email failed: ${err.message}`);
    }
  }
}

async function vendorStatusChanged(vendor, status, note) {
  await inbox.notify({
    recipientType: 'vendor',
    recipientId: vendor.id,
    type: `vendor_${status}`,
    title: `Application ${statusLabel(status)}`,
    message: note
      ? `Your vendor account is now ${statusLabel(status)}. ${note}`
      : `Your vendor account is now ${statusLabel(status)}.`,
    link: '/vendor/dashboard',
    data: { vendorId: vendor.id, status },
  });

  if (vendor.email) {
    try {
      void emailService.sendPartnerStatusEmail({
        to: vendor.email,
        businessName: vendor.business_name,
        contactName: vendor.owner_name,
        role: 'vendor',
        status,
        note,
        dashboardUrl: `${String(env.VENDOR_PORTAL_URL || 'http://localhost:3002').replace(/\/$/, '')}`,
      });
    } catch (err) {
      logger.warn(`Vendor status email failed: ${err.message}`);
    }
  }
}

async function newOrder({ order, customerId }) {
  await inbox.notifyAdmins({
    type: 'new_order',
    title: 'New pharmacy order',
    message: `Order ${order.id.slice(0, 8)} was placed.`,
    link: '/admin/orders',
    data: { orderId: order.id, vendorId: order.vendor_id, customerId },
  });

  if (customerId) {
    await inbox.notify({
      recipientType: 'customer',
      recipientId: customerId,
      type: 'order_placed',
      title: 'Order placed',
      message: `Your order ${order.id.slice(0, 8)} has been received.`,
      link: '/orders',
      data: { orderId: order.id },
    });

    // Fetch customer details and items for invoice email from accounts@medzoos.pk
    try {
      const customer = await prisma.user.findUnique({
        where: { id: customerId },
        select: { email: true, name: true },
      });

      if (customer?.email) {
        const fullOrder = await prisma.order.findUnique({
          where: { id: order.id },
          include: { items: { include: { product: true } } },
        });

        const items = (fullOrder?.items || []).map((i) => ({
          product_name: i.product?.name || 'Medicine',
          quantity: i.quantity,
          price: i.price,
        }));

        void emailService.sendOrderConfirmationEmail({
          to: customer.email,
          order: fullOrder || order,
          customer,
          items,
          total: Number(fullOrder?.total_amount || order.total_amount || 0),
          shippingAddress: fullOrder?.shipping_address ? JSON.stringify(fullOrder.shipping_address) : null,
          trackingUrl: `${String(env.FRONTEND_URL || 'https://medzoos.pk').replace(/\/$/, '')}/orders`,
        });
      }
    } catch (err) {
      logger.warn(`Order confirmation email dispatch failed: ${err.message}`);
    }
  }
}

async function orderStatus({ orderId, customerId, status }) {
  if (!customerId) return;
  await inbox.notify({
    recipientType: 'customer',
    recipientId: customerId,
    type: 'order_status_updated',
    title: 'Order update',
    message: `Your order is now ${statusLabel(status)}.`,
    link: `/orders/${orderId}`,
    data: { orderId, status },
  });
}

async function prescriptionCreated({ order }) {
  await inbox.notifyAdmins({
    type: 'prescription_order',
    title: 'New prescription order',
    message: `A prescription order is waiting for a pharmacy.`,
    link: '/admin/prescription-orders',
    data: { orderId: order.id, customerId: order.customer_id },
  });
  if (order.customer_id) {
    await inbox.notify({
      recipientType: 'customer',
      recipientId: order.customer_id,
      type: 'prescription_submitted',
      title: 'Prescription submitted',
      message: 'We are matching your prescription with a nearby pharmacy.',
      link: '/orders',
      data: { orderId: order.id },
    });
  }
}

async function appointmentBooked({ appointment, doctorName, customerName }) {
  await inbox.notify({
    recipientType: 'doctor',
    recipientId: appointment.doctor_id,
    type: 'new_appointment',
    title: 'New appointment request',
    message: `${customerName || 'A patient'} requested ${appointment.slot || 'a slot'}.`,
    link: '/doctor/appointments',
    data: { appointmentId: appointment.id },
  });
  await inbox.notify({
    recipientType: 'customer',
    recipientId: appointment.customer_id,
    type: 'appointment_booked',
    title: 'Appointment requested',
    message: `Your appointment with ${doctorName || 'the doctor'} is pending confirmation.`,
    link: '/account/appointments',
    data: { appointmentId: appointment.id },
  });
  await inbox.notifyAdmins({
    type: 'new_appointment',
    title: 'New doctor appointment',
    message: `${customerName || 'A patient'} booked ${doctorName || 'a doctor'}.`,
    link: '/admin/doctors',
    data: { appointmentId: appointment.id, doctorId: appointment.doctor_id },
  });

  // Send confirmation email from DoNotReply@medzoos.pk
  try {
    const customer = await prisma.user.findUnique({
      where: { id: appointment.customer_id },
      select: { email: true, name: true },
    });

    if (customer?.email) {
      void emailService.sendAppointmentNotification({
        to: customer.email,
        appointment,
        doctorName,
        customerName: customer.name || customerName,
        slot: appointment.slot,
        mode: appointment.type || 'video',
        status: appointment.status || 'pending',
      });
    }
  } catch (err) {
    logger.warn(`Appointment booking email failed: ${err.message}`);
  }
}

async function appointmentStatus({ appointment, status, doctorName }) {
  const label = statusLabel(status);
  if (appointment.customer_id) {
    await inbox.notify({
      recipientType: 'customer',
      recipientId: appointment.customer_id,
      type: `appointment_${status}`,
      title: `Appointment ${label.toLowerCase()}`,
      message: `Your appointment with ${doctorName || 'the doctor'} is now ${label.toLowerCase()}.`,
      link: '/account/appointments',
      data: { appointmentId: appointment.id, status },
    });

    try {
      const customer = await prisma.user.findUnique({
        where: { id: appointment.customer_id },
        select: { email: true, name: true },
      });

      if (customer?.email) {
        void emailService.sendAppointmentNotification({
          to: customer.email,
          appointment,
          doctorName,
          customerName: customer.name,
          slot: appointment.slot,
          mode: appointment.type || 'video',
          meetingUrl: appointment.meeting_url,
          status,
        });
      }
    } catch (err) {
      logger.warn(`Appointment status email failed: ${err.message}`);
    }
  }
  if (status === 'cancelled' && appointment.doctor_id) {
    await inbox.notify({
      recipientType: 'doctor',
      recipientId: appointment.doctor_id,
      type: 'appointment_cancelled',
      title: 'Appointment cancelled',
      message: 'A patient cancelled an upcoming appointment.',
      link: '/doctor/appointments',
      data: { appointmentId: appointment.id },
    });
  }
}

async function appointmentRescheduled({ appointment, doctorName }) {
  await inbox.notify({
    recipientType: 'doctor',
    recipientId: appointment.doctor_id,
    type: 'appointment_rescheduled',
    title: 'Appointment rescheduled',
    message: 'A patient changed their appointment time.',
    link: '/doctor/appointments',
    data: { appointmentId: appointment.id },
  });
  await inbox.notify({
    recipientType: 'customer',
    recipientId: appointment.customer_id,
    type: 'appointment_rescheduled',
    title: 'Appointment rescheduled',
    message: `Your appointment with ${doctorName || 'the doctor'} was updated.`,
    link: '/account/appointments',
    data: { appointmentId: appointment.id },
  });
}

async function labBookingCreated(booking) {
  const testName = booking.lab_test?.name || 'a lab test';
  if (booking.lab_partner_id) {
    await inbox.notify({
      recipientType: 'lab',
      recipientId: booking.lab_partner_id,
      type: 'new_lab_booking',
      title: 'New lab booking',
      message: `${booking.patient_name || 'A patient'} booked ${testName}.`,
      link: '/lab/bookings',
      data: { bookingId: booking.id },
    });
  }
  if (booking.customer_id) {
    await inbox.notify({
      recipientType: 'customer',
      recipientId: booking.customer_id,
      type: 'lab_booking_created',
      title: 'Lab test booked',
      message: `${testName} has been booked successfully.`,
      link: '/account/reports',
      data: { bookingId: booking.id },
    });

    try {
      const customer = await prisma.user.findUnique({
        where: { id: booking.customer_id },
        select: { email: true, name: true },
      });

      if (customer?.email) {
        void emailService.sendLabBookingNotification({
          to: customer.email,
          booking,
          testName,
          customerName: booking.patient_name || customer.name,
          sampleType: booking.sample_type || 'Home Sampling',
          address: booking.collection_address || '',
          scheduledAt: booking.scheduled_date || '',
        });
      }
    } catch (err) {
      logger.warn(`Lab booking email dispatch failed: ${err.message}`);
    }
  }
  await inbox.notifyAdmins({
    type: 'new_lab_booking',
    title: 'New lab booking',
    message: `${booking.patient_name || 'A patient'} booked ${testName}.`,
    link: '/admin/lab-bookings',
    data: { bookingId: booking.id, labPartnerId: booking.lab_partner_id },
  });
}

async function labBookingStatus({ booking, status }) {
  const testName = booking.lab_test?.name || 'your lab test';
  if (booking.customer_id) {
    await inbox.notify({
      recipientType: 'customer',
      recipientId: booking.customer_id,
      type: `lab_${status}`,
      title: 'Lab booking update',
      message: `${testName} is now ${statusLabel(status).toLowerCase()}.`,
      link: '/account/reports',
      data: { bookingId: booking.id, status },
    });
  }
  if (status === 'cancelled' && booking.lab_partner_id) {
    await inbox.notify({
      recipientType: 'lab',
      recipientId: booking.lab_partner_id,
      type: 'lab_booking_cancelled',
      title: 'Booking cancelled',
      message: `${booking.patient_name || 'A patient'} cancelled ${testName}.`,
      link: '/lab/bookings',
      data: { bookingId: booking.id },
    });
  }
}

async function labReportReady(booking) {
  if (!booking.customer_id) return;
  await inbox.notify({
    recipientType: 'customer',
    recipientId: booking.customer_id,
    type: 'lab_report_ready',
    title: 'Lab report ready',
    message: `${booking.lab_test?.name || 'Your lab report'} is ready to view.`,
    link: '/account/reports',
    data: { bookingId: booking.id },
  });

  try {
    const customer = await prisma.user.findUnique({
      where: { id: booking.customer_id },
      select: { email: true, name: true },
    });

    if (customer?.email) {
      void emailService.sendLabReportReadyNotification({
        to: customer.email,
        booking,
        testName: booking.lab_test?.name,
        customerName: booking.patient_name || customer.name,
        reportUrl: booking.report_url || `${String(env.FRONTEND_URL || 'https://medzoos.pk').replace(/\/$/, '')}/account/reports`,
      });
    }
  } catch (err) {
    logger.warn(`Lab report ready email failed: ${err.message}`);
  }
}

async function labCollectorAssigned(booking) {
  if (!booking.customer_id) return;
  await inbox.notify({
    recipientType: 'customer',
    recipientId: booking.customer_id,
    type: 'lab_collector_assigned',
    title: 'Collector assigned',
    message: booking.collector_name
      ? `${booking.collector_name} will collect your sample.`
      : 'A collector has been assigned for your lab test.',
    link: '/account/reports',
    data: { bookingId: booking.id },
  });
}

async function returnRequested(returnRequest, order) {
  await inbox.notifyAdmins({
    type: 'return_requested',
    title: 'New return request',
    message: `A return was requested for order ${order?.id?.slice(0, 8) || returnRequest.order_id.slice(0, 8)}.`,
    link: '/admin/orders',
    data: { returnId: returnRequest.id, orderId: returnRequest.order_id },
  });
  if (order?.vendor_id) {
    await inbox.notify({
      recipientType: 'vendor',
      recipientId: order.vendor_id,
      type: 'return_requested',
      title: 'Return requested',
      message: `A customer requested a return for order ${order.id.slice(0, 8)}.`,
      link: '/vendor/orders',
      data: { returnId: returnRequest.id, orderId: order.id },
    });
  }
}

async function returnResolved(returnRequest, status) {
  if (!returnRequest.customer_id) return;
  await inbox.notify({
    recipientType: 'customer',
    recipientId: returnRequest.customer_id,
    type: `return_${status}`,
    title: `Return ${statusLabel(status).toLowerCase()}`,
    message: `Your return request was ${statusLabel(status).toLowerCase()}.`,
    link: '/orders',
    data: { returnId: returnRequest.id, status },
  });
}

async function chatMessage({ appointment, senderRole, preview }) {
  const snippet = (preview || 'New message').slice(0, 120);
  if (senderRole === 'doctor' && appointment.customer_id) {
    await inbox.notify({
      recipientType: 'customer',
      recipientId: appointment.customer_id,
      type: 'chat_message',
      title: 'New message from your doctor',
      message: snippet,
      link: `/account/appointments/${appointment.id}/chat`,
      data: { appointmentId: appointment.id },
    });
  }
  if (senderRole === 'customer' && appointment.doctor_id) {
    await inbox.notify({
      recipientType: 'doctor',
      recipientId: appointment.doctor_id,
      type: 'chat_message',
      title: 'New patient message',
      message: snippet,
      link: '/doctor/appointments',
      data: { appointmentId: appointment.id },
    });
  }
}

async function productSubmittedForReview({ product, vendorName }) {
  const isControlled = Boolean(product.controlled_medicine);
  await inbox.notifyAdmins({
    type: isControlled ? 'controlled_medicine_review' : 'product_review',
    title: isControlled ? 'Controlled medicine pending approval' : 'New product submitted for review',
    message: isControlled
      ? `${vendorName || 'A vendor'} submitted controlled medicine "${product.name}" requiring administrative validation.`
      : `${vendorName || 'A vendor'} submitted product "${product.name}" for catalog review.`,
    link: '/admin/products',
    data: {
      productId: product.id,
      vendorId: product.vendor_id,
      controlledMedicine: isControlled,
      name: product.name,
    },
  });
}

module.exports = {
  contactInquiry,
  partnerApplication,
  vendorStatusChanged,
  newOrder,
  orderStatus,
  prescriptionCreated,
  appointmentBooked,
  appointmentStatus,
  appointmentRescheduled,
  labBookingCreated,
  labBookingStatus,
  labReportReady,
  labCollectorAssigned,
  returnRequested,
  returnResolved,
  chatMessage,
  productSubmittedForReview,
};
