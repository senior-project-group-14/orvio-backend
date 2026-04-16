const deviceService = require('../services/deviceService');
const { parsePagination } = require('../utils/pagination');

async function getDevices(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await deviceService.getAdminDevices(
      req.adminUser.user_id, 
      req.isSystemAdmin,
      { page, limit }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getDashboardSummary(req, res, next) {
  try {
    const result = await deviceService.getDashboardSummary(req.adminUser.user_id, req.isSystemAdmin);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getDeviceInventory(req, res, next) {
  try {
    const { device_id } = req.params;
    const { page, limit } = parsePagination(req.query);
    const result = await deviceService.getDeviceInventory(device_id, { page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getDeviceTransactions(req, res, next) {
  try {
    const { device_id } = req.params;
    const { page, limit } = parsePagination(req.query);
    const result = await deviceService.getDeviceTransactions(device_id, { page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getDeviceTelemetry(req, res, next) {
  try {
    const { device_id } = req.params;
    const { page, limit } = parsePagination(req.query);
    const result = await deviceService.getDeviceTelemetry(device_id, { page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getDeviceTemperatureHistory(req, res, next) {
  try {
    const { device_id } = req.params;
    const { page, limit } = parsePagination(req.query);
    const result = await deviceService.getDeviceTemperatureHistory(device_id, { page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getDeviceAlerts(req, res, next) {
  try {
    const { device_id } = req.params;
    const { page, limit } = parsePagination(req.query);
    const status_id = req.query.status_id ? parseInt(req.query.status_id) : null;
    const result = await deviceService.getDeviceAlerts(device_id, status_id, { page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function getCoolerProducts(req, res, next) {
  try {
    const coolerId = req.params.id;
    const { page, limit } = parsePagination(req.query);
    const result = await deviceService.getCoolerProducts(coolerId, { page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function assignProductToCooler(req, res, next) {
  try {
    const coolerId = req.params.id;
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'product_id is required',
      });
    }

    const assignment = await deviceService.assignProductToCooler(coolerId, product_id);
    res.status(201).json(assignment);
  } catch (error) {
    if (error.code === 'P2003' || error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Cooler or product not found',
      });
    }
    next(error);
  }
}

async function removeProductFromCooler(req, res, next) {
  try {
    const coolerId = req.params.id;
    const { product_id } = req.params;
    await deviceService.removeProductFromCooler(coolerId, product_id);
    res.json({ message: 'Product removed from cooler', device_id: coolerId, product_id });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Cooler-product assignment not found',
      });
    }
    next(error);
  }
}

async function checkCoolerInventory(req, res, next) {
  try {
    const coolerId = req.params.id;
    const result = await deviceService.checkCoolerInventoryConsistency(coolerId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function updateInventoryQuantity(req, res, next) {
  try {
    const { device_id, product_id } = req.params;
    const { quantity } = req.body;

    // Validate input
    if (quantity === undefined || quantity === null) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'quantity is required',
      });
    }

    if (typeof quantity !== 'number' || quantity < 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'quantity must be a non-negative integer',
      });
    }

    const result = await deviceService.updateInventoryQuantity(device_id, product_id, quantity);
    res.json(result);
  } catch (error) {
    if (error.code === 'P2025' || error.message?.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message || 'Inventory not found',
      });
    }
    if (error.message && error.message.includes('Invalid')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }
    next(error);
  }
}

async function addInventoryToDevice(req, res, next) {
  try {
    const { device_id } = req.params;
    const { product_id, quantity } = req.body;

    // Validate input
    if (!product_id || quantity === undefined || quantity === null) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'product_id and quantity are required',
      });
    }

    if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'quantity must be a positive integer',
      });
    }

    const result = await deviceService.addToInventory(device_id, product_id, quantity);
    res.status(201).json(result);
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device or product not found',
      });
    }
    if (error.message && error.message.includes('Invalid')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }
    next(error);
  }
}

module.exports = {
  getDevices,
  getDashboardSummary,
  getDeviceInventory,
  getDeviceTransactions,
  getDeviceTelemetry,
  getDeviceTemperatureHistory,
  getDeviceAlerts,
  getCoolerProducts,
  assignProductToCooler,
  removeProductFromCooler,
  checkCoolerInventory,
  updateInventoryQuantity,
  addInventoryToDevice,
};
