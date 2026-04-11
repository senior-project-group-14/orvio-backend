/**
 * Application Constants
 * 
 * NOTE: IDs match the fixed integer IDs in lookup tables.
 * These are STABLE and should NEVER be changed.
 * String values are kept for backward compatibility and readability.
 */

module.exports = {
  // User Role Lookup IDs
  USER_ROLE: {
    ADMIN: 0,
    SYSTEM_ADMIN: 1,
  },

  // Device Status Lookup IDs
  DEVICE_STATUS: {
    ACTIVE: 0,
    INACTIVE: 1,
    OFFLINE: 2,
  },

  // Alert Status Lookup IDs
  ALERT_STATUS: {
    OPEN: 0,
    RESOLVED: 1,
    ACKNOWLEDGED: 2,
    READ: 3,
  },

  // Transaction Status Lookup IDs
  TRANSACTION_STATUS: {
    ACTIVE: 0,
    AWAITING_USER_CONFIRMATION: 1,
    COMPLETED: 2,
    DISPUTED: 3,
    CANCELLED: 4,
    FAILED: 5,
  },

  // Access Reason Lookup IDs
  ACCESS_REASON: {
    OK: 0,
    DEVICE_OFFLINE: 1,
    DEVICE_INACTIVE: 2,
    SESSION_LIMIT_REACHED: 3,
    DOOR_ALREADY_OPEN: 4,
    ACTIVE_SESSION_EXISTS: 5,
  },
  
  // Action Type Lookup IDs
  ACTION_TYPE: {
    ADD: 0,
    REMOVE: 1,
  },
  
  // Dispute Reason Lookup IDs
  DISPUTE_REASON: {
    WRONG_ITEM: 0,
    MISSING_ITEM: 1,
    OTHER: 2,
  },
  
  // Other constants (unchanged)
  SESSION_INIT_TOKEN_EXPIRY_SECONDS: 60,
  DEVICE_OFFLINE_THRESHOLD_MINUTES: 5,
  SESSION_HEARTBEAT_INTERVAL_SECONDS: 10,
  SESSION_HEARTBEAT_TIMEOUT_SECONDS: 20,
};

