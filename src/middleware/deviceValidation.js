const prisma = require('../config/database');

async function deviceValidationMiddleware(req, res, next) {
  try {
    const deviceId = req.params.device_id || req.body.device_id;

    if (!deviceId || !String(deviceId).trim()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'device_id is required',
      });
    }

    const device = await prisma.cooler.findUnique({
      where: { device_id: deviceId },
    });

    if (!device) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    req.device = device;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = deviceValidationMiddleware;
