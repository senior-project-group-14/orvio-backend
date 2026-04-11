const alertService = require('../services/alertService');

async function updateAlert(req, res, next) {
  try {
    const { alert_id } = req.params;
    const { status_id, message, resolution_note } = req.body;
    
    const parsedStatusId = status_id !== undefined ? parseInt(status_id, 10) : undefined;

    const alert = await alertService.updateAlert(
      alert_id, 
      parsedStatusId, 
      message,
      resolution_note,
      req.adminUser.user_id,
      req.isSystemAdmin
    );
    res.json(alert);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Alert not found',
      });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }
    next(error);
  }
}

async function markAlertRead(req, res, next) {
  try {
    const { alert_id } = req.params;
    const result = await alertService.markAlertRead(
      alert_id,
      req.adminUser.user_id,
      req.isSystemAdmin
    );
    res.status(200).json({
      alert_id: result.alert_id,
      admin_user_id: result.admin_user_id,
      read_at: result.read_at,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Alert not found',
      });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }
    next(error);
  }
}

async function getAlertReads(req, res, next) {
  try {
    const raw = typeof req.query.alert_ids === 'string' ? req.query.alert_ids : '';
    const alertIds = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const reads = await alertService.getAdminAlertReads(req.adminUser.user_id, alertIds);
    res.json({ data: reads });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  updateAlert,
  markAlertRead,
  getAlertReads,
};
