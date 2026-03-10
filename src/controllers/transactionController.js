const transactionService = require('../services/transactionService');
const { checkIdempotency, markAsProcessed } = require('../middleware/idempotency');
const CONSTANTS = require('../config/constants');
const prisma = require('../config/database');

async function getTransactionSummary(req, res, next) {
  try {
    const { transaction_id } = req.params;
    const result = await transactionService.getTransactionSummary(transaction_id);
    res.json(result);
  } catch (error) {
    if (error.message === 'Transaction not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }
    if (error.message === 'Transaction not awaiting confirmation') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }
    next(error);
  }
}

async function confirmTransaction(req, res, next) {
  try {
    const { transaction_id } = req.params;
    
    // Kullanıcının confirmed_at göndermesine gerek yok, sunucu zamanını kullanıyoruz.
    const confirmed_at = new Date(); 
    
    // Idempotency kontrolü - transaction_id'yi event_id olarak kullanıyoruz
    const isDuplicate = await checkIdempotency(transaction_id, 'confirm');
    
    if (isDuplicate) {
      // Eğer bu işlem zaten yapılmışsa veritabanından güncel durumu kontrol et
      const transaction = await prisma.transaction.findUnique({
        where: { transaction_id },
      });
      
      // İşlem zaten tamamlanmışsa mükerrer işlem yapma, mevcut sonucu dön
      if (transaction && transaction.status_id === CONSTANTS.TRANSACTION_STATUS.COMPLETED) {
        return res.json({
          transaction_id,
          status_id: CONSTANTS.TRANSACTION_STATUS.COMPLETED,
          inventory_updated: false,
          alerts_created: 0,
          message: 'Transaction already confirmed',
        });
      }
    }
    
    // Servis katmanına otomatik oluşturduğumuz zaman damgasını gönderiyoruz
    const result = await transactionService.confirmTransaction(transaction_id, confirmed_at);
    
    // İşlemi başarıyla tamamlandı olarak işaretle
    await markAsProcessed(transaction_id, 'confirm');
    
    res.json(result);
  } catch (error) {
    // Hata yönetimi
    if (error.message === 'Transaction not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }
    if (error.message === 'Transaction not awaiting confirmation') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }
    if (error.message === 'Session cart not found') {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
    }
    next(error);
  }
}

async function disputeTransaction(req, res, next) {
  try {
    const { transaction_id } = req.params;
    
    // reason gelmezse varsayılan olarak 'OTHER' kabul ediyoruz, message opsiyonel
    const { reason = 'OTHER', message = '' } = req.body;
    
    // reported_at değerini kullanıcıdan beklemek yerine sunucu zamanını otomatik atıyoruz
    const reported_at = new Date(); 
    
    // Geçerli nedenlerin kontrolü
    const validReasons = ['WRONG_ITEM', 'MISSING_ITEM', 'OTHER'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `reason must be one of: ${validReasons.join(', ')}`,
      });
    }
    
    const result = await transactionService.disputeTransaction(
      transaction_id,
      reason,
      message,
      reported_at
    );
    
    res.json(result);
  } catch (error) {
    if (error.message === 'Transaction not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }
    // İşlem zaten onaylanmışsa veya itiraz aşamasında değilse bu hata döner
    if (error.message === 'Transaction not awaiting confirmation') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }
    next(error);
  }
}

async function applyInventoryManually(req, res, next) {
  try {
    const { transaction_id } = req.params;
    const result = await transactionService.applyInventoryManually(transaction_id);
    res.json(result);
  } catch (error) {
    if (error.message === 'Transaction not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
    }
    if (error.message === 'Transaction cannot have inventory applied') {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }
    next(error);
  }
}

async function getTransaction(req, res, next) {
  try {
    const { transaction_id } = req.params;
    const transaction = await transactionService.getTransactionDetails(
      transaction_id,
      req.adminUser.user_id,
      req.isSystemAdmin
    );
    
    if (!transaction) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Transaction not found',
      });
    }
    
    res.json(transaction);
  } catch (error) {
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
  getTransactionSummary,
  confirmTransaction,
  disputeTransaction,
  applyInventoryManually,
  getTransaction,
};

