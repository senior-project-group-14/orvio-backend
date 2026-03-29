const { Server } = require('socket.io');

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

    socket.on('disconnect', () => {
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
