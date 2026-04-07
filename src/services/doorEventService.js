const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const CONSTANTS = require('../config/constants');
const {
  registerActiveSession,
  unregisterActiveSession,
} = require('./sessionHeartbeatMonitorService');

/**
 * Log a door event to SystemLog with structured JSON message
 * @param {Object} params
 * @param {string} params.coolerId - Device ID
 * @param {string} params.eventType - "OPEN" or "CLOSE"
 * @param {string} params.sessionId - Optional session/transaction ID
 * @param {string} params.source - Optional source identifier (default: "device")
 * @returns {Promise<Object>} Created system log entry
 */
async function logDoorEvent({ coolerId, eventType, sessionId = null, source = 'device' }) {
  const logEntry = await prisma.systemLog.create({
    data: {
      log_id: uuidv4(),
      title: 'Door Event',
      message: JSON.stringify({
        text: `Door ${eventType}`,
        eventType, // "OPEN" | "CLOSE"
        coolerId,
        sessionId,
        source,
      }),
      level: 'INFO',
      log_date: new Date(),
      relational_id: coolerId,
    },
  });

  return logEntry;
}

/**
 * Handle door OPEN event - creates session if not exists
 * @param {string} coolerId - Device ID
 * @param {string} sessionId - Optional existing session ID
 * @returns {Promise<Object>} Transaction/session object
 */
async function handleDoorOpen(coolerId, sessionId = null) {
  // Check if device exists and is active
  const device = await prisma.cooler.findUnique({
    where: { device_id: coolerId },
  });

  if (!device) {
    throw new Error('Device not found');
  }

  if (device.status_id !== CONSTANTS.DEVICE_STATUS.ACTIVE) {
    throw new Error('Device not active');
  }

  // Check for existing active transaction
  let activeTransaction = await prisma.transaction.findFirst({
    where: {
      device_id: coolerId,
      is_active: true,
      status_id: CONSTANTS.TRANSACTION_STATUS.ACTIVE,
    },
  });

  // If already open, return existing transaction
  if (activeTransaction) {
    await logDoorEvent({
      coolerId,
      eventType: 'OPEN',
      sessionId: activeTransaction.transaction_id,
      source: 'device',
    });

    return {
      transaction_id: activeTransaction.transaction_id,
      status: 'already_open',
      message: 'Door was already open - active session exists',
    };
  }

  // Create new transaction/session
  const newTransaction = await prisma.transaction.create({
    data: {
      transaction_id: uuidv4(),
      device_id: coolerId,
      start_time: new Date(),
      last_activity: new Date(),
      is_active: true,
      status_id: CONSTANTS.TRANSACTION_STATUS.ACTIVE,
      transaction_type: 'DOOR_OPEN',
    },
  });

  registerActiveSession(newTransaction.transaction_id);

  // Update device door status
  await prisma.cooler.update({
    where: { device_id: coolerId },
    data: { door_status: true },
  });

  // Log door open event
  await logDoorEvent({
    coolerId,
    eventType: 'OPEN',
    sessionId: newTransaction.transaction_id,
    source: 'device',
  });

  return {
    transaction_id: newTransaction.transaction_id,
    status: 'session_created',
    message: 'New session created on door open',
  };
}

/**
 * Handle door CLOSE event - finalizes active session
 * @param {string} coolerId - Device ID
 * @returns {Promise<Object>} Result object
 */
async function handleDoorClose(coolerId) {
  // Check if device exists
  const device = await prisma.cooler.findUnique({
    where: { device_id: coolerId },
  });

  if (!device) {
    throw new Error('Device not found');
  }

  // Find active transaction
  const activeTransaction = await prisma.transaction.findFirst({
    where: {
      device_id: coolerId,
      is_active: true,
      status_id: CONSTANTS.TRANSACTION_STATUS.ACTIVE,
    },
  });

  // If no active session, log and return safely
  if (!activeTransaction) {
    await logDoorEvent({
      coolerId,
      eventType: 'CLOSE',
      sessionId: null,
      source: 'device',
    });

    return {
      status: 'no_session',
      message: 'Door close logged - no active session to finalize',
    };
  }

  // Update device door status
  await prisma.cooler.update({
    where: { device_id: coolerId },
    data: { door_status: false },
  });

  // Close transaction
  const updatedTransaction = await prisma.transaction.update({
    where: { transaction_id: activeTransaction.transaction_id },
    data: {
      is_active: false,
      end_time: new Date(),
      status_id: CONSTANTS.TRANSACTION_STATUS.AWAITING_USER_CONFIRMATION,
    },
  });

  unregisterActiveSession(activeTransaction.transaction_id);

  // Log door close event
  await logDoorEvent({
    coolerId,
    eventType: 'CLOSE',
    sessionId: activeTransaction.transaction_id,
    source: 'device',
  });

  return {
    transaction_id: activeTransaction.transaction_id,
    status: 'session_closed',
    message: 'Active session finalized on door close',
  };
}

/**
 * Parse a door event from a SystemLog entry
 * Safely extracts structured data from JSON message
 * @param {Object} log - SystemLog entry
 * @returns {Object|null} Parsed door event or null if not a door event
 */
function parseDoorEvent(log) {
  try {
    const data = JSON.parse(log.message);
    if (data.eventType && (data.eventType === 'OPEN' || data.eventType === 'CLOSE')) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  logDoorEvent,
  handleDoorOpen,
  handleDoorClose,
  parseDoorEvent,
};
