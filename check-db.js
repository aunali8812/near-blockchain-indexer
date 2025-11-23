const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function main() {
  const donationCount = await prisma.donation.count();
  const accountCount = await prisma.account.count();
  const checkpoint = await prisma.indexerCheckpoint.findUnique({
    where: { id: 'singleton' }
  });

  console.log('Database Status:');
  console.log('Donations:', donationCount);
  console.log('Accounts:', accountCount);
  console.log('Checkpoint:', checkpoint ? checkpoint.lastBlockHeight.toString() : 'None');

  if (donationCount > 0) {
    const recentDonations = await prisma.donation.findMany({
      take: 5,
      orderBy: { donatedAt: 'desc' }
    });
    console.log('\nRecent donations:', recentDonations);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
