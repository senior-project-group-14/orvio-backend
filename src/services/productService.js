const prisma = require('../config/database');
const { paginate } = require('../utils/pagination');
const { v4: uuidv4 } = require('uuid');

async function getAllProducts(adminUserId, isSystemAdmin, { page, limit }) {
  const where = isSystemAdmin
    ? {}
    : {
        OR: [
          {
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
          {
            coolerProducts: {
              some: {
                is_active: true,
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
        ],
      };

  return paginate(
    prisma.product,
    {
      where,
      include: { brand: true },
      orderBy: { name: 'asc' },
    },
    { page, limit },
  );
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
    include: { brand: true },
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
    include: { brand: true },
  });
}

async function deleteProduct(productId) {
  return prisma.product.delete({
    where: { product_id: productId },
  });
}

module.exports = {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
