const prisma = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const CONSTANTS = require('../config/constants');

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
  
  // Process each event (with idempotency check) - use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    const processedEvents = [];
    
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
      });
      
      if (!product) {
        continue; // Skip invalid products
      }
      
      // Calculate quantity change
      const quantityChange = event.action_type_id === CONSTANTS.ACTION_TYPE.ADD 
        ? event.quantity 
        : -event.quantity;
      
      // Get current quantity for this product in transaction
      const currentItem = await tx.transactionItem.findFirst({
        where: {
          transaction_id: transactionId,
          product_id: event.product_id,
        },
        orderBy: { timestamp: 'desc' },
      });
      
      const currentQuantity = currentItem ? currentItem.quantity : 0;
      const newQuantity = Math.max(0, currentQuantity + quantityChange);
      
      // Create or update transaction item
      if (currentItem && newQuantity > 0) {
        await tx.transactionItem.update({
          where: { transaction_item_id: currentItem.transaction_item_id },
          data: {
            quantity: newQuantity,
            timestamp: new Date(event.timestamp),
          },
        });
      } else if (newQuantity > 0) {
        await tx.transactionItem.create({
          data: {
            transaction_item_id: uuidv4(),
            transaction_id: transactionId,
            product_id: event.product_id,
            quantity: newQuantity,
            action_type_id: event.action_type_id,
            timestamp: new Date(event.timestamp),
            unit_price_at_sale: product.unit_price,
          },
        });
      } else if (currentItem && newQuantity === 0) {
        // Remove item if quantity becomes 0
        await tx.transactionItem.delete({
          where: { transaction_item_id: currentItem.transaction_item_id },
        });
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
      
      processedEvents.push(event);
    }
    
    return processedEvents;
  });
  
  // Return current cart
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
    },
  });
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  // Aggregate items by product
  const itemMap = new Map();
  
  for (const item of transaction.items) {
    const productId = item.product_id;
    if (itemMap.has(productId)) {
      const existing = itemMap.get(productId);
      existing.quantity += item.quantity;
      existing.subtotal = existing.quantity * parseFloat(existing.unit_price);
    } else {
      itemMap.set(productId, {
        product_id: item.product_id,
        name: item.product.name,
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price_at_sale),
        subtotal: item.quantity * parseFloat(item.unit_price_at_sale),
      });
    }
  }
  
  const cart = Array.from(itemMap.values());
  const totalPrice = cart.reduce((sum, item) => sum + item.subtotal, 0);
  
  return {
    transaction_id: transaction.transaction_id,
    cart,
    total_price: totalPrice,
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
  
  return {
    transaction_id: updated.transaction_id,
    status: updated.status,
    end_time: updated.end_time,
  };
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
};

