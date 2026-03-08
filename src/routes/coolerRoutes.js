const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const adminAuth = require('../middleware/adminAuth');
const deviceAccess = require('../middleware/deviceAccess');

router.get('/:id/products', adminAuth, deviceAccess, deviceController.getCoolerProducts);
router.post('/:id/products', adminAuth, deviceAccess, deviceController.assignProductToCooler);
router.delete('/:id/products/:product_id', adminAuth, deviceAccess, deviceController.removeProductFromCooler);
router.get('/:id/inventory-check', adminAuth, deviceAccess, deviceController.checkCoolerInventory);

module.exports = router;
