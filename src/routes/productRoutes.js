const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const adminAuth = require('../middleware/adminAuth');

// All routes require admin authentication
router.use(adminAuth);

/**
 * @swagger
 * /products:
 *   get:
 *     summary: List all products (filtered by role in service layer)
 *     tags: [Products]
 *     security:
 *       - AdminToken: []
 *     responses:
 *       200:
 *         description: List of products
 *         content:
 *           application/json:
 *             example:
 *               products:
 *                 - product_id: "b3e1b2a4-0000-0000-0000-000000000001"
 *                   name: "Coke 330ml"
 *                   brand_id: "brand-0001"
 *                   unit_price: 50.0
 */
router.get('/', productController.getProducts);
router.post('/', productController.createProduct);
router.put('/:product_id', productController.updateProduct);
router.delete('/:product_id', productController.deleteProduct);

module.exports = router;
