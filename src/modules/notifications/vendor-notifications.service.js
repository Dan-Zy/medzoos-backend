const prisma = require('../../config/database');
const { notificationQueue } = require('../../queues');
const inbox = require('./inbox.service');

function getNotificationCategory(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('stock') || t.includes('expiry')) return 'stock';
  if (t.includes('order')) return 'orders';
  if (t.includes('prescription')) return 'prescriptions';
  if (t.includes('payout')) return 'payouts';
  return null;
}

async function createVendorNotification({
  vendorId,
  type,
  title,
  message,
  data = null,
  channels = ['in_app'],
}) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { notification_preferences: true },
  }).catch(() => null);

  const prefs = vendor?.notification_preferences;
  if (prefs && typeof prefs === 'object') {
    const category = getNotificationCategory(type);
    if (category && prefs[category] === false) {
      return null;
    }
  }

  const activeChannels = channels.filter((channel) => {
    if (channel === 'in_app' && prefs?.in_app === false) return false;
    if (channel === 'email' && prefs?.email === false) return false;
    return true;
  });

  if (activeChannels.length === 0) {
    return null;
  }

  let notification = null;
  if (activeChannels.includes('in_app')) {
    notification = await prisma.vendorNotification.create({
      data: {
        vendor_id: vendorId,
        type,
        title,
        message,
        data: data || undefined,
        channel: activeChannels[0] || 'in_app',
      },
    });
  }

  for (const channel of activeChannels.filter((value) => value !== 'in_app')) {
    try {
      await notificationQueue.add(type, {
        channel,
        type,
        recipient: data?.recipient || '',
        payload: {
          vendorId,
          title,
          message,
          ...data,
        },
      });
    } catch {
      // Best effort queueing; in-app notification already persisted.
    }
  }

  if (activeChannels.includes('in_app')) {
    await inbox.notify({
      recipientType: 'vendor',
      recipientId: vendorId,
      type,
      title,
      message,
      data,
      link: data?.orderId ? '/vendor/orders' : '/vendor/dashboard',
    });
  }

  return notification;
}

async function listVendorNotifications(vendorId) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { notification_preferences: true },
  }).catch(() => null);

  const prefs = vendor?.notification_preferences;
  if (prefs && typeof prefs === 'object' && prefs.in_app === false) {
    return [];
  }

  const notifications = await prisma.vendorNotification.findMany({
    where: { vendor_id: vendorId },
    orderBy: { created_at: 'desc' },
    take: 100,
  });

  if (!prefs || typeof prefs !== 'object') return notifications;

  return notifications.filter((item) => {
    const category = getNotificationCategory(item.type);
    if (category && prefs[category] === false) {
      return false;
    }
    return true;
  });
}

async function markAllVendorNotificationsRead(vendorId) {
  return prisma.vendorNotification.updateMany({
    where: { vendor_id: vendorId, status: 'unread' },
    data: { status: 'read', read_at: new Date() },
  });
}

async function markVendorNotificationRead(vendorId, notificationId) {
  return prisma.vendorNotification.updateMany({
    where: {
      id: notificationId,
      vendor_id: vendorId,
    },
    data: {
      status: 'read',
      read_at: new Date(),
    },
  });
}

module.exports = {
  createVendorNotification,
  listVendorNotifications,
  markVendorNotificationRead,
  markAllVendorNotificationsRead,
};
