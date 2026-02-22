const prisma = require('../config/database');
const { hashPassword } = require('../utils/bcrypt');
const { v4: uuidv4 } = require('uuid');
const { USER_ROLE, DEVICE_STATUS } = require('../config/constants');

function assertValidLookupId(value, lookup, fieldName) {
  const allowedIds = Object.values(lookup);

  if (!Number.isInteger(value) || !allowedIds.includes(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return value;
}

async function getAllAdmins() {
  return prisma.user.findMany({
    where: {
      role_id: { in: [USER_ROLE.ADMIN, USER_ROLE.SYSTEM_ADMIN] },
    },
    orderBy: { email: 'asc' },
  });
}

async function createAdmin(adminData) {
  const passwordHash = await hashPassword(adminData.password);
  const roleId =
    adminData.role_id !== undefined
      ? assertValidLookupId(adminData.role_id, USER_ROLE, 'role_id')
      : USER_ROLE.ADMIN;
  
  return prisma.user.create({
    data: {
      user_id: uuidv4(),
      first_name: adminData.first_name,
      last_name: adminData.last_name,
      email: adminData.email,
      password_hash: passwordHash,
      role_id: roleId,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
}

async function updateAdmin(adminId, adminData) {
  const updateData = {
    updated_at: new Date(),
  };
  
  if (adminData.first_name !== undefined) updateData.first_name = adminData.first_name;
  if (adminData.last_name !== undefined) updateData.last_name = adminData.last_name;
  if (adminData.email !== undefined) updateData.email = adminData.email;
  if (adminData.role_id !== undefined) {
    updateData.role_id = assertValidLookupId(adminData.role_id, USER_ROLE, 'role_id');
  }
  if (adminData.active !== undefined) updateData.active = adminData.active;
  
  if (adminData.password) {
    updateData.password_hash = await hashPassword(adminData.password);
  }
  
  return prisma.user.update({
    where: { user_id: adminId },
    data: updateData,
  });
}

async function deleteAdmin(adminId) {
  return prisma.$transaction(async (tx) => {
    await tx.deviceAssignment.deleteMany({
      where: { admin_user_id: adminId },
    });

    await tx.cooler.updateMany({
      where: { assigned_admin_id: adminId },
      data: { assigned_admin_id: null },
    });

    await tx.transaction.updateMany({
      where: { user_id: adminId },
      data: { user_id: null },
    });

    return tx.user.delete({
      where: { user_id: adminId },
    });
  });
}


async function createDevice(deviceData) {
  const statusId =
    deviceData.status_id !== undefined
      ? assertValidLookupId(deviceData.status_id, DEVICE_STATUS, 'status_id')
      : DEVICE_STATUS.ACTIVE;

  return prisma.cooler.create({
    data: {
      device_id: uuidv4(),
      name: deviceData.name,
      location_description: deviceData.location_description,
      gps_latitude: deviceData.gps_latitude,
      gps_longitude: deviceData.gps_longitude,
      default_temperature: deviceData.default_temperature,
      status_id: statusId,
      last_checkin_time: new Date(),
      assigned_admin_id: deviceData.assigned_admin_id,
      door_status: false,
      shelf_count: deviceData.shelf_count || 1,
      session_limit: deviceData.session_limit || 1,
    },
  });
}

async function updateDevice(deviceId, deviceData) {
  const updateData = {};
  
  if (deviceData.name !== undefined) updateData.name = deviceData.name;
  if (deviceData.location_description !== undefined) updateData.location_description = deviceData.location_description;
  if (deviceData.gps_latitude !== undefined) updateData.gps_latitude = deviceData.gps_latitude;
  if (deviceData.gps_longitude !== undefined) updateData.gps_longitude = deviceData.gps_longitude;
  if (deviceData.default_temperature !== undefined) updateData.default_temperature = deviceData.default_temperature;
  if (deviceData.status_id !== undefined) {
    updateData.status_id = assertValidLookupId(deviceData.status_id, DEVICE_STATUS, 'status_id');
  }
  if (deviceData.assigned_admin_id !== undefined) updateData.assigned_admin_id = deviceData.assigned_admin_id;
  if (deviceData.shelf_count !== undefined) updateData.shelf_count = deviceData.shelf_count;
  if (deviceData.session_limit !== undefined) updateData.session_limit = deviceData.session_limit;
  
  return prisma.cooler.update({
    where: { device_id: deviceId },
    data: updateData,
  });
}

async function getAllAssignments() {
  return prisma.deviceAssignment.findMany({
    include: {
      device: true,
      admin: true,
    },
    orderBy: { assigned_at: 'desc' },
  });
}

async function createAssignment(assignmentData) {
  // Deactivate existing assignments for this device/admin
  await prisma.deviceAssignment.updateMany({
    where: {
      device_id: assignmentData.device_id,
      admin_user_id: assignmentData.admin_user_id,
      is_active: true,
    },
    data: {
      is_active: false,
      unassigned_at: new Date(),
    },
  });
  
  return prisma.deviceAssignment.create({
    data: {
      assignment_id: uuidv4(),
      device_id: assignmentData.device_id,
      admin_user_id: assignmentData.admin_user_id,
      assigned_at: new Date(),
      is_active: true,
    },
  });
}

async function updateAssignment(assignmentId, assignmentData) {
  const updateData = {};
  
  if (assignmentData.is_active !== undefined) {
    updateData.is_active = assignmentData.is_active;
    if (!assignmentData.is_active) {
      updateData.unassigned_at = new Date();
    }
  }
  
  return prisma.deviceAssignment.update({
    where: { assignment_id: assignmentId },
    data: updateData,
  });
}

// sysadminService.js
async function getAllBrands(adminUserId, isSystemAdmin) {
  if (isSystemAdmin) {
    // System Admin her şeyi görür
    return prisma.brand.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { brand_name: 'asc' },
    });
  }

  // Normal Admin: Sadece kendine atanmış cihazlardaki ürünlerin markalarını görür
  return prisma.brand.findMany({
    where: {
      products: {
        some: {
          inventories: {
            some: {
              device: {
                deviceAssignments: {
                  some: {
                    admin_user_id: adminUserId,
                    is_active: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { brand_name: 'asc' },
  });
}

async function createBrand(brandData) {
  return prisma.brand.create({
    data: {
      brand_id: uuidv4(),
      brand_name: brandData.brand_name,
      description: brandData.description,
    },
  });
}

async function updateBrand(brandId, brandData) {
  const updateData = {};
  
  if (brandData.brand_name !== undefined) updateData.brand_name = brandData.brand_name;
  if (brandData.description !== undefined) updateData.description = brandData.description;
  
  return prisma.brand.update({
    where: { brand_id: brandId },
    data: updateData,
  });
}

async function createProduct(productData) {
  return prisma.product.create({
    data: {
      product_id: uuidv4(),
      name: productData.name,
      brand_id: productData.brand_id,
      unit_price: productData.unit_price,
      image_reference: productData.image_reference,
      is_active: productData.is_active !== undefined ? productData.is_active : true,
    },
  });
}

async function updateProduct(productId, productData) {
  const updateData = {};
  
  if (productData.name !== undefined) updateData.name = productData.name;
  if (productData.brand_id !== undefined) updateData.brand_id = productData.brand_id;
  if (productData.unit_price !== undefined) updateData.unit_price = productData.unit_price;
  if (productData.image_reference !== undefined) updateData.image_reference = productData.image_reference;
  if (productData.is_active !== undefined) updateData.is_active = productData.is_active;
  
  return prisma.product.update({
    where: { product_id: productId },
    data: updateData,
  });
}

async function getSystemLogs(filters = {}) {
  const where = {};
  
  if (filters.level) where.level = filters.level;
  if (filters.startDate) where.log_date = { gte: new Date(filters.startDate) };
  if (filters.endDate) {
    where.log_date = {
      ...where.log_date,
      lte: new Date(filters.endDate),
    };
  }
  
  return prisma.systemLog.findMany({
    where,
    orderBy: { log_date: 'desc' },
    take: filters.limit || 1000,
  });
}

module.exports = {
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  createDevice,
  updateDevice,
  getAllAssignments,
  createAssignment,
  updateAssignment,
  getAllBrands,
  createBrand,
  updateBrand,
  createProduct,
  updateProduct,
  getSystemLogs,
};

