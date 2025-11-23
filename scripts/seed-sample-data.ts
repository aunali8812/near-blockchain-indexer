import { PrismaClient, Prisma } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with sample Potlock donation data...\n');

  // Create sample accounts
  const accounts = [
    'alice.near',
    'bob.near',
    'charity.near',
    'donor1.near',
    'project1.near',
    'referrer.near',
  ];

  console.log('Creating sample accounts...');
  for (const accountId of accounts) {
    await prisma.account.upsert({
      where: { id: accountId },
      create: { id: accountId },
      update: {},
    });
  }

  // Create sample pot
  console.log('Creating sample pot...');
  await prisma.pot.upsert({
    where: { id: 'climate.v1.potfactory.potlock.near' },
    create: { id: 'climate.v1.potfactory.potlock.near' },
    update: {},
  });

  // Create sample campaign
  console.log('Creating sample campaign...');
  await prisma.campaign.upsert({
    where: { id: 'save-trees.campaign.near' },
    create: { id: 'save-trees.campaign.near' },
    update: {},
  });

  // Sample donations
  const donations = [
    // Direct donation 1
    {
      type: 'DIRECT' as const,
      donorId: 'alice.near',
      recipientId: 'bob.near',
      amountNear: new Prisma.Decimal('10.5'),
      amountUsd: new Prisma.Decimal('42.00'),
      ftId: 'near',
      message: 'Seeding test data to db',
      donatedAt: new Date('2024-11-20T10:30:00Z'),
      blockHeight: BigInt(173700000),
      transactionHash: 'ABC123XYZ456' + Math.random().toString(36).substring(7),
      protocolFeeNear: new Prisma.Decimal('0.21'),
      protocolFeeUsd: new Prisma.Decimal('0.84'),
      referrerId: 'referrer.near',
      referrerFeeNear: new Prisma.Decimal('0.315'),
      referrerFeeUsd: new Prisma.Decimal('1.26'),
    },
    // Direct donation 2
    {
      type: 'DIRECT' as const,
      donorId: 'donor1.near',
      recipientId: 'charity.near',
      amountNear: new Prisma.Decimal('25.0'),
      amountUsd: new Prisma.Decimal('100.00'),
      ftId: 'near',
      donatedAt: new Date('2024-11-21T14:20:00Z'),
      blockHeight: BigInt(173705000),
      transactionHash: 'DEF789GHI012' + Math.random().toString(36).substring(7),
      protocolFeeNear: new Prisma.Decimal('0.50'),
      protocolFeeUsd: new Prisma.Decimal('2.00'),
    },
    // Pot donation
    {
      type: 'POT' as const,
      donorId: 'alice.near',
      potId: 'climate.v1.potfactory.potlock.near',
      amountNear: new Prisma.Decimal('50.0'),
      amountUsd: new Prisma.Decimal('200.00'),
      ftId: 'near',
      message: 'Seeding pot donation as test',
      donatedAt: new Date('2024-11-21T16:45:00Z'),
      blockHeight: BigInt(173706000),
      transactionHash: 'JKL345MNO678' + Math.random().toString(36).substring(7),
      protocolFeeNear: new Prisma.Decimal('1.00'),
      protocolFeeUsd: new Prisma.Decimal('4.00'),
      netAmount: new Prisma.Decimal('49.0'),
    },
    // Pot project donation
    {
      type: 'POT_PROJECT' as const,
      donorId: 'donor1.near',
      recipientId: 'project1.near',
      projectId: 'project1.near',
      potId: 'climate.v1.potfactory.potlock.near',
      amountNear: new Prisma.Decimal('15.0'),
      amountUsd: new Prisma.Decimal('60.00'),
      ftId: 'near',
      donatedAt: new Date('2024-11-21T18:00:00Z'),
      blockHeight: BigInt(173707000),
      transactionHash: 'PQR901STU234' + Math.random().toString(36).substring(7),
      referrerId: 'referrer.near',
      referrerFeeNear: new Prisma.Decimal('0.45'),
      referrerFeeUsd: new Prisma.Decimal('1.80'),
    },
    // Campaign donation
    {
      type: 'CAMPAIGN' as const,
      donorId: 'bob.near',
      campaignId: 'save-trees.campaign.near',
      amountNear: new Prisma.Decimal('30.0'),
      amountUsd: new Prisma.Decimal('120.00'),
      ftId: 'near',
      message: 'Seeding campaing data for test',
      donatedAt: new Date('2024-11-22T09:15:00Z'),
      blockHeight: BigInt(173708000),
      transactionHash: 'VWX567YZA890' + Math.random().toString(36).substring(7),
      protocolFeeNear: new Prisma.Decimal('0.60'),
      protocolFeeUsd: new Prisma.Decimal('2.40'),
    },
    // More donations for stats
    {
      type: 'DIRECT' as const,
      donorId: 'alice.near',
      recipientId: 'project1.near',
      amountNear: new Prisma.Decimal('5.0'),
      amountUsd: new Prisma.Decimal('20.00'),
      ftId: 'near',
      donatedAt: new Date('2024-11-19T12:00:00Z'),
      blockHeight: BigInt(173690000),
      transactionHash: 'BCD123EFG456' + Math.random().toString(36).substring(7),
      protocolFeeNear: new Prisma.Decimal('0.10'),
      protocolFeeUsd: new Prisma.Decimal('0.40'),
    },
  ];

  console.log('Creating sample donations...');
  for (const donation of donations) {
    try {
      await prisma.donation.create({ data: donation });
      console.log(`   Created ${donation.type} donation: ${donation.donorId} -> ${donation.recipientId || donation.potId || donation.campaignId}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`Donation already exists, skipping`);
      } else {
        throw error;
      }
    }
  }

  // Alice's stats
  await prisma.account.update({
    where: { id: 'alice.near' },
    data: {
      totalDonatedUsd: 262.00,
      totalDonatedNear: 65.5,
      donationsSentCount: 3,
      directDonatedUsd: 62.00,
      directSentCount: 2,
      potDonatedUsd: 200.00,
      potSentCount: 1,
      referralFeesPaidUsd: 1.26,
      firstDonationDate: new Date('2024-11-19T12:00:00Z'),
      lastDonationDate: new Date('2024-11-21T16:45:00Z'),
    },
  });

  // Bob's stats (both donor and recipient)
  await prisma.account.update({
    where: { id: 'bob.near' },
    data: {
      totalDonatedUsd: 120.00,
      totalDonatedNear: 30.0,
      donationsSentCount: 1,
      campaignDonatedUsd: 120.00,
      campaignSentCount: 1,
      totalReceivedUsd: 42.00,
      totalReceivedNear: 10.5,
      donationsReceivedCount: 1,
      directReceivedUsd: 42.00,
      directReceivedCount: 1,
      firstDonationDate: new Date('2024-11-22T09:15:00Z'),
      lastDonationDate: new Date('2024-11-22T09:15:00Z'),
    },
  });

  // Donor1's stats
  await prisma.account.update({
    where: { id: 'donor1.near' },
    data: {
      totalDonatedUsd: 160.00,
      totalDonatedNear: 40.0,
      donationsSentCount: 2,
      directDonatedUsd: 100.00,
      directSentCount: 1,
      potDonatedUsd: 60.00,
      potSentCount: 1,
      referralFeesPaidUsd: 1.80,
      firstDonationDate: new Date('2024-11-21T14:20:00Z'),
      lastDonationDate: new Date('2024-11-21T18:00:00Z'),
    },
  });

  // Charity's stats (recipient)
  await prisma.account.update({
    where: { id: 'charity.near' },
    data: {
      totalReceivedUsd: 100.00,
      totalReceivedNear: 25.0,
      donationsReceivedCount: 1,
      directReceivedUsd: 100.00,
      directReceivedCount: 1,
    },
  });

  // Project1's stats (recipient)
  await prisma.account.update({
    where: { id: 'project1.near' },
    data: {
      totalReceivedUsd: 80.00,
      totalReceivedNear: 20.0,
      donationsReceivedCount: 2,
      directReceivedUsd: 20.00,
      directReceivedCount: 1,
      potReceivedUsd: 60.00,
      potReceivedCount: 1,
    },
  });

  // Referrer's stats
  await prisma.account.update({
    where: { id: 'referrer.near' },
    data: {
      referralFeesEarnedUsd: 3.06,
    },
  });

  console.log('\n Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
