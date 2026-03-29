const doorEventService = require('../services/doorEventService');
const { emitDoorEvent } = require('../config/socketIO');

async function handleDoorEvent(req, res, next) {
  try {
    const coolerId = req.params.device_id; // ✅ FIX
    const { eventType, sessionId } = req.body;

    // Validate coolerId
    if (!coolerId || typeof coolerId !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'coolerId is required and must be a string',
      });
    }

    // Validate eventType
    if (!eventType || !['OPEN', 'CLOSE'].includes(eventType.toUpperCase())) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'eventType must be either "OPEN" or "CLOSE"',
      });
    }

    const normalizedEventType = eventType.toUpperCase();

    let result;

    if (normalizedEventType === 'OPEN') {
      result = await doorEventService.handleDoorOpen(coolerId, sessionId);
    } else {
      result = await doorEventService.handleDoorClose(coolerId);
    }

    // Socket emit
    if (global.io) {
      try {
        emitDoorEvent(
          global.io,
          coolerId,
          normalizedEventType,
          result?.transaction_id || sessionId,
          new Date()
        );
      } catch (socketError) {
        console.error('Socket.io emission error:', socketError);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Door ${normalizedEventType} event processed`,
      data: result,
    });

  } catch (error) {
    if (error.message === 'Device not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    if (error.message === 'Device not active') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Device is not in ACTIVE status',
      });
    }

    next(error);
  }
}

module.exports = {
  handleDoorEvent,
};