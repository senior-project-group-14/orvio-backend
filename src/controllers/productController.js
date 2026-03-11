const productService = require('../services/productService');
const { parsePagination } = require('../utils/pagination');

async function getProducts(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const result = await productService.getAllProducts(
      req.adminUser.user_id,
      req.isSystemAdmin,
      { page, limit }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

function ensureSystemAdmin(req, res) {
  if (!req.isSystemAdmin) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'System admin access required',
    });
    return false;
  }

  return true;
}

async function createProduct(req, res, next) {
  try {
    if (!ensureSystemAdmin(req, res)) return;

    const { name, ai_label, brand_id, unit_price, image_reference, is_active } = req.body;

    if (!name || !brand_id || unit_price === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name, brand_id, and unit_price are required',
      });
    }

    const product = await productService.createProduct({
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
    if (!ensureSystemAdmin(req, res)) return;

    const { product_id } = req.params;
    const product = await productService.updateProduct(product_id, req.body);
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

async function deleteProduct(req, res, next) {
  try {
    if (!ensureSystemAdmin(req, res)) return;

    const { product_id } = req.params;
    const product = await productService.deleteProduct(product_id);
    res.json({ message: 'Product deleted', product_id: product.product_id });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Product not found',
      });
    }
    if (error.code === 'P2003') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Product is referenced by inventory, cooler assignments, or transactions',
      });
    }
    next(error);
  }
}

module.exports = {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
