const prisma = require('../config/database');
const { paginate } = require('../utils/pagination');

async function getAdminDevices(adminUserId, isSystemAdmin, { page, limit }) {
  if (isSystemAdmin) {
    return paginate(
      prisma.cooler,
      { orderBy: { name: 'asc' } },
      { page, limit },
    );
  }

  // Normal admin: paginate through assignments, return devices
  const result = await paginate(
    prisma.deviceAssignment,
    {
      where: {
        admin_user_id: adminUserId,
        is_active: true,
      },
      include: { device: true },
      orderBy: { assigned_at: 'desc' },
    },
    { page, limit },
  );

  return {
    data: result.data.map(a => a.device),
    pagination: result.pagination,
  };
}

async function getDeviceInventory(deviceId, { page, limit }) {
  const result = await paginate(
    prisma.inventory,
    {
      where: { device_id: deviceId },
      include: {
        product: {
          include: { brand: true },
        },
      },
    },
    { page, limit },
  );

  return {
    data: result.data.map(inv => ({
      product_id: inv.product_id,
      product_name: inv.product.name,
      brand_name: inv.product.brand.brand_name,
      current_stock: inv.current_stock,
      critic_stock: inv.critic_stock,
      last_stock_update: inv.last_stock_update,
    })),
    pagination: result.pagination,
  };
}

async function getDeviceTransactions(deviceId, { page, limit }) {
  return paginate(
    prisma.transaction,
    {
      where: { device_id: deviceId },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { start_time: 'desc' },
    },
    { page, limit },
  );
}

async function getDeviceTelemetry(deviceId, { page, limit }) {
  return paginate(
    prisma.telemetry,
    {
      where: { device_id: deviceId },
      orderBy: { timestamp: 'desc' },
    },
    { page, limit },
  );
}

async function getDeviceTemperatureHistory(deviceId, { page, limit }) {
  return paginate(
    prisma.temperatureHistory,
    {
      where: { device_id: deviceId },
      orderBy: { timestamp: 'desc' },
    },
    { page, limit },
  );
}

async function getDeviceAlerts(deviceId, status_id = null, { page, limit }) {
  const where = { device_id: deviceId };
  if (status_id !== null) {
    where.status_id = status_id;
  }

  return paginate(
    prisma.alert,
    {
      where,
      orderBy: { timestamp: 'desc' },
    },
    { page, limit },
  );
}

function isOnlineStatus(statusName) {
  if (!statusName) return false;
  const normalized = String(statusName).toLowerCase();
  return normalized.includes('online') || normalized.includes('active');
}

function buildWeeklyData(transactionDates) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date;
  });

  return days.map((date) => {
    const dayKey = date.toDateString();
    const sessions = transactionDates.filter((txnDate) => {
      const parsed = new Date(txnDate);
      return !Number.isNaN(parsed.getTime()) && parsed.toDateString() === dayKey;
    }).length;

    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      sessions,
    };
  });
}

async function getVisibleDevicesForAdmin(adminUserId, isSystemAdmin) {
  if (isSystemAdmin) {
    return prisma.cooler.findMany({
      select: {
        device_id: true,
        name: true,
        status: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  const assignments = await prisma.deviceAssignment.findMany({
    where: {
      admin_user_id: adminUserId,
      is_active: true,
    },
    select: {
      device: {
        select: {
          device_id: true,
          name: true,
          status: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return assignments.map((assignment) => assignment.device).filter(Boolean);
}

async function getDashboardSummary(adminUserId, isSystemAdmin) {
  const devices = await getVisibleDevicesForAdmin(adminUserId, isSystemAdmin);
  const deviceIds = devices.map((device) => device.device_id);
  const deviceNameMap = new Map(devices.map((device) => [device.device_id, device.name || device.device_id]));

  const stats = {
    totalFridges: devices.length,
    onlineFridges: devices.filter((device) => isOnlineStatus(device.status?.name)).length,
    activeSessions: 0,
    totalAlerts: 0,
  };

  if (deviceIds.length === 0) {
    return {
      stats,
      recentAlerts: [],
      recentActivity: [],
      weeklyData: buildWeeklyData([]),
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [totalAlerts, activeSessions, recentAlertsRaw, recentTransactionsRaw, recentWeekTransactions] = await Promise.all([
    prisma.alert.count({
      where: {
        device_id: { in: deviceIds },
      },
    }),
    prisma.transaction.count({
      where: {
        device_id: { in: deviceIds },
        start_time: {
          gte: startOfToday,
          lt: endOfToday,
        },
      },
    }),
    prisma.alert.findMany({
      where: {
        device_id: { in: deviceIds },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 5,
      select: {
        device_id: true,
        alert_type: true,
        timestamp: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        device_id: { in: deviceIds },
      },
      orderBy: {
        start_time: 'desc',
      },
      take: 6,
      select: {
        device_id: true,
        start_time: true,
        transaction_type: true,
        items: {
          select: {
            quantity: true,
            product: {
              select: {
                name: true,
              },
            },
            actionType: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        device_id: { in: deviceIds },
        start_time: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        start_time: true,
      },
    }),
  ]);

  const recentAlerts = recentAlertsRaw.map((alert) => ({
    ...alert,
    fridge: deviceNameMap.get(alert.device_id) || alert.device_id,
  }));

  const recentActivity = recentTransactionsRaw.map((transaction) => {
    const items = transaction.items || [];
    const movementItems = items.filter((item) => Number(item?.quantity || 0) !== 0);
    const totalItems = movementItems.reduce((sum, item) => {
      const quantity = Math.abs(Number(item.quantity || 0));
      return sum + (Number.isFinite(quantity) ? quantity : 0);
    }, 0);

    const actionCounts = movementItems.reduce((acc, item) => {
      const name = String(item?.actionType?.name || '').toLowerCase();
      const quantity = Math.abs(Number(item?.quantity || 0));
      if (!Number.isFinite(quantity) || quantity <= 0) return acc;

      if (name.includes('return')) {
        acc.returned += quantity;
      } else {
        acc.taken += quantity;
      }
      return acc;
    }, { taken: 0, returned: 0 });

    const actionType = movementItems.find((item) => item?.actionType?.name)?.actionType?.name
      || transaction.transaction_type
      || null;
    const productSummary = movementItems.length > 0
      ? movementItems
        .map((item) => `${item.product?.name || 'Unknown product'} x${Math.abs(Number(item.quantity || 0))}`)
        .join(', ')
      : '-';
    const hasProductMovement = totalItems > 0;

    let displayAction = 'No product movement';
    if (hasProductMovement) {
      if (actionCounts.taken > 0 && actionCounts.returned > 0) {
        displayAction = 'Take/Return';
      } else if (actionCounts.returned > 0) {
        displayAction = 'Return';
      } else {
        displayAction = 'Take';
      }
    }

    let displayCount = 'No product movement';
    if (hasProductMovement) {
      if (actionCounts.taken > 0 && actionCounts.returned > 0) {
        displayCount = `Take ${actionCounts.taken} / Return ${actionCounts.returned}`;
      } else {
        displayCount = `${totalItems} item${totalItems === 1 ? '' : 's'}`;
      }
    }

    return {
      device_id: transaction.device_id,
      fridge: deviceNameMap.get(transaction.device_id) || transaction.device_id,
      start_time: transaction.start_time,
      action_type: actionType,
      item_count: totalItems,
      product_summary: productSummary,
      has_product_movement: hasProductMovement,
      display_action: displayAction,
      display_count: displayCount,
    };
  });

  return {
    stats: {
      ...stats,
      activeSessions,
      totalAlerts,
    },
    recentAlerts,
    recentActivity,
    weeklyData: buildWeeklyData(recentWeekTransactions.map((item) => item.start_time)),
  };
}

async function getCoolerProducts(deviceId, { page, limit }) {
  const result = await paginate(
    prisma.coolerProduct,
    {
      where: { device_id: deviceId },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
      orderBy: { product: { name: 'asc' } },
    },
    { page, limit },
  );

  return {
    data: result.data.map((item) => ({
      device_id: item.device_id,
      product_id: item.product_id,
      is_active: item.is_active,
      product_name: item.product?.name,
      brand_name: item.product?.brand?.brand_name,
      unit_price: item.product?.unit_price,
    })),
    pagination: result.pagination,
  };
}

async function assignProductToCooler(deviceId, productId) {
  return prisma.coolerProduct.upsert({
    where: {
      device_id_product_id: {
        device_id: deviceId,
        product_id: productId,
      },
    },
    update: {
      is_active: true,
    },
    create: {
      device_id: deviceId,
      product_id: productId,
      is_active: true,
    },
    include: {
      product: {
        include: {
          brand: true,
        },
      },
    },
  });
}

async function removeProductFromCooler(deviceId, productId) {
  return prisma.coolerProduct.delete({
    where: {
      device_id_product_id: {
        device_id: deviceId,
        product_id: productId,
      },
    },
  });
}

async function addToInventory(deviceId, productId, quantityToAdd) {
  if (!deviceId || !productId || quantityToAdd <= 0) {
    throw new Error('Invalid deviceId, productId, or quantityToAdd');
  }

  // Find current inventory
  let inventory = await prisma.inventory.findUnique({
    where: {
      device_id_product_id: {
        device_id: deviceId,
        product_id: productId,
      },
    },
  });

  // If inventory doesn't exist, create it
  if (!inventory) {
    inventory = await prisma.inventory.create({
      data: {
        device_id: deviceId,
        product_id: productId,
        current_stock: quantityToAdd,
        critic_stock: 5, // Default critical stock level
        last_stock_update: new Date(),
      },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
    });
  } else {
    // Update existing inventory
    inventory = await prisma.inventory.update({
      where: {
        device_id_product_id: {
          device_id: deviceId,
          product_id: productId,
        },
      },
      data: {
        current_stock: {
          increment: quantityToAdd,
        },
        last_stock_update: new Date(),
      },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
    });
  }

  // Check if we need to create an alert (if stock was low but now it's okay)
  // or remove an alert if stock is now above critical level
  const alertExists = await prisma.alert.findFirst({
    where: {
      device_id: deviceId,
      alert_type: 'LOW_STOCK',
      status_id: 1, // OPEN status
    },
  });

  if (alertExists && inventory.current_stock > inventory.critic_stock) {
    // Update alert to resolved
    await prisma.alert.update({
      where: {
        alert_id: alertExists.alert_id,
      },
      data: {
        status_id: 2, // RESOLVED status
      },
    });
  }

  return {
    device_id: deviceId,
    product_id: productId,
    product_name: inventory.product?.name,
    brand_name: inventory.product?.brand?.brand_name,
    previous_stock: inventory.current_stock - quantityToAdd,
    quantity_added: quantityToAdd,
    new_stock: inventory.current_stock,
    critic_stock: inventory.critic_stock,
    last_stock_update: inventory.last_stock_update,
  };
}

async function updateInventoryQuantity(deviceId, productId, newQuantity) {
  if (!deviceId || !productId || newQuantity === undefined || newQuantity === null) {
    throw new Error('Invalid deviceId, productId, or newQuantity');
  }

  if (typeof newQuantity !== 'number' || newQuantity < 0 || !Number.isInteger(newQuantity)) {
    throw new Error('newQuantity must be a non-negative integer');
  }

  // Get current inventory
  let inventory = await prisma.inventory.findUnique({
    where: {
      device_id_product_id: {
        device_id: deviceId,
        product_id: productId,
      },
    },
  });

  if (!inventory) {
    throw new Error('Inventory not found for this product and device');
  }

  // Update inventory with new quantity
  inventory = await prisma.inventory.update({
    where: {
      device_id_product_id: {
        device_id: deviceId,
        product_id: productId,
      },
    },
    data: {
      current_stock: newQuantity,
      last_stock_update: new Date(),
    },
    include: {
      product: {
        include: {
          brand: true,
        },
      },
    },
  });

  // Check if we need to create/update alerts based on stock level
  const alertExists = await prisma.alert.findFirst({
    where: {
      device_id: deviceId,
      alert_type: 'LOW_STOCK',
      status_id: 1, // OPEN status
    },
  });

  // If stock is now below critical level and no alert exists, create one
  if (inventory.current_stock <= inventory.critic_stock && !alertExists) {
    await prisma.alert.create({
      data: {
        device_id: deviceId,
        alert_type: 'LOW_STOCK',
        message: `Low stock alert for ${inventory.product?.name}`,
        status_id: 1, // OPEN
      },
    });
  } else if (alertExists && inventory.current_stock > inventory.critic_stock) {
    // If stock is now above critical and alert exists, resolve it
    await prisma.alert.update({
      where: {
        alert_id: alertExists.alert_id,
      },
      data: {
        status_id: 2, // RESOLVED
      },
    });
  }

  return {
    device_id: deviceId,
    product_id: productId,
    product_name: inventory.product?.name,
    brand_name: inventory.product?.brand?.brand_name,
    new_stock: inventory.current_stock,
    critic_stock: inventory.critic_stock,
    last_stock_update: inventory.last_stock_update,
  };
}

async function checkCoolerInventoryConsistency(deviceId) {
  const [assignedProducts, inventoryItems] = await Promise.all([
    prisma.coolerProduct.findMany({
      where: { device_id: deviceId, is_active: true },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
    }),
    prisma.inventory.findMany({
      where: { device_id: deviceId },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
    }),
  ]);

  const assignedMap = new Map(assignedProducts.map((item) => [item.product_id, item]));
  const inventoryMap = new Map(inventoryItems.map((item) => [item.product_id, item]));

  const missingInInventory = assignedProducts
    .filter((item) => !inventoryMap.has(item.product_id))
    .map((item) => ({
      product_id: item.product_id,
      product_name: item.product?.name,
      brand_name: item.product?.brand?.brand_name,
      issue: 'assigned_but_no_inventory',
    }));

  const missingInAssignments = inventoryItems
    .filter((item) => !assignedMap.has(item.product_id))
    .map((item) => ({
      product_id: item.product_id,
      product_name: item.product?.name,
      brand_name: item.product?.brand?.brand_name,
      current_stock: item.current_stock,
      issue: 'inventory_but_not_assigned',
    }));

  return {
    device_id: deviceId,
    summary: {
      assigned_count: assignedProducts.length,
      inventory_count: inventoryItems.length,
      missing_in_inventory: missingInInventory.length,
      missing_in_assignments: missingInAssignments.length,
      capacity_warnings: 0,
      is_consistent:
        missingInInventory.length === 0 &&
        missingInAssignments.length === 0,
    },
    missing_in_inventory: missingInInventory,
    missing_in_assignments: missingInAssignments,
    capacity_warnings: [],
  };
}

module.exports = {
  getAdminDevices,
  getDashboardSummary,
  getDeviceInventory,
  getDeviceTransactions,
  getDeviceTelemetry,
  getDeviceTemperatureHistory,
  getDeviceAlerts,
  getCoolerProducts,
  assignProductToCooler,
  removeProductFromCooler,
  addToInventory,
  updateInventoryQuantity,
  checkCoolerInventoryConsistency,
};
