const sessionService = require('../services/sessionService');

async function startSession(req, res, next) {
  try {
    const { device_id } = req.params;
    const { started_at, session_init_token, transaction_type } = req.body;
    
    if (!started_at) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'started_at is required',
      });
    }
    
    const result = await sessionService.startSession(
      device_id,
      started_at,
      session_init_token,
      transaction_type
    );
    
    res.status(201).json(result);
  } catch (error) {
    if (error.message === 'Active session already exists') {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
    }
    if (error.message === 'Device not active') {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message,
      });
    }
    next(error);
  }
}

async function addInteraction(req, res, next) {
  try {
    const { device_id, transaction_id } = req.params;
    const { events } = req.body;
    
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'events array is required',
      });
    }
    
    // Validate each event has required fields
    for (const event of events) {
      if (!event.event_id || !event.product_id || !event.action_type_id || !event.timestamp) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Each event must have event_id, product_id, action_type_id, and timestamp',
        });
      }
    }
    
    const result = await sessionService.addInteraction(device_id, transaction_id, events);
    
    res.json(result);
  } catch (error) {
    if (error.message === 'Transaction not found' || 
        error.message === 'Transaction device mismatch' ||
        error.message === 'Transaction not active') {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
    }
    next(error);
  }
}

async function getCart(req, res, next) {
  try {
    const { transaction_id } = req.params;
    const result = await sessionService.getCart(transaction_id);
    res.json(result);
  } catch (error) {
    if (error.message === 'Transaction not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }
    next(error);
  }
}

async function endSession(req, res, next) {
  try {
    const { device_id, transaction_id } = req.params;
    const { ended_at, cancelled } = req.body;
    
    if (!ended_at) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ended_at is required',
      });
    }
    
    const result = await sessionService.endSession(device_id, transaction_id, ended_at, cancelled === true);
    res.json(result);
  } catch (error) {
    if (error.message === 'Transaction not found' || 
        error.message === 'Transaction device mismatch' ||
        error.message === 'Transaction not active') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }
    next(error);
  }
}

async function getCurrentSession(req, res, next) {
  try {
    const { device_id } = req.params;
    const sessionInitToken = req.headers['x-session-init-token'];
    
    const result = await sessionService.getCurrentSession(device_id, sessionInitToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function updateCartSnapshot(req, res, next) {
  try {
    const { transaction_id } = req.params;
    const { items, source, detected_at } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'items array is required',
      });
    }

    for (const item of items) {
      const aiLabel = item?.ai_label ?? item?.aiLabel;
      if (!aiLabel || typeof aiLabel !== 'string' || aiLabel.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Each item must include ai_label (or aiLabel)',
        });
      }
    }

    const result = await sessionService.updateCartSnapshot(
      transaction_id,
      items,
      source || 'AI_MODEL',
      detected_at || null
    );

    res.json(result);
  } catch (error) {
    if (error.message === 'Transaction not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }
    if (error.message === 'Transaction not active') {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
    }
    next(error);
  }
}

async function updateCartItemQuantity(req, res, next) {
  try {
    const { transaction_id, product_id } = req.params;
    const { delta } = req.body;

    if (delta === undefined || delta === null) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'delta is required',
      });
    }

    const numericDelta = Math.trunc(Number(delta));
    if (!Number.isFinite(numericDelta) || numericDelta === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'delta must be a non-zero number',
      });
    }

    const result = await sessionService.updateCartItemQuantity(
      transaction_id,
      product_id,
      numericDelta
    );

    res.json(result);
  } catch (error) {
    if (error.message === 'Transaction not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }
    if (error.message === 'Transaction not active') {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
    }
    if (error.message === 'Cart item not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }
    if (error.message === 'Invalid quantity delta') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }
    next(error);
  }
}

module.exports = {
  startSession,
  addInteraction,
  getCart,
  endSession,
  getCurrentSession,
  updateCartSnapshot,
  updateCartItemQuantity,
};

