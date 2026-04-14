const prisma = require('../config/database');
const { buildTransactionCode } = require('../utils/transactionCode');

const MAX_RETRIES = 5;

function isTransactionCodeConflict(error) {
  if (!error || error.code !== 'P2002') {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes('transaction_code');
  }

  if (typeof target === 'string') {
    return target.includes('transaction_code');
  }

  return false;
}

async function generateTransactionCode(tx, startTime) {
  const transactionDate = new Date(startTime);

  if (Number.isNaN(transactionDate.getTime())) {
    throw new Error('Invalid transaction date');
  }

  const dayStart = new Date(transactionDate);
  dayStart.setHours(0, 0, 0, 0);

  const nextDayStart = new Date(dayStart);
  nextDayStart.setDate(nextDayStart.getDate() + 1);

  const count = await tx.transaction.count({
    where: {
      start_time: {
        gte: dayStart,
        lt: nextDayStart,
      },
    },
  });

  return buildTransactionCode(transactionDate, count + 1);
}

async function createTransactionWithCode(data) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const transactionCode = await generateTransactionCode(tx, data.start_time);

        return tx.transaction.create({
          data: {
            ...data,
            transaction_code: transactionCode,
          },
        });
      });
    } catch (error) {
      if (isTransactionCodeConflict(error) && attempt < MAX_RETRIES - 1) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Failed to generate transaction code');
}

module.exports = {
  createTransactionWithCode,
  generateTransactionCode,
};