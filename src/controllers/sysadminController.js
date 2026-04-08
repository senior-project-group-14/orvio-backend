const sysadminService = require('../services/sysadminService');
const { USER_ROLE } = require('../config/constants');
const { parsePagination } = require('../utils/pagination');

// Admin management
async function getAllAdmins(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await sysadminService.getAllAdmins({ page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createAdmin(req, res, next) {
  try {
    const { first_name, last_name, email, password, role_id } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'email and password are required',
      });
    }
    
    const admin = await sysadminService.createAdmin({
      first_name,
      last_name,
      email,
      password,
      role_id: role_id || USER_ROLE.ADMIN,
    });
    
    res.status(201).json(admin);
  } catch (error) {
    if (error.message && error.message.includes('Invalid role_id')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid role_id',
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Email already exists',
      });
    }
    next(error);
  }
}

async function updateAdmin(req, res, next) {
  try {
    const { admin_id } = req.params;
    const admin = await sysadminService.updateAdmin(admin_id, req.body);
    res.json(admin);
  } catch (error) {
    if (error.message && error.message.includes('Invalid role_id')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid role_id',
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Admin not found',
      });
    }
    next(error);
  }
}

async function deleteAdmin(req, res, next) {
  try {
    const { admin_id } = req.params;
    const admin = await sysadminService.deleteAdmin(admin_id);
    res.json({
      message: 'Admin deleted',
      user_id: admin.user_id,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Admin not found',
      });
    }
    next(error);
  }
}


async function createDevice(req, res, next) {
  try {
    const device = await sysadminService.createDevice(req.body);
    res.status(201).json(device);
  } catch (error) {
    if (error.message && error.message.includes('Invalid status_id')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid status_id',
      });
    }
    next(error);
  }
}

async function updateDevice(req, res, next) {
  try {
    const { device_id } = req.params;
    const device = await sysadminService.updateDevice(device_id, req.body);
    res.json(device);
  } catch (error) {
    if (error.message && error.message.includes('Invalid status_id')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid status_id',
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }
    next(error);
  }
}

async function deleteDevice(req, res, next) {
  try {
    const { device_id } = req.params;
    const deleted = await sysadminService.deleteDevice(device_id);
    res.json({
      message: 'Device deleted',
      device_id: deleted.device_id,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Device not found',
      });
    }
    next(error);
  }
}

// Assignment management
async function getAllAssignments(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await sysadminService.getAllAssignments({ page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function createAssignment(req, res, next) {
  try {
    const { device_id, admin_user_id } = req.body;
    
    if (!device_id || !admin_user_id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'device_id and admin_user_id are required',
      });
    }
    
    const assignment = await sysadminService.createAssignment({
      device_id,
      admin_user_id,
    });
    
    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
}

async function updateAssignment(req, res, next) {
  try {
    const { assignment_id } = req.params;
    const assignment = await sysadminService.updateAssignment(assignment_id, req.body);
    res.json(assignment);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Assignment not found',
      });
    }
    next(error);
  }
}


async function createBrand(req, res, next) {
  try {
    const { brand_name, description } = req.body;
    
    if (!brand_name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'brand_name is required',
      });
    }
    
    const brand = await sysadminService.createBrand({ brand_name, description });
    res.status(201).json(brand);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Brand name already exists',
      });
    }
    next(error);
  }
}

async function updateBrand(req, res, next) {
  try {
    const { brand_id } = req.params;
    const brand = await sysadminService.updateBrand(brand_id, req.body);
    res.json(brand);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Brand not found',
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Brand name already exists',
      });
    }
    next(error);
  }
}

// Product management
async function createProduct(req, res, next) {
  try {
    const { name, ai_label, brand_id, unit_price, image_reference, is_active } = req.body;
    
    if (!name || !brand_id || unit_price === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name, brand_id, and unit_price are required',
      });
    }
    
    const product = await sysadminService.createProduct({
      name,
      ai_label,
      brand_id,
      unit_price,
      image_reference,
      is_active,
    });
    
    res.status(201).json(product);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Product name already exists',
      });
    }
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { product_id } = req.params;
    const product = await sysadminService.updateProduct(product_id, req.body);
    res.json(product);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Product not found',
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Product name already exists',
      });
    }
    next(error);
  }
}

// System logs
async function getSystemLogs(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const filters = {
      level: req.query.level,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    };
    
    const result = await sysadminService.getSystemLogs(filters, { page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  createDevice,
  updateDevice,
  deleteDevice,
  getAllAssignments,
  createAssignment,
  updateAssignment,
  createBrand,
  updateBrand,
  createProduct,
  updateProduct,
  getSystemLogs,
};

