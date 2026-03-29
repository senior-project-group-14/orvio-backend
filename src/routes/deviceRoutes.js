const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const doorEventController = require('../controllers/doorEventController');
const adminAuth = require('../middleware/adminAuth');
const deviceAccess = require('../middleware/deviceAccess');
const deviceValidation = require('../middleware/deviceValidation');

/**
 * @swagger
 * /devices:
 *   get:
 *     summary: List devices visible to the admin and all devices to system admin
 *     tags: [Devices]
 *     security:
 *       - AdminToken: []
 *     responses:
 *       200:
 *         description: List of devices
 *         content:
 *           application/json:
 *             example:
 *               devices:
 *                 - device_id: "dev-0001"
 *                   name: "Orvio Cooler #1"
 *                   status: "ONLINE"
 *                   location_description: "Test Store"
 */
router.get('/', adminAuth, deviceController.getDevices);

/**
 * @swagger
 * /devices/{device_id}/inventory:
 *   get:
 *     summary: Get inventory for a specific device
 *     tags: [Devices]
 *     security:
 *       - AdminToken: []
 *     parameters:
 *       - in: path
 *         name: device_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the device
 *     responses:
 *       200:
 *         description: Inventory for the device
 *         content:
 *           application/json:
 *             example:
 *               device_id: "dev-0001"
 *               inventory:
 *                 - product_id: "b3e1b2a4-0000-0000-0000-000000000001"
 *                   product_name: "Coke 330ml"
 *                   current_stock: 10
 *                   critic_stock: 2
 */
router.get('/:device_id/inventory', adminAuth, deviceAccess, deviceController.getDeviceInventory);

/**
 * @swagger
 * /devices/{device_id}/transactions:
 *   get:
 *     summary: Get transactions for a specific device
 *     tags: [Devices]
 *     security:
 *       - AdminToken: []
 *     parameters:
 *       - in: path
 *         name: device_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the device
 *     responses:
 *       200:
 *         description: Transactions for the device
 *         content:
 *           application/json:
 *             example:
 *               device_id: "dev-0001"
 *               transactions:
 *                 - transaction_id: "7f2c4d9e-0000-0000-0000-000000000001"
 *                   status: "COMPLETED"
 *                   is_active: false
 */
router.get('/:device_id/transactions', adminAuth, deviceAccess, deviceController.getDeviceTransactions);

/**
 * @swagger
 * /devices/{device_id}/telemetry:
 *   get:
 *     summary: Get recent telemetry for a device
 *     tags: [Devices]
 *     security:
 *       - AdminToken: []
 *     parameters:
 *       - in: path
 *         name: device_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the device
 *     responses:
 *       200:
 *         description: Telemetry records
 *         content:
 *           application/json:
 *             example:
 *               device_id: "dev-0001"
 *               telemetry:
 *                 - telemetry_id: "tele-0001"
 *                   temperature: 4.5
 *                   humidity: 60
 *                   door_status: false
 */
router.get('/:device_id/telemetry', adminAuth, deviceAccess, deviceController.getDeviceTelemetry);

/**
 * @swagger
 * /devices/{device_id}/alerts:
 *   get:
 *     summary: Get alerts for a device
 *     tags: [Devices]
 *     security:
 *       - AdminToken: []
 *     parameters:
 *       - in: path
 *         name: device_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the device
 *     responses:
 *       200:
 *         description: Alerts for the device
 *         content:
 *           application/json:
 *             example:
 *               device_id: "dev-0001"
 *               alerts:
 *                 - alert_id: "alert-0001"
 *                   type: "temperature_high"
 *                   status: "OPEN"
 */
router.get('/:device_id/alerts', adminAuth, deviceAccess, deviceController.getDeviceAlerts);

/**
 * @swagger
 * /devices/{device_id}/door-event:
 *   post:
 *     summary: Log a door open or close event
 *     tags: [Devices]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: device_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the device
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             eventType: "OPEN"
 *             sessionId: null
 *     responses:
 *       200:
 *         description: Door event logged successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Door OPEN event processed"
 *               data:
 *                 transaction_id: "7f2c4d9e-0000-0000-0000-000000000001"
 *                 status: "session_created"
 *                 message: "New session created on door open"
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Device not found
 */
router.post('/:device_id/door-event', deviceValidation, doorEventController.handleDoorEvent);

module.exports = router;
