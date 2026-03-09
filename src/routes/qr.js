const express = require('express');
const QRCode = require('qrcode');

const router = express.Router();

router.get('/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;

    // Prefer explicit env config; otherwise derive host from incoming request.
    const configuredBaseUrl = (process.env.QR_FRONTEND_BASE_URL || '').trim();
    const frontendPort = (process.env.QR_FRONTEND_PORT || '5174').trim();
    const requestHost = req.hostname === '::1' ? 'localhost' : req.hostname;
    const fallbackBaseUrl = `http://${requestHost}:${frontendPort}`;
    const baseUrl = (configuredBaseUrl || fallbackBaseUrl).replace(/\/+$/, '');

    const targetUrl = new URL(`${baseUrl}/cooler/${encodeURIComponent(device_id)}`);

    const pngBuffer = await QRCode.toBuffer(targetUrl.toString(), {
      type: 'png',
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-QR-Target-Url', targetUrl.toString());
    return res.send(pngBuffer);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

module.exports = router;
