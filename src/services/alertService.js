const prisma = require('../config/database');

async function getAlertWithAccessContext(alertId) {
  return prisma.alert.findUnique({
    where: { alert_id: alertId },
    include: {
      device: {
        include: {
          deviceAssignments: {
            where: { is_active: true },
          },
        },
      },
    },
  });
}

function ensureAdminCanAccessAlert(alert, adminUserId, isSystemAdmin) {
  if (!alert) {
    const error = new Error('Alert not found');
    error.code = 'P2025';
    throw error;
  }

  if (isSystemAdmin) {
    return;
  }

  const hasAccess = alert.device.deviceAssignments.some(
    (assignment) => assignment.admin_user_id === adminUserId
  );

  if (!hasAccess) {
    throw new Error('Access denied');
  }
}

async function updateAlert(alertId, status_id, message, resolution_note, adminUserId, isSystemAdmin) {
  const alert = await getAlertWithAccessContext(alertId);
  ensureAdminCanAccessAlert(alert, adminUserId, isSystemAdmin);

  const updateData = {};
  if (status_id !== undefined) updateData.status_id = status_id;
  if (message) updateData.message = message;
  if (resolution_note !== undefined) updateData.resolution_note = resolution_note;
  
  return prisma.alert.update({
    where: { alert_id: alertId },
    data: updateData,
  });
}

async function markAlertRead(alertId, adminUserId, isSystemAdmin) {
  const alert = await getAlertWithAccessContext(alertId);
  ensureAdminCanAccessAlert(alert, adminUserId, isSystemAdmin);

  return prisma.adminAlertRead.upsert({
    where: {
      admin_user_id_alert_id: {
        admin_user_id: adminUserId,
        alert_id: alertId,
      },
    },
    update: {
      read_at: new Date(),
    },
    create: {
      admin_user_id: adminUserId,
      alert_id: alertId,
      read_at: new Date(),
    },
  });
}

async function getAdminAlertReads(adminUserId, alertIds = []) {
  const where = {
    admin_user_id: adminUserId,
  };

  if (Array.isArray(alertIds) && alertIds.length > 0) {
    where.alert_id = { in: alertIds };
  }

  return prisma.adminAlertRead.findMany({
    where,
    select: {
      alert_id: true,
      read_at: true,
    },
  });
}

module.exports = {
  updateAlert,
  markAlertRead,
  getAdminAlertReads,
};
