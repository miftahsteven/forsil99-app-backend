import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('🧹 Cleaning all In Memoriam data (flowers, prayers, deceased alumni)...');

  const deletedFlowers = await prisma.memorialFlower.deleteMany({});
  console.log(`Deleted ${deletedFlowers.count} memorial flowers.`);

  const deletedPrayers = await prisma.memorialPrayer.deleteMany({});
  console.log(`Deleted ${deletedPrayers.count} memorial prayers.`);

  const deletedDeceased = await prisma.deceasedAlumni.deleteMany({});
  console.log(`Deleted ${deletedDeceased.count} deceased alumni records.`);

  console.log('✅ All In Memoriam data has been successfully cleaned!');
}

main()
  .catch((e) => {
    console.error('Error cleaning memorial data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
