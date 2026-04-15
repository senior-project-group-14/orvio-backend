const express = require('express');
const os = require('os');
const QRCode = require('qrcode');

const router = express.Router();

function getLanIPv4() {
  const interfaces = os.networkInterfaces();

  for (const iface of Object.values(interfaces)) {
    for (const address of iface || []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }

  return null;
}

router.get('/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;

    // Prefer explicit env config; otherwise derive host from request or LAN IP.
    const configuredBaseUrl = (process.env.QR_FRONTEND_BASE_URL || '').trim();
    const frontendPort = (process.env.QR_FRONTEND_PORT || '5174').trim();
    const forwardedHost = (req.get('x-forwarded-host') || '').split(',')[0].trim();
    const rawHost = forwardedHost || req.hostname || 'localhost';
    const normalizedHost = rawHost === '::1' ? 'localhost' : rawHost;
    const localHosts = new Set(['localhost', '127.0.0.1']);
    const requestHost = localHosts.has(normalizedHost) ? (getLanIPv4() || normalizedHost) : normalizedHost;
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
