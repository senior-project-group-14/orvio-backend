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
  getDeviceInventory,
  getDeviceTransactions,
  getDeviceTelemetry,
  getDeviceAlerts,
  getCoolerProducts,
  assignProductToCooler,
  removeProductFromCooler,
  checkCoolerInventoryConsistency,
};
