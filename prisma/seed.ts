import { PrismaClient, DonationType } from '../generated/prisma';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  console.log('Seeding database with test data...');

  // Create test accounts
  const alice = await prisma.account.upsert({
    where: { id: 'alice.testnet' },
    create: {
      id: 'alice.testnet',
      totalDonatedNear: 150.5,
      totalDonatedUsd: 602.0,
      totalReceivedNear: 25.0,
      totalReceivedUsd: 100.0,
      donationsSentCount: 15,
      donationsReceivedCount: 3,
      referralFeesEarnedNear: 5.0,
      referralFeesEarnedUsd: 20.0,
      referralFeesPaidNear: 2.0,
      referralFeesPaidUsd: 8.0,
      directDonatedUsd: 200.0,
      directReceivedUsd: 50.0,
      directSentCount: 5,
      directReceivedCount: 1,
      potDonatedUsd: 350.0,
      potReceivedUsd: 40.0,
      potSentCount: 8,
      potReceivedCount: 1,
      campaignDonatedUsd: 52.0,
      campaignReceivedUsd: 10.0,
      campaignSentCount: 2,
      campaignReceivedCount: 1,
      firstDonationDate: new Date('2024-01-15T10:30:00Z'),
      lastDonationDate: new Date('2024-11-20T14:22:00Z'),
    },
    update: {},
  });

  const bob = await prisma.account.upsert({
    where: { id: 'bob.testnet' },
    create: {
      id: 'bob.testnet',
      totalDonatedNear: 75.0,
      totalDonatedUsd: 300.0,
      totalReceivedNear: 200.5,
      totalReceivedUsd: 802.0,
      donationsSentCount: 8,
      donationsReceivedCount: 20,
      referralFeesEarnedNear: 10.0,
      referralFeesEarnedUsd: 40.0,
      referralFeesPaidNear: 1.0,
      referralFeesPaidUsd: 4.0,
      directDonatedUsd: 100.0,
      directReceivedUsd: 400.0,
      directSentCount: 3,
      directReceivedCount: 10,
      potDonatedUsd: 180.0,
      potReceivedUsd: 350.0,
      potSentCount: 4,
      potReceivedCount: 8,
      campaignDonatedUsd: 20.0,
      campaignReceivedUsd: 52.0,
      campaignSentCount: 1,
      campaignReceivedCount: 2,
      firstDonationDate: new Date('2024-02-01T08:15:00Z'),
      lastDonationDate: new Date('2024-11-19T16:45:00Z'),
    },
    update: {},
  });

  const charlie = await prisma.account.upsert({
    where: { id: 'charlie.testnet' },
    create: {
      id: 'charlie.testnet',
      totalDonatedNear: 300.0,
      totalDonatedUsd: 1200.0,
      totalReceivedNear: 50.0,
      totalReceivedUsd: 200.0,
      donationsSentCount: 25,
      donationsReceivedCount: 5,
      referralFeesEarnedNear: 15.0,
      referralFeesEarnedUsd: 60.0,
      referralFeesPaidNear: 3.0,
      referralFeesPaidUsd: 12.0,
      directDonatedUsd: 500.0,
      directReceivedUsd: 100.0,
      directSentCount: 12,
      directReceivedCount: 2,
      potDonatedUsd: 600.0,
      potReceivedUsd: 80.0,
      potSentCount: 10,
      potReceivedCount: 2,
      campaignDonatedUsd: 100.0,
      campaignReceivedUsd: 20.0,
      campaignSentCount: 3,
      campaignReceivedCount: 1,
      firstDonationDate: new Date('2023-11-10T12:00:00Z'),
      lastDonationDate: new Date('2024-11-21T09:30:00Z'),
    },
    update: {},
  });

  // Create test pot
  const pot = await prisma.pot.upsert({
    where: { id: 'test-pot.potlock.testnet' },
    create: {
      id: 'test-pot.potlock.testnet',
      name: 'Test Quadratic Funding Round',
      description: 'A test pot for quadratic funding',
    },
    update: {},
  });

  // Create test campaign
  const campaign = await prisma.campaign.upsert({
    where: { id: 'save-trees.campaign.testnet' },
    create: {
      id: 'save-trees.campaign.testnet',
      name: 'Somethign inspiring',
      description: 'Something interesting',
    },
    update: {},
  });

  // Create donations
  const donations = [
    {
      type: DonationType.DIRECT,
      donorId: 'alice.testnet',
      recipientId: 'bob.testnet',
      amountNear: 10.0,
      amountUsd: 40.0,
      ftId: 'near',
      message: 'Test message',
      donatedAt: new Date('2024-11-15T10:00:00Z'),
      blockHeight: BigInt(220000000),
      transactionHash: 'tx_direct_1',
      protocolFeeNear: 0.2,
      protocolFeeUsd: 0.8,
      referrerId: 'charlie.testnet',
      referrerFeeNear: 0.3,
      referrerFeeUsd: 1.2,
    },
    {
      type: DonationType.POT,
      donorId: 'charlie.testnet',
      potId: 'test-pot.potlock.testnet',
      amountNear: 50.0,
      amountUsd: 200.0,
      netAmount: 48.5,
      ftId: 'near',
      message: 'Test message',
      donatedAt: new Date('2024-11-18T14:30:00Z'),
      blockHeight: BigInt(220500000),
      transactionHash: 'tx_pot_1',
      protocolFeeNear: 1.0,
      protocolFeeUsd: 4.0,
      referrerId: 'bob.testnet',
      referrerFeeNear: 0.5,
      referrerFeeUsd: 2.0,
    },
    {
      type: DonationType.POT_PROJECT,
      donorId: 'alice.testnet',
      recipientId: 'bob.testnet',
      projectId: 'bob.testnet',
      potId: 'test-pot.potlock.testnet',
      amountNear: 25.0,
      amountUsd: 100.0,
      ftId: 'near',
      donatedAt: new Date('2024-11-19T16:00:00Z'),
      blockHeight: BigInt(220600000),
      transactionHash: 'tx_pot_project_1',
      referrerId: 'charlie.testnet',
      referrerFeeNear: 0.75,
      referrerFeeUsd: 3.0,
    },
    {
      type: DonationType.CAMPAIGN,
      donorId: 'bob.testnet',
      campaignId: 'save-trees.campaign.testnet',
      amountNear: 15.0,
      amountUsd: 60.0,
      ftId: 'near',
      message: 'Test message',
      donatedAt: new Date('2024-11-20T11:15:00Z'),
      blockHeight: BigInt(220700000),
      transactionHash: 'tx_campaign_1',
      protocolFeeNear: 0.3,
      protocolFeeUsd: 1.2,
    },
    {
      type: DonationType.DIRECT,
      donorId: 'charlie.testnet',
      recipientId: 'alice.testnet',
      amountNear: 20.0,
      amountUsd: 80.0,
      ftId: 'near',
      message: 'Test message',
      donatedAt: new Date('2024-11-21T09:00:00Z'),
      blockHeight: BigInt(220800000),
      transactionHash: 'tx_direct_2',
      protocolFeeNear: 0.4,
      protocolFeeUsd: 1.6,
    },
  ];

  for (const donation of donations) {
    await prisma.donation.upsert({
      where: { transactionHash: donation.transactionHash },
      create: donation,
      update: {},
    });
  }

  // Create price history
  await prisma.tokenPrice.upsert({
    where: {
      tokenId_timestamp: {
        tokenId: 'near',
        timestamp: new Date('2024-11-20T00:00:00Z'),
      },
    },
    create: {
      tokenId: 'near',
      priceUsd: 4.0,
      timestamp: new Date('2024-11-20T00:00:00Z'),
      source: 'coingecko',
    },
    update: {},
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
