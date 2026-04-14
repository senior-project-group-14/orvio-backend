function formatTransactionDate(date) {
  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    throw new Error('Invalid transaction date');
  }

  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = String(value.getFullYear()).slice(-2);

  return `${day}${month}${year}`;
}

function buildTransactionCode(date, sequence) {
  const numericSequence = Number(sequence);

  if (!Number.isInteger(numericSequence) || numericSequence < 1) {
    throw new Error('Invalid transaction sequence');
  }

  return `TR-${formatTransactionDate(date)}-${String(numericSequence).padStart(3, '0')}`;
}

module.exports = {
  buildTransactionCode,
  formatTransactionDate,
};