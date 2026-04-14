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

async function getTransactionSummary(transactionId) {
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
      device: true,
    },
  });
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  if (transaction.status_id !== CONSTANTS.TRANSACTION_STATUS.AWAITING_USER_CONFIRMATION) {
    throw new Error('Transaction not awaiting confirmation');
  }

  const cachedCart = sessionCartCacheService.getSessionCart(transactionId);
  if (cachedCart) {
    return {
      transaction_id: transaction.transaction_id,
      transaction_code: transaction.transaction_code,
      device_id: transaction.device_id,
      device_name: transaction.device.name,
      status_id: transaction.status_id,
      start_time: transaction.start_time,
      end_time: transaction.end_time,
      items: cachedCart.cart.map((item) => ({
        product_id: item.product_id,
        name: item.name,
        brand: item.brand,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      })),
      total_price: cachedCart.total_price,
    };
  }
  
  // Aggregate items
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
        brand: item.product.brand.brand_name,
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price_at_sale),
        subtotal: item.quantity * parseFloat(item.unit_price_at_sale),
      });
    }
  }
  
  const items = Array.from(itemMap.values());
  const totalPrice = items.reduce((sum, item) => sum + item.subtotal, 0);
  
  return {
    transaction_id: transaction.transaction_id,
    transaction_code: transaction.transaction_code,
    device_id: transaction.device_id,
    device_name: transaction.device.name,
    status_id: transaction.status_id,
    start_time: transaction.start_time,
    end_time: transaction.end_time,
    items,
    total_price: totalPrice,
  };
}

async function confirmTransaction(transactionId, confirmedAt) {
  // Idempotency check
  const transaction = await prisma.transaction.findUnique({
    where: { transaction_id: transactionId },
  });
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  if (transaction.status_id === CONSTANTS.TRANSACTION_STATUS.COMPLETED) {
    // Already completed - return without re-applying inventory
    return {
      transaction_id: transaction.transaction_id,
      status_id: transaction.status_id,
      inventory_updated: false,
      alerts_created: 0,
      message: 'Transaction already completed',
    };  }
  
  if (transaction.status_id !== CONSTANTS.TRANSACTION_STATUS.AWAITING_USER_CONFIRMATION) {
    throw new Error('Transaction not awaiting confirmation');
  }

  const cartSnapshot = sessionCartCacheService.consumeSessionCart(transactionId);
  if (!cartSnapshot) {
    throw new Error('Session cart not found');
  }

  const cartItems = cartSnapshot.cart.filter((item) => Number(item.quantity) > 0);
  
  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Update transaction status
    const updated = await tx.transaction.update({
      where: { transaction_id: transactionId },
      data: {
        status_id: CONSTANTS.TRANSACTION_STATUS.COMPLETED,
      },
    });
    
    await tx.transactionItem.deleteMany({
      where: { transaction_id: transactionId },
    });

    // Update inventory for each item
    let alertsCreated = 0;
    
    for (const item of cartItems) {
      const quantity = Math.max(0, Number(item.quantity || 0));
      if (quantity <= 0) {
        continue;
      }

      if (!item.product_id) {
        throw new Error('Session cart contains item without product_id');
      }

      const unitPrice = toMoney(item.unit_price);

      await tx.transactionItem.create({
        data: {
          transaction_item_id: uuidv4(),
          transaction_id: transactionId,
          product_id: item.product_id,
          quantity,
          action_type_id: CONSTANTS.ACTION_TYPE.ADD,
          timestamp: confirmedAt || new Date(),
          unit_price_at_sale: unitPrice,
        },
      });

      // Get current inventory
      const inventory = await tx.inventory.findUnique({
        where: {
          device_id_product_id: {
            device_id: transaction.device_id,
            product_id: item.product_id,
          },
        },
      });
      
      if (inventory) {
        const newStock = inventory.current_stock - quantity;
        
        await tx.inventory.update({
          where: {
            device_id_product_id: {
              device_id: transaction.device_id,
              product_id: item.product_id,
            },
          },
          data: {
            current_stock: Math.max(0, newStock),
            last_stock_update: new Date(),
          },
        });
        
        // Check if stock is below critical threshold
        if (newStock <= inventory.critic_stock) {
          await tx.alert.create({
            data: {
              alert_id: uuidv4(),
              device_id: transaction.device_id,
              timestamp: new Date(),
              alert_type: 'LOW_STOCK',
              message: `Product ${item.name || item.product_id} is below critical stock level`,
              status: CONSTANTS.ALERT_STATUS.OPEN,
            },
          });
          alertsCreated++;
        }
      }
    }
    
    // Log system event
    await tx.systemLog.create({
      data: {
        log_id: uuidv4(),
        title: 'Transaction Completed',
        message: `Transaction ${transactionId} confirmed and inventory updated`,
        level: 'INFO',
        log_date: new Date(),
        relational_id: transactionId,
      },
    });
    
    return { updated, alertsCreated };
  });
  
  return {
    transaction_id: transaction.transaction_id,
    status_id: CONSTANTS.TRANSACTION_STATUS.COMPLETED,
    inventory_updated: true,
    alerts_created: result.alertsCreated,
  };
}

async function disputeTransaction(transactionId, reason, message, reportedAt) {
  const transaction = await prisma.transaction.findUnique({
    where: { transaction_id: transactionId },
  });
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  if (transaction.status_id !== CONSTANTS.TRANSACTION_STATUS.AWAITING_USER_CONFIRMATION) {
    throw new Error('Transaction not awaiting confirmation');
  }
  
  // Update transaction status
  const updated = await prisma.transaction.update({
    where: { transaction_id: transactionId },
    data: {
      status_id: CONSTANTS.TRANSACTION_STATUS.DISPUTED,
    },
  });
  
  // Log dispute
  await prisma.systemLog.create({
    data: {
      log_id: require('uuid').v4(),
      title: 'Transaction Disputed',
      message: `Transaction ${transactionId} disputed: ${reason} - ${message}`,
      level: 'WARN',
      log_date: new Date(reportedAt),
      relational_id: transactionId,
    },
  });
  
  return {
    transaction_id: updated.transaction_id,
    transaction_code: transaction.transaction_code,
    status_id: updated.status_id,
    reason,
    message,
  };
}

async function applyInventoryManually(transactionId) {
  // System admin only - manual recovery
  const transaction = await prisma.transaction.findUnique({
    where: { transaction_id: transactionId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  if (transaction.status_id !== CONSTANTS.TRANSACTION_STATUS.AWAITING_USER_CONFIRMATION &&
      transaction.status_id !== CONSTANTS.TRANSACTION_STATUS.DISPUTED) {
    throw new Error('Transaction cannot have inventory applied');
  }
  
  // Apply inventory update
  const result = await prisma.$transaction(async (tx) => {
    let alertsCreated = 0;
    
    for (const item of transaction.items) {
      const inventory = await tx.inventory.findUnique({
        where: {
          device_id_product_id: {
            device_id: transaction.device_id,
            product_id: item.product_id,
          },
        },
      });
      
      if (inventory) {
        const newStock = inventory.current_stock - item.quantity;
        
        await tx.inventory.update({
          where: {
            device_id_product_id: {
              device_id: transaction.device_id,
              product_id: item.product_id,
            },
          },
          data: {
            current_stock: Math.max(0, newStock),
            last_stock_update: new Date(),
          },
        });
        
        if (newStock <= inventory.critic_stock) {
          await tx.alert.create({
            data: {
              alert_id: uuidv4(),
              device_id: transaction.device_id,
              timestamp: new Date(),
              alert_type: 'LOW_STOCK',
              message: `Product ${item.product.name} is below critical stock level`,
              status_id: CONSTANTS.ALERT_STATUS.OPEN,
            },
          });
          alertsCreated++;
        }
      }
    }
    
    // Update transaction status if it was disputed
    if (transaction.status_id === CONSTANTS.TRANSACTION_STATUS.DISPUTED) {
      await tx.transaction.update({
        where: { transaction_id: transactionId },
        data: {
          status_id: CONSTANTS.TRANSACTION_STATUS.COMPLETED,
        },
      });
    }
    
    return { alertsCreated };
  });
  
  return {
    transaction_id: transactionId,
    transaction_code: transaction.transaction_code,
    inventory_updated: true,
    alerts_created: result.alertsCreated,
  };
}

async function getTransactionDetails(transactionId, adminUserId, isSystemAdmin) {
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
      device: {
        include: {
          deviceAssignments: {
            where: { is_active: true },
          },
        },
      },
      user: true,
    },
  });

  if (!transaction) {
    return null;
  }

  // System admin değilse, sadece kendi cihazlarının transaction'larını görebilir
  if (!isSystemAdmin) {
    const hasAccess = transaction.device.deviceAssignments.some(
      (assignment) => assignment.admin_user_id === adminUserId
    );

    if (!hasAccess) {
      throw new Error('Access denied');
    }
  }

  return transaction;
}

module.exports = {
  getTransactionSummary,
  confirmTransaction,
  disputeTransaction,
  applyInventoryManually,
  getTransactionDetails,
};

