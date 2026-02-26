const prisma = require('../config/database');

async function updateAlert(alertId, status_id, message, resolution_note, adminUserId, isSystemAdmin) {
  // Önce alert'i getir
  const alert = await prisma.alert.findUnique({
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

  if (!alert) {
    const error = new Error('Alert not found');
    error.code = 'P2025';
    throw error;
  }

  // System admin değilse, sadece kendi cihazlarının alert'lerini güncelleyebilir
  if (!isSystemAdmin) {
    const hasAccess = alert.device.deviceAssignments.some(
      (assignment) => assignment.admin_user_id === adminUserId
    );

    if (!hasAccess) {
      throw new Error('Access denied');
    }
  }

  const updateData = {};
  if (status_id !== undefined) updateData.status_id = status_id;
  if (message) updateData.message = message;
  if (resolution_note !== undefined) updateData.resolution_note = resolution_note;
  
  return prisma.alert.update({
    where: { alert_id: alertId },
    data: updateData,
  });
}

module.exports = {
  updateAlert,
};
