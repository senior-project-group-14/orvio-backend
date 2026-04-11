const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const adminAuth = require('../middleware/adminAuth');

// All routes require admin authentication
router.use(adminAuth);

router.get('/reads', alertController.getAlertReads);
router.post('/:alert_id/read', alertController.markAlertRead);

/**
 * @swagger
 * /alerts/{alert_id}:
 *   patch:
 *     summary: Update an alert (role-based access in service layer)
 *     tags: [Alerts]
 *     security:
 *       - AdminToken: []
 *     parameters:
 *       - in: path
 *         name: alert_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the alert
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             status_id: 1
 *             message: "Checked device, temperature back to normal."
 *     responses:
 *       200:
 *         description: Updated alert
 *         content:
 *           application/json:
 *             example:
 *               alert_id: "alert-0001"
 *               status_id: 1
 *               message: "Checked device, temperature back to normal."
 */
router.patch('/:alert_id', alertController.updateAlert);

module.exports = router;
