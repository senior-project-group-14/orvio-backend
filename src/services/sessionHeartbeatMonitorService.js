const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const CONSTANTS = require('../config/constants');
const sessionCartCacheService = require('./sessionCartCacheService');

let heartbeatMonitorTimer = null;
const activeSessionIds = new Set();

function getTimeoutThresholdDate() {
  const timeoutMs = CONSTANTS.SESSION_HEARTBEAT_TIMEOUT_SECONDS * 1000;
  return new Date(Date.now() - timeoutMs);
}

async function closeTimedOutSessions() {
  if (activeSessionIds.size === 0) {
    return;
  }

  const thresholdDate = getTimeoutThresholdDate();

  const expiredSessions = await prisma.transaction.findMany({
    where: {
      transaction_id: {
        in: Array.from(activeSessionIds),
      },
      is_active: true,
      status_id: CONSTANTS.TRANSACTION_STATUS.ACTIVE,
      last_activity: {
        lt: thresholdDate,
      },
    },
    select: {
      transaction_id: true,
      device_id: true,
    },
  });

  if (expiredSessions.length === 0) {
    return;
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const session of expiredSessions) {
      await tx.transaction.update({
        where: { transaction_id: session.transaction_id },
        data: {
          is_active: false,
          end_time: now,
          status_id: CONSTANTS.TRANSACTION_STATUS.FAILED,
        },
      });

      await tx.cooler.update({
        where: { device_id: session.device_id },
        data: { door_status: false },
      });

      await tx.systemLog.create({
        data: {
          log_id: uuidv4(),
          title: 'SessionHeartbeatTimeout',
          message: `Session ${session.transaction_id} ended due to heartbeat timeout`,
          level: 'WARN',
          log_date: now,
          relational_id: session.transaction_id,
        },
      });
    }
  });

  for (const session of expiredSessions) {
    sessionCartCacheService.clearSessionCart(session.transaction_id);
    activeSessionIds.delete(session.transaction_id);
  }

  if (activeSessionIds.size === 0) {
    stopPolling();
  }

  console.warn(
    `[SessionHeartbeatMonitor] ${expiredSessions.length} timed out session(s) closed (threshold=${thresholdDate.toISOString()})`
  );
}

function startPolling() {
  if (heartbeatMonitorTimer || activeSessionIds.size === 0) {
    return heartbeatMonitorTimer;
  }

  const intervalMs = CONSTANTS.SESSION_HEARTBEAT_INTERVAL_SECONDS * 1000;

  heartbeatMonitorTimer = setInterval(() => {
    closeTimedOutSessions().catch((error) => {
      console.error('[SessionHeartbeatMonitor] Failed to process heartbeat timeout check:', error);
    });
  }, intervalMs);

  heartbeatMonitorTimer.unref();

  console.log(
    `[SessionHeartbeatMonitor] polling started (interval=${CONSTANTS.SESSION_HEARTBEAT_INTERVAL_SECONDS}s, timeout=${CONSTANTS.SESSION_HEARTBEAT_TIMEOUT_SECONDS}s)`
  );

  return heartbeatMonitorTimer;
}

function stopPolling() {
  if (!heartbeatMonitorTimer) {
    return;
  }

  clearInterval(heartbeatMonitorTimer);
  heartbeatMonitorTimer = null;
  console.log('[SessionHeartbeatMonitor] polling stopped (no active sessions)');
}

function registerActiveSession(transactionId) {
  if (!transactionId) {
    return;
  }

  activeSessionIds.add(transactionId);
  startPolling();
}

function unregisterActiveSession(transactionId) {
  if (!transactionId) {
    return;
  }

  activeSessionIds.delete(transactionId);
  if (activeSessionIds.size === 0) {
    stopPolling();
  }
}

async function bootstrapActiveSessions() {
  const sessions = await prisma.transaction.findMany({
    where: {
      is_active: true,
      status_id: CONSTANTS.TRANSACTION_STATUS.ACTIVE,
    },
    select: {
      transaction_id: true,
    },
  });

  for (const session of sessions) {
    activeSessionIds.add(session.transaction_id);
  }

  if (activeSessionIds.size > 0) {
    startPolling();
  }

  console.log(`[SessionHeartbeatMonitor] initialized (active_sessions=${activeSessionIds.size})`);
}

function startSessionHeartbeatMonitor() {
  bootstrapActiveSessions().catch((error) => {
    console.error('[SessionHeartbeatMonitor] Failed to initialize monitor:', error);
  });
}

module.exports = {
  startSessionHeartbeatMonitor,
  registerActiveSession,
  unregisterActiveSession,
};
