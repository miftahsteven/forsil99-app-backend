import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Ensuring Master Data & Primary Alumni Admin Account (Steven)...');

  // 1. Master School
  await prisma.masterSchool.upsert({
    where: { code: 'SMAN59JKT' },
    update: {},
    create: {
      id: 'sman59-jakarta',
      code: 'SMAN59JKT',
      name: 'SMA Negeri 59 Jakarta',
      shortName: 'SMAN 59',
      city: 'Jakarta Timur',
      province: 'DKI Jakarta',
      isActive: true,
    },
  });

  // 2. Master Cohort
  await prisma.masterCohort.upsert({
    where: { id: 'sman59-1999' },
    update: {},
    create: {
      id: 'sman59-1999',
      schoolId: 'sman59-jakarta',
      graduationYear: 1999,
      displayName: 'Angkatan 1999 (Perak)',
      isLaunchCohort: true,
      isActive: true,
    },
  });

  // 3. Master Classes
  const classes = [
    { id: '3-ipa-1', name: '3 IPA 1', major: 'IPA' },
    { id: '3-ipa-2', name: '3 IPA 2', major: 'IPA' },
    { id: '3-ipa-3', name: '3 IPA 3', major: 'IPA' },
    { id: '3-ips-1', name: '3 IPS 1', major: 'IPS' },
    { id: '3-ips-2', name: '3 IPS 2', major: 'IPS' },
    { id: '3-ips-3', name: '3 IPS 3', major: 'IPS' },
    { id: '3-ips-4', name: '3 IPS 4', major: 'IPS' },
    { id: '3-bahasa', name: '3 Bahasa', major: 'Bahasa' },
  ];

  for (const c of classes) {
    await prisma.masterClass.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        schoolId: 'sman59-jakarta',
        cohortId: 'sman59-1999',
        graduationYear: 1999,
        name: c.name,
        major: c.major,
      },
    });
  }

  // 4. Product Categories
  const categories = [
    { id: 'kuliner', name: 'Kuliner & Catering', sortOrder: 1 },
    { id: 'jasa_profesional', name: 'Jasa Profesional', sortOrder: 2 },
    { id: 'fashion', name: 'Fashion & Kaos', sortOrder: 3 },
    { id: 'gadget', name: 'Gadget & Teknologi', sortOrder: 4 },
    { id: 'kesehatan', name: 'Kesehatan & Olahraga', sortOrder: 5 },
    { id: 'properti', name: 'Properti & Interior', sortOrder: 6 },
  ];

  for (const cat of categories) {
    await prisma.productCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }

  // 5. Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'mscodx@gmail.com' },
        { phoneNumber: '08558833244' },
      ],
    },
    include: { profile: true },
  });

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('B47054ii!', salt);

  if (existingUser) {
    console.log(`ℹ️ Existing user found (${existingUser.email || existingUser.phoneNumber}). Updating to Steven (steve)...`);
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        email: 'mscodx@gmail.com',
        phoneNumber: '08558833244',
        passwordHash,
        roles: ['alumni', 'admin', 'super_admin', 'seller'],
        verificationStatus: 'approved',
        isActive: true,
      },
    });

    await prisma.profile.upsert({
      where: { userId: existingUser.id },
      update: {
        fullName: 'Steven',
        nickname: 'steve',
        className: '3 IPA 1',
        major: 'IPA',
        graduationYear: 1999,
        schoolCode: 'SMAN59JKT',
        searchKeywords: ['steven', 'steve', 'ipa1', '3 ipa 1', 'admin', 'jakarta'],
        verifiedAt: new Date(),
      },
      create: {
        userId: existingUser.id,
        fullName: 'Steven',
        nickname: 'steve',
        profilePhotoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
        coverPhotoUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
        graduationYear: 1999,
        schoolCode: 'SMAN59JKT',
        className: '3 IPA 1',
        major: 'IPA',
        nia: '59990001',
        city: 'Jakarta Timur',
        province: 'DKI Jakarta',
        occupation: 'Alumni 59',
        bio: 'Alumni SMAN 59 Jakarta Angkatan 1999.',
        skills: ['Teknologi', 'Networking'],
        interests: ['Komunitas Alumni', 'Teknologi'],
        socialLinks: {},
        privacy: {
          phone: 'same_class',
          birthDate: 'verified_alumni',
          occupation: 'verified_alumni',
          lastSeen: 'verified_alumni',
        },
        verifiedAt: new Date(),
        sellerStatus: 'approved',
        searchKeywords: ['steven', 'steve', 'ipa1', '3 ipa 1', 'admin', 'jakarta'],
      },
    });

    console.log('✅ Account Steven updated successfully!');
  } else {
    console.log('👤 Creating primary alumni user: Steven (steve)...');
    const newUser = await prisma.user.create({
      data: {
        id: 'admin_steven_99',
        email: 'mscodx@gmail.com',
        phoneNumber: '08558833244',
        passwordHash,
        roles: ['alumni', 'admin', 'super_admin', 'seller'],
        verificationStatus: 'approved',
        isActive: true,
        profile: {
          create: {
            fullName: 'Steven',
            nickname: 'steve',
            profilePhotoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
            coverPhotoUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
            graduationYear: 1999,
            schoolCode: 'SMAN59JKT',
            className: '3 IPA 1',
            major: 'IPA',
            nia: '59990001',
            city: 'Jakarta Timur',
            province: 'DKI Jakarta',
            occupation: 'Alumni 59',
            bio: 'Alumni SMAN 59 Jakarta Angkatan 1999.',
            skills: ['Teknologi', 'Networking'],
            interests: ['Komunitas Alumni', 'Teknologi'],
            socialLinks: {},
            privacy: {
              phone: 'same_class',
              birthDate: 'verified_alumni',
              occupation: 'verified_alumni',
              lastSeen: 'verified_alumni',
            },
            verifiedAt: new Date(),
            sellerStatus: 'approved',
            searchKeywords: ['steven', 'steve', 'ipa1', '3 ipa 1', 'admin', 'jakarta'],
          },
        },
      },
    });
    console.log('✅ Account Steven created successfully!');
  }

  console.log('=======================================================');
  console.log('✅ SEEDING COMPLETE!');
  console.log('👤 Nama: Steven');
  console.log('🏷️ Panggilan: steve');
  console.log('📱 WhatsApp: 08558833244');
  console.log('📧 Email: mscodx@gmail.com');
  console.log('🎓 Kelas: 3 IPA 1');
  console.log('🔑 Password: B47054ii!');
  console.log('=======================================================');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
