const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Seed script for lookup tables with FIXED integer IDs
 * 
 * These IDs are STABLE and should NEVER be changed.
 * Application code can rely on these IDs for direct comparisons.
 */

async function seedLookupTables() {
  console.log('🌱 Starting lookup table seeding...\n');

  try {
    // ========================================
    // USER ROLE LOOKUP
    // ========================================
    console.log('📝 Seeding UserRoleLookup...');
    const userRoles = [
      { id: 0, name: 'ADMIN' },
      { id: 1, name: 'SYSTEM_ADMIN' },
    ];

    for (const role of userRoles) {
      await prisma.userRoleLookup.upsert({
        where: { id: role.id },
        update: { name: role.name },
        create: role,
      });
    }
    console.log(`✅ Inserted ${userRoles.length} user roles\n`);

    // ========================================
    // DEVICE STATUS LOOKUP
    // ========================================
    console.log('📝 Seeding DeviceStatusLookup...');
    const deviceStatuses = [
      { id: 0, name: 'ACTIVE' },
      { id: 1, name: 'INACTIVE' },
      { id: 2, name: 'OFFLINE' },
    ];

    for (const status of deviceStatuses) {
      await prisma.deviceStatusLookup.upsert({
        where: { id: status.id },
        update: { name: status.name },
        create: status,
      });
    }
    console.log(`✅ Inserted ${deviceStatuses.length} device statuses\n`);

    // ========================================
    // ALERT STATUS LOOKUP
    // ========================================
    console.log('📝 Seeding AlertStatusLookup...');
    const alertStatuses = [
      { id: 0, name: 'OPEN' },
      { id: 1, name: 'RESOLVED' },
      { id: 2, name: 'ACKNOWLEDGED' },
      { id: 3, name: 'READ' },
    ];

    for (const status of alertStatuses) {
      await prisma.alertStatusLookup.upsert({
        where: { id: status.id },
        update: { name: status.name },
        create: status,
      });
    }
    console.log(`✅ Inserted ${alertStatuses.length} alert statuses\n`);

    // ========================================
    // TRANSACTION STATUS LOOKUP
    // ========================================
    console.log('📝 Seeding TransactionStatusLookup...');
    const transactionStatuses = [
      { id: 0, name: 'ACTIVE' },
      { id: 1, name: 'AWAITING_USER_CONFIRMATION' },
      { id: 2, name: 'COMPLETED' },
      { id: 3, name: 'DISPUTED' },
      { id: 4, name: 'CANCELLED' },
      { id: 5, name: 'FAILED' },
    ];

    for (const status of transactionStatuses) {
      await prisma.transactionStatusLookup.upsert({
        where: { id: status.id },
        update: { name: status.name },
        create: status,
      });
    }
    console.log(`✅ Inserted ${transactionStatuses.length} transaction statuses\n`);

    // ========================================
    // ACTION TYPE LOOKUP
    // ========================================
    console.log('📝 Seeding ActionTypeLookup...');
    const actionTypes = [
      { id: 0, name: 'ADD' },
      { id: 1, name: 'REMOVE' },
    ];

    for (const action of actionTypes) {
      await prisma.actionTypeLookup.upsert({
        where: { id: action.id },
        update: { name: action.name },
        create: action,
      });
    }
    console.log(`✅ Inserted ${actionTypes.length} action types\n`);

    // ========================================
    // ACCESS REASON LOOKUP
    // ========================================
    console.log('📝 Seeding AccessReasonLookup...');
    const accessReasons = [
      { id: 0, name: 'OK' },
      { id: 1, name: 'DEVICE_OFFLINE' },
      { id: 2, name: 'DEVICE_INACTIVE' },
      { id: 3, name: 'SESSION_LIMIT_REACHED' },
      { id: 4, name: 'DOOR_ALREADY_OPEN' },
      { id: 5, name: 'ACTIVE_SESSION_EXISTS' },
    ];

    for (const reason of accessReasons) {
      await prisma.accessReasonLookup.upsert({
        where: { id: reason.id },
        update: { name: reason.name },
        create: reason,
      });
    }
    console.log(`✅ Inserted ${accessReasons.length} access reasons\n`);

    // ========================================
    // DISPUTE REASON LOOKUP
    // ========================================
    console.log('📝 Seeding DisputeReasonLookup...');
    const disputeReasons = [
      { id: 0, name: 'WRONG_ITEM' },
      { id: 1, name: 'MISSING_ITEM' },
      { id: 2, name: 'OTHER' },
    ];

    for (const reason of disputeReasons) {
      await prisma.disputeReasonLookup.upsert({
        where: { id: reason.id },
        update: { name: reason.name },
        create: reason,
      });
    }
    console.log(`✅ Inserted ${disputeReasons.length} dispute reasons\n`);

    console.log('✅ All lookup tables seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding lookup tables:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedLookupTables();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { seedLookupTables };
