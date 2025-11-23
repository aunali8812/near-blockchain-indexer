const { PrismaClient } = require('./generated/prisma');

async function resetCheckpoint() {
  const prisma = new PrismaClient();

  try {
    console.log('Deleting indexer checkpoint...');
    const result = await prisma.indexerCheckpoint.deleteMany({});
    console.log(`Deleted ${result.count} checkpoint(s)`);
    console.log('Checkpoint has been reset!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetCheckpoint();
