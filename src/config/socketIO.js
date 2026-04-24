const { Server } = require('socket.io');
const prisma = require('./database');
const CONSTANTS = require('../config/constants');

const SESSION_PRESENCE_REFRESH_MS = 100;

const sessionPresenceByTransactionId = new Map();
const sessionPresenceBySocketId = new Map();
let sessionPresenceTimer = null;

function startSessionPresenceTimer() {
  if (sessionPresenceTimer) {
    return;
  }

  sessionPresenceTimer = setInterval(() => {
    const transactionIds = Array.from(sessionPresenceByTransactionId.keys());
    if (transactionIds.length === 0) {
      return;
    }

    prisma.transaction.updateMany({
      where: {
        transaction_id: { in: transactionIds },
        is_active: true,
        status_id: CONSTANTS.TRANSACTION_STATUS.ACTIVE,
      },
      data: {
        last_activity: new Date(),
      },
    }).catch((error) => {
      console.error('[SocketIO] Failed to refresh session presence heartbeat:', error);
    });
  }, SESSION_PRESENCE_REFRESH_MS);

  sessionPresenceTimer.unref();
}

function stopSessionPresenceTimerIfIdle() {
  if (sessionPresenceByTransactionId.size > 0 || !sessionPresenceTimer) {
    return;
  }

  clearInterval(sessionPresenceTimer);
  sessionPresenceTimer = null;
}

function unregisterSessionPresenceBySocket(socketId) {
  const current = sessionPresenceBySocketId.get(socketId);
  if (!current) {
    return;
  }

  const { transactionId } = current;
  sessionPresenceBySocketId.delete(socketId);

  const record = sessionPresenceByTransactionId.get(transactionId);
  if (!record) {
    stopSessionPresenceTimerIfIdle();
    return;
  }

  record.socketIds.delete(socketId);
  if (record.socketIds.size === 0) {
    sessionPresenceByTransactionId.delete(transactionId);
  }

  stopSessionPresenceTimerIfIdle();
}

async function registerSessionPresence(socket, payload) {
  const deviceId = payload?.device_id;
  const transactionId = payload?.transaction_id;

  if (!deviceId || !transactionId || typeof deviceId !== 'string' || typeof transactionId !== 'string') {
    throw new Error('device_id and transaction_id are required');
  }

  const transaction = await prisma.transaction.findUnique({
    where: { transaction_id: transactionId },
    select: {
      transaction_id: true,
      device_id: true,
      is_active: true,
      status_id: true,
    },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.device_id !== deviceId) {
    throw new Error('Transaction device mismatch');
  }

  if (!transaction.is_active || transaction.status_id !== CONSTANTS.TRANSACTION_STATUS.ACTIVE) {
    throw new Error('Transaction not active');
  }

  unregisterSessionPresenceBySocket(socket.id);

  const record = sessionPresenceByTransactionId.get(transactionId) || {
    deviceId,
    socketIds: new Set(),
  };

  record.socketIds.add(socket.id);
  sessionPresenceByTransactionId.set(transactionId, record);
  sessionPresenceBySocketId.set(socket.id, { transactionId, deviceId });
  startSessionPresenceTimer();

  await prisma.transaction.update({
    where: { transaction_id: transactionId },
    data: {
      last_activity: new Date(),
    },
  });
}

/**
 * Initialize Socket.io with the HTTP server
 * @param {http.Server} httpServer - The HTTP server instance
 * @returns {Server} Socket.io server instance
 */
function initializeSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Token'],
      credentials: false,
    },
  });

  // Connection event
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join cooler-specific room
    socket.on('join_cooler', (coolerId) => {
      if (coolerId && typeof coolerId === 'string') {
        socket.join(`cooler:${coolerId}`);
        console.log(`Socket ${socket.id} joined room cooler:${coolerId}`);
      }
    });

    // Leave cooler-specific room
    socket.on('leave_cooler', (coolerId) => {
      if (coolerId && typeof coolerId === 'string') {
        socket.leave(`cooler:${coolerId}`);
        console.log(`Socket ${socket.id} left room cooler:${coolerId}`);
      }
    });

    socket.on('register_session_presence', (payload, callback) => {
      registerSessionPresence(socket, payload)
        .then(() => {
          if (typeof callback === 'function') {
            callback({ ok: true });
          }
        })
        .catch((error) => {
          if (typeof callback === 'function') {
            callback({ ok: false, message: error.message || 'Failed to register session presence' });
          }
        });
    });

    socket.on('unregister_session_presence', () => {
      unregisterSessionPresenceBySocket(socket.id);
    });

    socket.on('disconnect', () => {
      unregisterSessionPresenceBySocket(socket.id);
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Emit a door event to all connected clients monitoring a specific cooler
 * @param {Server} io - Socket.io server instance
 * @param {string} coolerId - The device ID
 * @param {string} eventType - "OPEN" or "CLOSE"
 * @param {string} sessionId - The transaction/session ID
 * @param {Date} timestamp - Event timestamp
 */
function emitDoorEvent(io, coolerId, eventType, sessionId, timestamp) {
  io.to(`cooler:${coolerId}`).emit('door_event', {
    eventType,
    coolerId,
    sessionId,
    timestamp,
  });
}

module.exports = {
  initializeSocketIO,
  emitDoorEvent,
};
