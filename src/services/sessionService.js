const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const CONSTANTS = require('../config/constants');
const sessionCartCacheService = require('./sessionCartCacheService');

function toMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(2));
}

function normalizeItemsFromTransactionItems(items) {
  const itemMap = new Map();

  for (const item of items) {
    const productId = item.product_id;
    const current = itemMap.get(productId) || {
      product_id: productId,
      name: item.product?.name || 'Unknown Product',
      brand: item.product?.brand?.brand_name || null,
      quantity: 0,
      unit_price: toMoney(item.unit_price_at_sale),
      subtotal: 0,
      metadata: {},
    };

    current.quantity += item.quantity;
    current.subtotal = toMoney(current.quantity * current.unit_price);
    itemMap.set(productId, current);
  }

  return Array.from(itemMap.values());
}

async function getTransactionOrThrow(transactionId) {
  const transaction = await prisma.transaction.findUnique({
    where: { transaction_id: transactionId },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  return transaction;
}

async function startSession(deviceId, startedAt, sessionInitToken, transactionType) {
  // Check for existing active session
  const existingSession = await prisma.transaction.findFirst({
    where: {
      device_id: deviceId,
      is_active: true,
      status_id: CONSTANTS.TRANSACTION_STATUS.ACTIVE,
    },
  });
  
  if (existingSession) {
    throw new Error('Active session already exists');
  }
  
  // Check device status
  const device = await prisma.cooler.findUnique({
    where: { device_id: deviceId },
  });
  
  if (!device || device.status_id !== CONSTANTS.DEVICE_STATUS.ACTIVE) {
    throw new Error('Device not active');
  }
  
  // Create transaction
  const transaction = await prisma.transaction.create({
    data: {
      transaction_id: uuidv4(),
      device_id: deviceId,
      start_time: new Date(startedAt),
      is_active: true,
      status_id: CONSTANTS.TRANSACTION_STATUS.ACTIVE,
      transaction_type: transactionType || 'QR',
    },
  });
  
  // Update device door status
  await prisma.cooler.update({
    where: { device_id: deviceId },
    data: { door_status: true },
  });

  sessionCartCacheService.initSessionCart({
    transaction_id: transaction.transaction_id,
    device_id: transaction.device_id,
    status_id: transaction.status_id,
  });
  
  return {
    transaction_id: transaction.transaction_id,
    device_id: transaction.device_id,
    status_id: transaction.status_id,
    is_active: transaction.is_active,
    start_time: transaction.start_time,
  };
}

async function addInteraction(deviceId, transactionId, events) {
  // Verify transaction is active
  const transaction = await prisma.transaction.findUnique({
    where: { transaction_id: transactionId },
    include: { device: true },
  });
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  if (transaction.device_id !== deviceId) {
    throw new Error('Transaction device mismatch');
  }
  
  if (transaction.status_id !== CONSTANTS.TRANSACTION_STATUS.ACTIVE) {
    throw new Error('Transaction not active');
  }
  
  const processedEvents = await prisma.$transaction(async (tx) => {
    const acceptedEvents = [];
    
    for (const event of events) {
      // Check if event_id already exists using SystemLog
      const existingEvent = await tx.systemLog.findFirst({
        where: {
          title: 'ProductInteractionEvent',
          relational_id: event.event_id,
        },
      });
      
      if (existingEvent) {
        // Event already processed - skip
        continue;
      }
      
      const product = await tx.product.findUnique({
        where: { product_id: event.product_id },
        include: {
          brand: true,
        },
      });
      
      if (!product) {
        continue; // Skip invalid products
      }
      
      // Mark event as processed in SystemLog (within transaction)
      await tx.systemLog.create({
        data: {
          log_id: uuidv4(),
          title: 'ProductInteractionEvent',
          message: `Event ${event.event_id} processed for transaction ${transactionId}`,
          level: 'INFO',
          log_date: new Date(),
          relational_id: event.event_id,
        },
      });
      
      const eventQuantity = Math.max(1, Number(event.quantity || 1));
      const quantityDelta = event.action_type_id === CONSTANTS.ACTION_TYPE.ADD
        ? eventQuantity
        : -eventQuantity;

      acceptedEvents.push({
        event_id: event.event_id,
        product_id: event.product_id,
        quantity_delta: quantityDelta,
        timestamp: event.timestamp,
        name: product.name,
        brand: product.brand?.brand_name || null,
        unit_price: toMoney(product.unit_price),
      });
    }
    
    return acceptedEvents;
  });

  sessionCartCacheService.applyInteractionEvents({
    transaction_id: transaction.transaction_id,
    device_id: transaction.device_id,
    status_id: transaction.status_id,
    events: processedEvents,
  });

  return getCart(transactionId);
}

async function getCart(transactionId) {
  const transaction = await prisma.transaction.findUnique({
    where: { transaction_id: transactionId },
    include: {
      items: {
        include: {
          product: {
            include: {
              brand: true,
            },
          },
        },
      },
      status: true,
    },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  let cached = sessionCartCacheService.getSessionCart(transactionId);

  if (!cached) {
    const fallbackItems = normalizeItemsFromTransactionItems(transaction.items || []);
    cached = sessionCartCacheService.replaceSessionCart({
      transaction_id: transaction.transaction_id,
      device_id: transaction.device_id,
      status_id: transaction.status_id,
      items: fallbackItems,
      source: 'DB_FALLBACK',
    });
  }

  return {
    ...cached,
    status: transaction.status,
  };
}

async function endSession(deviceId, transactionId, endedAt, cancelled = false) {
  const transaction = await prisma.transaction.findUnique({
    where: { transaction_id: transactionId },
  });
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  if (transaction.device_id !== deviceId) {
    throw new Error('Transaction device mismatch');
  }
  
  if (transaction.status_id !== CONSTANTS.TRANSACTION_STATUS.ACTIVE) {
    throw new Error('Transaction not active');
  }
  
  // Update transaction
  const nextStatusId = cancelled
    ? CONSTANTS.TRANSACTION_STATUS.CANCELLED
    : CONSTANTS.TRANSACTION_STATUS.AWAITING_USER_CONFIRMATION;

  const updated = await prisma.transaction.update({
    where: { transaction_id: transactionId },
    data: {
      end_time: new Date(endedAt),
      is_active: false,
      status_id: nextStatusId,
    },
  });
  
  // Update device door status
  await prisma.cooler.update({
    where: { device_id: deviceId },
    data: { door_status: false },
  });

  if (cancelled) {
    sessionCartCacheService.clearSessionCart(transactionId);
  }
  
  return {
    transaction_id: updated.transaction_id,
    status: updated.status,
    end_time: updated.end_time,
  };
}

async function updateCartSnapshot(transactionId, items, source = 'AI_MODEL', detectedAt = null) {
  const transaction = await getTransactionOrThrow(transactionId);

  if (transaction.status_id !== CONSTANTS.TRANSACTION_STATUS.ACTIVE &&
      transaction.status_id !== CONSTANTS.TRANSACTION_STATUS.AWAITING_USER_CONFIRMATION) {
    throw new Error('Transaction not active');
  }

  const productIds = [...new Set((items || []).map((item) => item.product_id).filter(Boolean))];
  const products = await prisma.product.findMany({
    where: {
      product_id: { in: productIds },
    },
    include: {
      brand: true,
    },
  });

  const productsById = new Map(products.map((product) => [product.product_id, product]));
  const normalized = [];

  for (const item of items || []) {
    if (!item.product_id) {
      continue;
    }

    const product = productsById.get(item.product_id);
    if (!product) {
      continue;
    }

    const quantity = Math.max(0, Number(item.quantity || 0));
    if (quantity <= 0) {
      continue;
    }

    const unitPrice = toMoney(item.unit_price ?? product.unit_price);

    normalized.push({
      product_id: item.product_id,
      name: product.name,
      brand: product.brand?.brand_name || null,
      quantity,
      unit_price: unitPrice,
      subtotal: toMoney(quantity * unitPrice),
      metadata: {
        source,
        detected_at: detectedAt,
      },
    });
  }

  sessionCartCacheService.replaceSessionCart({
    transaction_id: transaction.transaction_id,
    device_id: transaction.device_id,
    status_id: transaction.status_id,
    items: normalized,
    source,
  });

  return getCart(transactionId);
}

async function getCurrentSession(deviceId, sessionInitToken) {
  const transaction = await prisma.transaction.findFirst({
    where: {
      device_id: deviceId,
      is_active: true,
    },
    orderBy: { start_time: 'desc' },
  });
  
  return {
    device_id: deviceId,
    has_active_session: !!transaction,
    transaction_id: transaction?.transaction_id || null,
    status: transaction?.status || null,
    started_at: transaction?.start_time || null,
  };
}

module.exports = {
  startSession,
  addInteraction,
  getCart,
  endSession,
  getCurrentSession,
  updateCartSnapshot,
};

