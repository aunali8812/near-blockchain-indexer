const { PrismaClient } = require('./generated/prisma');

async function checkData() {
  const prisma = new PrismaClient();

  try {
    console.log('=== Database Check ===\n');

    const donationCount = await prisma.donation.count();
    console.log(`Total Donations: ${donationCount}`);

    const accountCount = await prisma.account.count();
    console.log(`Total Accounts: ${accountCount}`);

    const checkpoint = await prisma.indexerCheckpoint.findUnique({
      where: { id: 'singleton' }
    });
    console.log(`\nCheckpoint: Block ${checkpoint?.lastBlockHeight || 'N/A'}`);

    if (donationCount > 0) {
      const latestDonations = await prisma.donation.findMany({
        take: 5,
        orderBy: { donatedAt: 'desc' },
        select: {
          type: true,
          donorId: true,
          recipientId: true,
          amountNear: true,
          donatedAt: true,
          blockHeight: true
        }
      });

      console.log('\nLatest Donations:');
      latestDonations.forEach(d => {
        console.log(`  ${d.type}: ${d.donorId} -> ${d.recipientId || 'N/A'} (${d.amountNear} NEAR) at block ${d.blockHeight}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
