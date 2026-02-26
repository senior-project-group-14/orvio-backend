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

module.exports = {
  updateAlert,
};
