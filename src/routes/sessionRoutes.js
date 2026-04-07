const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const deviceAuth = require('../middleware/deviceAuth');
const deviceValidation = require('../middleware/deviceValidation');
const { idempotencyMiddleware } = require('../middleware/idempotency');


/**
 * @swagger
 * /devices/{device_id}/sessions/start:
 *   post:
 *     summary: Start a new session
 *     tags: [Sessions]
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
 *             user_id: "11111111-1111-1111-1111-111111111111"
 *     responses:
 *       200:
 *         description: Session started
 *         content:
 *           application/json:
 *             example:
 *               session_id: "sess456"
 *               device_id: "dev789"
 *               status: "active"
 */
router.post('/devices/:device_id/sessions/start', deviceValidation, sessionController.startSession);


/**
 * @swagger
 * /devices/{device_id}/sessions/{transaction_id}/interactions:
 *   post:
 *     summary: Add interaction to session
 *     tags: [Sessions]
 *     security:
 *       - DeviceToken: []
 *     parameters:
 *       - in: path
 *         name: device_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the device
 *       - in: path
 *         name: transaction_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the transaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             product_id: "b3e1b2a4-0000-0000-0000-000000000001"
 *             quantity: 1
 *     responses:
 *       200:
 *         description: Interaction added
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Interaction added."
 */
router.post(
  '/devices/:device_id/sessions/:transaction_id/interactions',
  deviceAuth,
  idempotencyMiddleware('transaction_item'),
  sessionController.addInteraction
);

router.post(
  '/devices/:device_id/sessions/:transaction_id/heartbeat',
  deviceAuth,
  sessionController.heartbeat
);


/**
 * @swagger
 * /sessions/{transaction_id}/cart:
 *   get:
 *     summary: Get cart for a session
 *     tags: [Sessions]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: transaction_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the transaction
 *     responses:
 *       200:
 *         description: Cart details
 *         content:
 *           application/json:
 *             example:
 *               transaction_id: "7f2c4d9e-0000-0000-0000-000000000001"
 *               items:
 *                 - product_id: "b3e1b2a4-0000-0000-0000-000000000001"
 *                   name: "Coke 330ml"
 *                   quantity: 2
 *                   unit_price: 50.0
 */
router.get('/sessions/:transaction_id/cart', sessionController.getCart);

/**
 * @swagger
 * /sessions/{transaction_id}/cart:
 *   put:
 *     summary: Replace session cart snapshot (AI integration)
 *     tags: [Sessions]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: transaction_id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             source: "AI_MODEL"
 *             detected_at: "2026-03-10T12:00:00.000Z"
 *             items:
 *               - ai_label: "coke_330ml"
 *                 quantity: 2
 *     responses:
 *       200:
 *         description: Updated session cart
 */
router.put('/sessions/:transaction_id/cart', sessionController.updateCartSnapshot);

router.patch(
  '/sessions/:transaction_id/cart/items/:product_id',
  sessionController.updateCartItemQuantity
);


/**
 * @swagger
 * /devices/{device_id}/sessions/current:
 *   get:
 *     summary: Get current session for a device
 *     tags: [Sessions]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: device_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the device
 *     responses:
 *       200:
 *         description: Current session details
 *         content:
 *           application/json:
 *             example:
 *               session_id: "sess456"
 *               device_id: "dev789"
 *               status: "active"
 */
router.get('/devices/:device_id/sessions/current', sessionController.getCurrentSession);


/**
 * @swagger
 * /devices/{device_id}/sessions/{transaction_id}/end:
 *   post:
 *     summary: End a session
 *     tags: [Sessions]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: device_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the device
 *       - in: path
 *         name: transaction_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the transaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             user_id: "11111111-1111-1111-1111-111111111111"
 *     responses:
 *       200:
 *         description: Session ended
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Session ended."
 */
router.post('/devices/:device_id/sessions/:transaction_id/end', deviceValidation, sessionController.endSession);

module.exports = router;

