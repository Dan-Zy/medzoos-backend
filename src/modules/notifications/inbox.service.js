const prisma = require('../../config/database');
const { logger } = require('../../utils/logger');

function serialize(notification) {
  if (!notification) return null;
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link || null,
    data: notification.data || null,
    read: notification.is_read,
    createdAt: notification.created_at,
    readAt: notification.read_at,
  };
}

function emitInbox(recipientType, recipientId, notification) {
  try {
    const { getIO } = require('../../config/socket');
    const io = getIO();
    const payload = serialize(notification);
    io.to(`${recipientType}-${recipientId}`).emit('notification:new', payload);
    if (recipientType === 'admin') {
      io.to('admins').emit('notification:new', payload);
    }
  } catch {
    // Socket may not be initialized in tests or early boot.
  }
}

async function pushToRecipientDevice(recipientType, recipientId, notification) {
  try {
    const customerNotifications = require('./customer-notifications.service');
    await customerNotifications.sendPushToUser(String(recipientId), {
      title: notification.title,
      body: notification.message,
      type: notification.type || 'inbox',
      data: {
        id: notification.id,
        recipientType: recipientType || '',
        link: notification.link || '',
        ...(notification.data && typeof notification.data === 'object' ? notification.data : {}),
      },
    });
  } catch (error) {
    logger.warn(`Push delivery failed for ${recipientType}/${recipientId}: ${error.message}`);
  }
}

async function notify({
  recipientType,
  recipientId,
  type,
  title,
  message,
  link = null,
  data = null,
}) {
  if (!recipientType || !recipientId || !title || !message) return null;

  if (recipientType === 'vendor' && recipientId && recipientId !== 'all') {
    const vendor = await prisma.vendor.findUnique({
      where: { id: recipientId },
      select: { notification_preferences: true },
    }).catch(() => null);
    const prefs = vendor?.notification_preferences;
    if (prefs && typeof prefs === 'object') {
      if (prefs.in_app === false) return null;
      const t = String(type || '').toLowerCase();
      let category = null;
      if (t.includes('stock') || t.includes('expiry')) category = 'stock';
      else if (t.includes('order')) category = 'orders';
      else if (t.includes('prescription')) category = 'prescriptions';
      else if (t.includes('payout')) category = 'payouts';

      if (category && prefs[category] === false) return null;
    }
  }

  try {
    const notification = await prisma.inboxNotification.create({
      data: {
        recipient_type: recipientType,
        recipient_id: String(recipientId),
        type,
        title,
        message,
        link: link || undefined,
        data: data || undefined,
      },
    });
    emitInbox(recipientType, String(recipientId), notification);

    // FCM / registered device push for every role (customer, admin, vendor, doctor, lab)
    void pushToRecipientDevice(recipientType, recipientId, notification);

    return serialize(notification);
  } catch (error) {
    logger.warn(`Inbox notify failed (${recipientType}/${type}): ${error.message}`);
    return null;
  }
}

async function notifyAdmins(payload) {
  try {
    const adminAccounts = await prisma.account.findMany({
      where: { role: 'admin' },
      select: { id: true },
    }).catch(() => []);

    const adminUsers = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true },
    }).catch(() => []);

    const recipientIds = new Set(['all']);
    adminAccounts.forEach((a) => recipientIds.add(a.id));
    adminUsers.forEach((u) => recipientIds.add(u.id));

    const results = await Promise.all(
      Array.from(recipientIds).map((id) =>
        notify({
          recipientType: 'admin',
          recipientId: id,
          ...payload,
        })
      )
    );
    return results.filter(Boolean);
  } catch (error) {
    logger.warn(`Inbox notifyAdmins failed: ${error.message}`);
    return [];
  }
}

function recipientWhere(role, userId) {
  return {
    OR: [
      { recipient_type: role, recipient_id: String(userId) },
      { recipient_type: role, recipient_id: 'all' },
      { recipient_type: 'all' },
      { recipient_type: 'system' },
      ...(role === 'admin' ? [{ recipient_type: 'admin' }] : []),
    ],
  };
}

async function listInbox(role, userId, { take = 80 } = {}) {
  const notifications = await prisma.inboxNotification.findMany({
    where: recipientWhere(role, userId),
    orderBy: { created_at: 'desc' },
    take,
  });

  let items = notifications.map(serialize);
  if (role === 'vendor' && userId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: userId },
      select: { notification_preferences: true },
    }).catch(() => null);
    const prefs = vendor?.notification_preferences;
    if (prefs && typeof prefs === 'object') {
      if (prefs.in_app === false) return [];
      items = items.filter((item) => {
        const t = String(item.type || '').toLowerCase();
        let category = null;
        if (t.includes('stock') || t.includes('expiry')) category = 'stock';
        else if (t.includes('order')) category = 'orders';
        else if (t.includes('prescription')) category = 'prescriptions';
        else if (t.includes('payout')) category = 'payouts';
        return !category || prefs[category] !== false;
      });
    }
  }
  return items;
}

async function unreadCount(role, userId) {
  return prisma.inboxNotification.count({
    where: {
      ...recipientWhere(role, userId),
      is_read: false,
    },
  });
}

async function markRead(role, userId, notificationId) {
  await prisma.inboxNotification.updateMany({
    where: {
      id: notificationId,
      ...recipientWhere(role, userId),
    },
    data: {
      is_read: true,
      read_at: new Date(),
    },
  });
}

async function markAllRead(role, userId) {
  await prisma.inboxNotification.updateMany({
    where: {
      ...recipientWhere(role, userId),
      is_read: false,
    },
    data: {
      is_read: true,
      read_at: new Date(),
    },
  });
}

module.exports = {
  notify,
  notifyAdmins,
  listInbox,
  unreadCount,
  markRead,
  markAllRead,
  serialize,
};
