const { PrismaClient } = require('@prisma/client');

const shouldLogQueries = process.env.PRISMA_LOG_QUERIES === 'true';

const prisma = new PrismaClient({
  log: shouldLogQueries
    ? ['query', 'error', 'warn']
    : process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
});

module.exports = prisma;

