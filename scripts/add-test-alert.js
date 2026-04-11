const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const requestedDeviceId = process.argv[2] || null;
  const requestedCount = Number.parseInt(process.argv[3] || '1', 10);
  const count = Number.isFinite(requestedCount) && requestedCount > 0 ? requestedCount : 1;

  const device = requestedDeviceId
    ? await prisma.cooler.findUnique({
        where: { device_id: requestedDeviceId },
        select: { device_id: true, name: true },
      })
    : await prisma.cooler.findFirst({
        select: { device_id: true, name: true },
        orderBy: { name: 'asc' },
      });

  if (!device) {
    console.log('NO_DEVICE_FOUND');
    return;
  }

  const created = [];

  for (let i = 0; i < count; i += 1) {
    const alert = await prisma.alert.create({
      data: {
        device_id: device.device_id,
        alert_type: 'TEMPERATURE_DEVIATION',
        message: `Manual test alert ${i + 1}/${count} from Copilot for notification panel.`,
        status_id: 0,
        resolution_note: null,
      },
    });
    created.push(alert);
  }

  console.log(
    JSON.stringify(
      {
        created: created.length,
        device_id: device.device_id,
        device_name: device.name,
        alerts: created.map((alert) => ({
          alert_id: alert.alert_id,
          status_id: alert.status_id,
          timestamp: alert.timestamp,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('ERROR', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
