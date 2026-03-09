const prisma = require('../config/database');

async function deviceAccessMiddleware(req, res, next) {
  try {
    // 1️⃣ Admin auth gerçekten çalışmış mı?
    if (!req.adminUser || !req.adminUser.user_id) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin authentication required',
      });
    }

    // 2️⃣ System admin her şeye erişir
    if (req.isSystemAdmin === true) {
      return next();
    }

    // 3️⃣ device_id kontrolü
    const deviceId = req.params.device_id || req.params.cooler_id || req.params.id || req.body.device_id || req.body.cooler_id || req.body.id;

    if (!deviceId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'device_id required',
      });
    }

    // 4️⃣ Atama kontrolü
    const assignment = await prisma.deviceAssignment.findFirst({
      where: {
        device_id: deviceId,
        admin_user_id: req.adminUser.user_id,
        is_active: true,
      },
    });

    if (!assignment) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No active assignment to this device',
      });
    }

    // 5️⃣ Sonraki middleware/controller için ekle
    req.deviceAssignment = assignment;
    next();
  } catch (error) {
    console.error('deviceAccessMiddleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Device access check failed',
    });
  }
}

module.exports = deviceAccessMiddleware;
