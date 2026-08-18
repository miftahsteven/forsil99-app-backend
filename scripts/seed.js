"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🚀 Seeding Forsil 99 Database (PostgreSQL via Prisma)...');
    // Clear existing records to ensure fresh seed
    console.log('🧹 Cleaning old data...');
    await prisma.notification.deleteMany();
    await prisma.chatMessage.deleteMany();
    await prisma.chatThread.deleteMany();
    await prisma.liveLocation.deleteMany();
    await prisma.eventRsvp.deleteMany();
    await prisma.event.deleteMany();
    await prisma.product.deleteMany();
    await prisma.shop.deleteMany();
    await prisma.story.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.postReaction.deleteMany();
    await prisma.post.deleteMany();
    await prisma.alumniRegistration.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.masterClass.deleteMany();
    await prisma.masterCohort.deleteMany();
    await prisma.masterSchool.deleteMany();
    await prisma.productCategory.deleteMany();
    // 1. Master School, Cohort, Classes, Categories
    console.log('🏫 Seeding master data SMAN 59 Jakarta...');
    await prisma.masterSchool.create({
        data: {
            id: 'sman59-jakarta',
            code: 'SMAN59JKT',
            name: 'SMA Negeri 59 Jakarta',
            shortName: 'SMAN 59',
            city: 'Jakarta Timur',
            province: 'DKI Jakarta',
            isActive: true,
        },
    });
    await prisma.masterCohort.create({
        data: {
            id: 'sman59-1999',
            schoolId: 'sman59-jakarta',
            graduationYear: 1999,
            displayName: 'Angkatan 1999 (Perak)',
            isLaunchCohort: true,
            isActive: true,
        },
    });
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
        await prisma.masterClass.create({
            data: {
                id: c.id,
                schoolId: 'sman59-jakarta',
                cohortId: 'sman59-1999',
                graduationYear: 1999,
                name: c.name,
                major: c.major,
            },
        });
    }
    const categories = [
        { id: 'kuliner', name: 'Kuliner & Catering', sortOrder: 1 },
        { id: 'jasa_profesional', name: 'Jasa Profesional', sortOrder: 2 },
        { id: 'fashion', name: 'Fashion & Kaos', sortOrder: 3 },
        { id: 'gadget', name: 'Gadget & Teknologi', sortOrder: 4 },
        { id: 'kesehatan', name: 'Kesehatan & Olahraga', sortOrder: 5 },
        { id: 'properti', name: 'Properti & Interior', sortOrder: 6 },
    ];
    for (const cat of categories) {
        await prisma.productCategory.create({ data: cat });
    }
    // 2. Initial Users & Profiles
    console.log('👤 Seeding alumni users & profiles...');
    const salt = await bcryptjs_1.default.genSalt(10);
    const defaultPasswordHash = await bcryptjs_1.default.hash('password123', salt);
    const usersData = [
        {
            id: 'user_miftah_00',
            email: 'miftahsyarief@sman59.sch.id',
            phoneNumber: '081299995900',
            passwordHash: defaultPasswordHash,
            roles: ['alumni', 'admin', 'super_admin'],
            verificationStatus: 'approved',
            profile: {
                fullName: 'Miftahuddin Syarief',
                nickname: 'Udin',
                profilePhotoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
                coverPhotoUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
                graduationYear: 1999,
                schoolCode: 'SMAN59JKT',
                className: '3 IPA 1',
                major: 'IPA',
                nia: '59990001',
                city: 'Jakarta Timur',
                province: 'DKI Jakarta',
                occupation: 'Alumni SMAN 59 Jakarta',
                company: 'Forsil 99',
                businessField: 'Teknologi Informasi',
                bio: 'Alumni 59 IPA 1 Angkatan 1999. Mari rawat silaturahmi perak.',
                skills: ['Komunikasi', 'Leadership', 'Teknologi'],
                interests: ['Teknologi', 'Olahraga', 'Komunitas'],
                socialLinks: { instagram: '@miftahuddin_syarief' },
                sellerStatus: 'none',
                searchKeywords: ['miftahuddin', 'syarief', 'udin', 'miftah', 'ipa1', 'jakarta'],
                verifiedAt: new Date('2026-01-15T08:00:00Z'),
            },
        },
        {
            id: 'user_budi_01',
            email: 'budi@sman59.sch.id',
            phoneNumber: '081234567890',
            passwordHash: defaultPasswordHash,
            roles: ['alumni', 'seller', 'admin'],
            verificationStatus: 'approved',
            profile: {
                fullName: 'Budi Santoso',
                nickname: 'Budi',
                profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
                coverPhotoUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
                graduationYear: 1999,
                schoolCode: 'SMAN59JKT',
                className: '3 IPA 1',
                major: 'IPA',
                nia: '59990101',
                city: 'Jakarta Timur',
                province: 'DKI Jakarta',
                occupation: 'Senior Software Engineer',
                company: 'Tech Solutions Indonesia',
                businessField: 'Teknologi Informasi',
                bio: 'Alumni 59 IPA 1 Angkatan 99. Pecinta kopi hitam dan gowes akhir pekan.',
                skills: ['Software Engineering', 'System Architecture', 'Mentoring'],
                interests: ['Teknologi', 'Sepeda', 'Fotografi'],
                socialLinks: { instagram: '@budisantoso99', linkedin: 'budi-santoso-59' },
                sellerStatus: 'approved',
                searchKeywords: ['budi', 'santoso', 'ipa1', 'jakarta', 'software'],
                verifiedAt: new Date('2026-01-15T08:00:00Z'),
            },
        },
        {
            id: 'user_siti_02',
            email: 'rahma@sman59.sch.id',
            phoneNumber: '081299595999',
            passwordHash: defaultPasswordHash,
            roles: ['alumni', 'seller'],
            verificationStatus: 'approved',
            profile: {
                fullName: 'Siti Rahmawati',
                nickname: 'Rahma',
                profilePhotoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
                coverPhotoUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
                graduationYear: 1999,
                schoolCode: 'SMAN59JKT',
                className: '3 IPS 2',
                major: 'IPS',
                nia: '59990204',
                city: 'Bekasi',
                province: 'Jawa Barat',
                occupation: 'Owner Dapur Rahma 59',
                company: 'Dapur Rahma Catering',
                businessField: 'Kuliner & Catering',
                bio: 'Katering lezat keluarga alumni 59. Menyediakan nasi boks, tumpeng, & snack box event angkatan.',
                skills: ['Culinary Arts', 'Catering Management', 'Baking'],
                interests: ['Kuliner', 'Resep Tradisional', 'Komunitas'],
                socialLinks: { instagram: '@dapurrahma59' },
                sellerStatus: 'approved',
                searchKeywords: ['siti', 'rahmawati', 'rahma', 'ips2', 'bekasi', 'kuliner', 'catering'],
                verifiedAt: new Date('2026-02-01T09:30:00Z'),
            },
        },
        {
            id: 'user_hendra_03',
            email: 'hendra@sman59.sch.id',
            phoneNumber: '081299595903',
            passwordHash: defaultPasswordHash,
            roles: ['alumni'],
            verificationStatus: 'approved',
            profile: {
                fullName: 'Dr. Hendra Wijaya',
                nickname: 'Hendra',
                profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
                coverPhotoUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80',
                graduationYear: 1999,
                schoolCode: 'SMAN59JKT',
                className: '3 IPA 2',
                major: 'IPA',
                nia: '59990188',
                city: 'Jakarta Selatan',
                province: 'DKI Jakarta',
                occupation: 'Dokter Spesialis Anak',
                company: 'RS Medika Sejahtera',
                businessField: 'Kesehatan & Medis',
                bio: 'Alumni 59 IPA 2. Konsultasi kesehatan anak & webinar rutin alumni 99.',
                skills: ['Pediatrics', 'Child Healthcare', 'Health Education'],
                interests: ['Kesehatan Anak', 'Lari Marathon', 'Membaca'],
                sellerStatus: 'approved',
                searchKeywords: ['hendra', 'wijaya', 'dokter', 'ipa2', 'kesehatan', 'anak'],
                verifiedAt: new Date('2026-01-20T10:00:00Z'),
            },
        },
        {
            id: 'user_dewi_04',
            email: 'dewi@sman59.sch.id',
            phoneNumber: '081388599900',
            passwordHash: defaultPasswordHash,
            roles: ['alumni', 'seller'],
            verificationStatus: 'approved',
            profile: {
                fullName: 'Dewi Lestari',
                nickname: 'Dewi',
                profilePhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
                graduationYear: 1999,
                schoolCode: 'SMAN59JKT',
                className: '3 IPS 1',
                major: 'IPS',
                city: 'Depok',
                province: 'Jawa Barat',
                occupation: 'Desainer Interior & Studio 59',
                company: 'Lestari Interior Design',
                businessField: 'Arsitektur & Interior',
                bio: 'Menghadirkan kenyamanan hunian manis untuk kawan alumni.',
                skills: ['Interior Design', 'Home Styling', '3D Rendering'],
                interests: ['Desain Interior', 'Seni', 'Tanaman Hias'],
                sellerStatus: 'approved',
                searchKeywords: ['dewi', 'lestari', 'ips1', 'interior', 'depok'],
                verifiedAt: new Date('2026-03-01T11:00:00Z'),
            },
        },
        {
            id: 'user_pending_05',
            email: 'rian.prasetya@gmail.com',
            phoneNumber: '081211119999',
            passwordHash: defaultPasswordHash,
            roles: ['alumni'],
            verificationStatus: 'submitted',
            profile: {
                fullName: 'Rian Prasetya (Pending Demo)',
                nickname: 'Rian',
                profilePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
                graduationYear: 1999,
                schoolCode: 'SMAN59JKT',
                className: '3 IPA 3',
                major: 'IPA',
                city: 'Tangerang',
                province: 'Banten',
                occupation: 'Wiraswasta Retail',
                skills: ['Retail Management'],
                interests: ['Olahraga', 'Musik'],
                sellerStatus: 'none',
                searchKeywords: ['rian', 'prasetya', 'ipa3'],
            },
        },
    ];
    for (const u of usersData) {
        const { profile, ...userData } = u;
        await prisma.user.create({
            data: {
                ...userData,
                profile: {
                    create: profile,
                },
            },
        });
    }
    // 3. Initial Posts & Feeds
    console.log('📰 Seeding community posts...');
    const post1 = await prisma.post.create({
        data: {
            id: 'post_01',
            authorId: 'user_budi_01',
            type: 'announcement',
            text: '📢 Salam hangat untuk kawan-kawan Alumni SMAN 59 Angkatan 99! Aplikasi Forsil 99 resmi diluncurkan sebagai rumah digital kita bersama. Mari rapikan direktori, dukung usaha teman, dan bagikan kenangan nostalgia.',
            visibility: 'verified_alumni',
            reactionCount: 24,
            commentCount: 2,
            saveCount: 5,
            isPinned: true,
            commentsEnabled: true,
            moderationStatus: 'visible',
            createdAt: new Date('2026-07-18T06:00:00Z'),
        },
    });
    const post2 = await prisma.post.create({
        data: {
            id: 'post_02',
            authorId: 'user_siti_02',
            type: 'memory',
            text: '📸 KAPSUL 99: Masih ingat momen pas acara Bakti Sosial & Perpisahan Sekolah tahun 1999 di Aula 59? Dulu rambut masih tebal, sekarang anak-anak sudah SMA juga! 😂 Terima kasih teman-teman yang masih setia simpan foto ini.',
            media: [
                {
                    type: 'image',
                    url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80',
                    caption: 'Foto Perpisahan SMAN 59 Jakarta Angkatan 99',
                },
            ],
            memoryMeta: {
                year: 1999,
                locationName: 'Aula SMA Negeri 59 Jakarta',
                album: 'Acara Sekolah',
                isThenAndNow: true,
            },
            visibility: 'verified_alumni',
            reactionCount: 42,
            commentCount: 3,
            saveCount: 12,
            commentsEnabled: true,
            moderationStatus: 'visible',
            createdAt: new Date('2026-07-17T14:20:00Z'),
        },
    });
    const post3 = await prisma.post.create({
        data: {
            id: 'post_03',
            authorId: 'user_siti_02',
            type: 'shop_share',
            text: '🍛 Halo kawan 59! Dapur Rahma 59 siap melayani pesanan Tumpeng Mini & Katering Selamatan untuk arisan atau perjumpaan angkatan. Spesial diskon 15% untuk sesama Alumni SMAN 59!',
            media: [
                {
                    type: 'image',
                    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
                    caption: 'Paket Katering Dapur Rahma 59',
                },
            ],
            linkedProductId: 'prod_01',
            visibility: 'verified_alumni',
            reactionCount: 18,
            commentCount: 1,
            saveCount: 4,
            commentsEnabled: true,
            moderationStatus: 'visible',
            createdAt: new Date('2026-07-16T10:15:00Z'),
        },
    });
    const post4 = await prisma.post.create({
        data: {
            id: 'post_04',
            authorId: 'user_hendra_03',
            type: 'help',
            text: '💡 Teman-teman 59, ada yang punya rekomendasi vendor sablon kaos berkualitas untuk merchandise Reuni Perak Angkatan 99? Mohon info atau kontak Seller 99 ya.',
            visibility: 'verified_alumni',
            reactionCount: 12,
            commentCount: 1,
            saveCount: 2,
            commentsEnabled: true,
            moderationStatus: 'visible',
            createdAt: new Date('2026-07-15T09:00:00Z'),
        },
    });
    // Post Reactions
    await prisma.postReaction.createMany({
        data: [
            { postId: post1.id, userId: 'user_miftah_00', reactionType: 'salut' },
            { postId: post1.id, userId: 'user_siti_02', reactionType: 'salut' },
            { postId: post2.id, userId: 'user_budi_01', reactionType: 'kangen' },
            { postId: post2.id, userId: 'user_miftah_00', reactionType: 'kangen' },
            { postId: post3.id, userId: 'user_budi_01', reactionType: 'suka' },
            { postId: post4.id, userId: 'user_dewi_04', reactionType: 'semangat' },
        ],
    });
    // Comments
    await prisma.comment.createMany({
        data: [
            {
                postId: post1.id,
                authorId: 'user_miftah_00',
                text: 'Mantap Budi! Semoga Forsil 99 makin solid dan guyub selalu.',
                createdAt: new Date('2026-07-18T07:00:00Z'),
            },
            {
                postId: post2.id,
                authorId: 'user_hendra_03',
                text: 'Astagfirullah foto jaman rambut belah tengah masih ada! 😂 Sehat-sehat semua teman-teman.',
                createdAt: new Date('2026-07-17T15:30:00Z'),
            },
            {
                postId: post3.id,
                authorId: 'user_budi_01',
                text: 'Wah recommended ini katering Bu Rahma! Kapan-kapan buat acara kopdar ya.',
                createdAt: new Date('2026-07-16T11:00:00Z'),
            },
        ],
    });
    // 4. 24-Hour Stories
    console.log('✨ Seeding 24-hour stories...');
    const expiresTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.story.createMany({
        data: [
            {
                authorId: 'user_siti_02',
                mediaType: 'image',
                mediaUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
                caption: 'Pesanan tumpeng pagi ini untuk kawan alumni SMAN 59! 🍛',
                expiresAt: expiresTomorrow,
            },
            {
                authorId: 'user_budi_01',
                mediaType: 'image',
                mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
                caption: 'Ngopi santai bareng teman seangkatan ☕',
                expiresAt: expiresTomorrow,
            },
        ],
    });
    // 5. Shops & Products
    console.log('🛍️ Seeding Seller 99 shops & products...');
    const shop1 = await prisma.shop.create({
        data: {
            id: 'shop_01',
            ownerId: 'user_siti_02',
            name: 'Dapur Rahma 59',
            logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=300&q=80',
            description: 'Katering lezat hidangan Nusantara & snack box berkualitas tinggi dari Alumni 59 IPS 2.',
            categoryIds: ['kuliner'],
            businessType: 'product',
            city: 'Bekasi',
            serviceAreas: ['Bekasi', 'Jakarta Timur', 'Jakarta Selatan', 'Depok'],
            contactPhone: '081299595999',
            contactMethod: 'chat',
            status: 'approved',
            viewCount: 154,
        },
    });
    const shop2 = await prisma.shop.create({
        data: {
            id: 'shop_02',
            ownerId: 'user_dewi_04',
            name: 'Lestari Interior & Design',
            logoUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=300&q=80',
            description: 'Konsultan interior rumah, apartemen, dan kantor. Gratis konsultasi awal untuk alumni SMAN 59.',
            categoryIds: ['jasa_profesional', 'properti'],
            businessType: 'service',
            city: 'Depok',
            serviceAreas: ['Jabodetabek'],
            contactPhone: '081388599900',
            contactMethod: 'chat',
            status: 'approved',
            viewCount: 98,
        },
    });
    await prisma.product.createMany({
        data: [
            {
                id: 'prod_01',
                shopId: shop1.id,
                ownerId: 'user_siti_02',
                name: 'Nasi Tumpeng Mini Spesial Alumni',
                type: 'product',
                categoryId: 'kuliner',
                categoryName: 'Kuliner & Catering',
                description: 'Nasi tumpeng mini dengan 7 macam lauk komplit (Ayam goreng serundeng, sambal goreng ati, perkedel, telur iris, serundeng, orek tempe, lalapan & sambal).',
                imageUrls: [
                    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
                    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
                ],
                priceType: 'fixed',
                price: 35000,
                unit: 'porsi',
                city: 'Bekasi',
                serviceAreas: ['Jabodetabek'],
                status: 'active',
            },
            {
                id: 'prod_02',
                shopId: shop1.id,
                ownerId: 'user_siti_02',
                name: 'Snack Box Premium Events (3 Kue + Mineral)',
                type: 'product',
                categoryId: 'kuliner',
                categoryName: 'Kuliner & Catering',
                description: 'Paket snack box untuk pengajian, arisan, atau rapat alumni. Isi risoles mayo, lemper ayam, & pie buah manis.',
                imageUrls: [
                    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
                ],
                priceType: 'fixed',
                price: 20000,
                unit: 'box',
                city: 'Bekasi',
                serviceAreas: ['Bekasi', 'Jakarta'],
                status: 'active',
            },
            {
                id: 'prod_03',
                shopId: shop2.id,
                ownerId: 'user_dewi_04',
                name: 'Jasa Desain Interior Rumah Minimalis',
                type: 'service',
                categoryId: 'jasa_profesional',
                categoryName: 'Jasa Profesional',
                description: 'Paket desain 3D visualisasi, denah layout tata letak furnitur, dan RAB pemilihan material.',
                imageUrls: [
                    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
                ],
                priceType: 'starting_from',
                price: 150000,
                unit: 'm2',
                city: 'Depok',
                serviceAreas: ['Jabodetabek'],
                status: 'active',
            },
        ],
    });
    // 6. Alumni Events & RSVPs
    console.log('📅 Seeding alumni events...');
    const event1 = await prisma.event.create({
        data: {
            id: 'evt_01',
            title: 'Silaturahmi & Temu Kangen Perak Angkatan 99 SMAN 59',
            description: 'Jumpa darat mempererat tali persaudaraan alumni 59 setelah 27 tahun. Ramah tamah, santap siang katering alumni, & pemutaran Kapsul 99.',
            coverUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80',
            startAt: new Date('2026-08-15T10:00:00Z'),
            endAt: new Date('2026-08-15T15:00:00Z'),
            locationName: 'Gedung Serbaguna Jakarta Timur',
            address: 'Jl. Raden Inten II No. 59, Duren Sawit, Jakarta Timur',
            organizerName: 'Panitia Forsil99 SMAN 59',
            attendeeCount: 78,
            status: 'published',
        },
    });
    const event2 = await prisma.event.create({
        data: {
            id: 'evt_02',
            title: 'Webinar Edukasi Kesehatan Anak & Keluarga',
            description: 'Sharing santai via Google Meet bersama Dr. Hendra Wijaya (IPA 2) mengenai kesehatan keluarga di usia 40-an.',
            coverUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
            startAt: new Date('2026-08-02T19:30:00Z'),
            endAt: new Date('2026-08-02T21:00:00Z'),
            locationName: 'Online (Google Meet)',
            organizerName: 'Tim Kesehatan Forsil 99',
            attendeeCount: 45,
            status: 'published',
        },
    });
    await prisma.eventRsvp.createMany({
        data: [
            { eventId: event1.id, userId: 'user_budi_01', status: 'hadir' },
            { eventId: event1.id, userId: 'user_miftah_00', status: 'hadir' },
            { eventId: event1.id, userId: 'user_siti_02', status: 'hadir' },
            { eventId: event2.id, userId: 'user_budi_01', status: 'mungkin' },
        ],
    });
    // 7. Live Locations Radar
    console.log('📍 Seeding live location radar data...');
    await prisma.liveLocation.createMany({
        data: [
            {
                userId: 'user_budi_01',
                fullName: 'Budi Santoso',
                nickname: 'Budi',
                photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
                className: '3 IPA 1',
                isSharing: true,
                lat: -6.2297,
                lng: 106.8624,
                cityName: 'Jakarta Timur',
                areaName: 'Duren Sawit / Klender',
                updatedAt: new Date(Date.now() - 10 * 60 * 1000),
            },
            {
                userId: 'user_siti_02',
                fullName: 'Siti Rahmawati',
                nickname: 'Rahma',
                photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
                className: '3 IPS 2',
                isSharing: true,
                lat: -6.2349,
                lng: 106.9896,
                cityName: 'Bekasi Barat',
                areaName: 'Harapan Indah',
                updatedAt: new Date(Date.now() - 5 * 60 * 1000),
            },
            {
                userId: 'user_hendra_03',
                fullName: 'Dr. Hendra Wijaya',
                nickname: 'Hendra',
                photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
                className: '3 IPA 2',
                isSharing: true,
                lat: -6.28,
                lng: 106.82,
                cityName: 'Jakarta Selatan',
                areaName: 'Cilandak / TB Simatupang',
                updatedAt: new Date(Date.now() - 25 * 60 * 1000),
            },
        ],
    });
    // 8. Chat Threads & Messages
    console.log('💬 Seeding chat threads & messages...');
    const chatThread1 = await prisma.chatThread.create({
        data: {
            id: 'chat_budi_siti',
            memberIds: ['user_budi_01', 'user_siti_02'],
            lastMessageText: 'Halo Budi, tumpeng mini untuk acara angkatan sudah dipersiapkan ya.',
            lastMessageAt: new Date('2026-07-18T09:30:00Z'),
        },
    });
    await prisma.chatMessage.createMany({
        data: [
            {
                threadId: chatThread1.id,
                senderId: 'user_budi_01',
                text: 'Assalamu alaikum Rahma, mau tanya paket tumpeng mini untuk 30 porsi arisan.',
                isRead: true,
                createdAt: new Date('2026-07-18T09:00:00Z'),
            },
            {
                threadId: chatThread1.id,
                senderId: 'user_siti_02',
                text: 'Wa alaikumsalam Budi! BISA banget, khusus alumni 59 ada potong harga ya.',
                isRead: true,
                createdAt: new Date('2026-07-18T09:15:00Z'),
            },
            {
                threadId: chatThread1.id,
                senderId: 'user_siti_02',
                text: 'Halo Budi, tumpeng mini untuk acara angkatan sudah dipersiapkan ya.',
                isRead: false,
                createdAt: new Date('2026-07-18T09:30:00Z'),
            },
        ],
    });
    // 9. Notifications
    console.log('🔔 Seeding initial notifications...');
    await prisma.notification.createMany({
        data: [
            {
                recipientId: 'user_budi_01',
                actorName: 'Siti Rahmawati',
                actorPhotoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
                type: 'reaction',
                title: 'Reaksi Baru',
                body: 'Siti Rahmawati memberi reaksi "Kangen" pada postingan Kapsul 99 Anda.',
                isRead: false,
                createdAt: new Date('2026-07-18T08:00:00Z'),
            },
            {
                recipientId: 'user_budi_01',
                actorName: 'Admin Forsil 99',
                type: 'verification',
                title: 'Status Verifikasi Alumni',
                body: 'Selamat! Akun Anda telah terverifikasi sebagai Alumni SMAN 59 Angkatan 99.',
                isRead: true,
                createdAt: new Date('2026-01-15T08:05:00Z'),
            },
            {
                recipientId: 'user_miftah_00',
                actorName: 'Admin Forsil 99',
                type: 'verification',
                title: 'Selamat Datang di Forsil 99',
                body: 'Akun Super Admin Forsil 99 telah aktif.',
                isRead: false,
                createdAt: new Date(),
            },
        ],
    });
    console.log('✅ ALL SEED DATA SUCCESSFULLY WRITTEN TO POSTGRESQL!');
}
main()
    .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
