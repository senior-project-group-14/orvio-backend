const express = require('express');
const QRCode = require('qrcode');

const router = express.Router();

router.get('/:device_id', async (req, res) => {
  try {
    const { device_id } = req.params;

    const targetUrl = new URL(`http://your_IPv4/cooler/${encodeURIComponent(device_id)}`);

    const pngBuffer = await QRCode.toBuffer(targetUrl.toString(), {
      type: 'png',
    });

    res.setHeader('Content-Type', 'image/png');
    return res.send(pngBuffer);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

module.exports = router;
