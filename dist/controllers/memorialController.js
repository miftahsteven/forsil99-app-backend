import { prisma } from '../lib/prisma.js';
/**
 * GET /api/v1/memorial
 * Fetch all deceased alumni with active flower count and prayer count
 */
export async function getDeceasedAlumni(req, res) {
    try {
        const currentUserId = req.user?.id;
        const now = new Date();
        const records = await prisma.deceasedAlumni.findMany({
            include: {
                flowers: {
                    where: {
                        expiresAt: { gt: now },
                    },
                },
                prayers: {
                    include: {
                        author: {
                            include: {
                                profile: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 2,
                },
                _count: {
                    select: {
                        prayers: true,
                    },
                },
            },
            orderBy: {
                passedAwayYear: 'desc',
            },
        });
        const result = records.map((item) => {
            const userFlower = currentUserId
                ? item.flowers.find((f) => f.userId === currentUserId)
                : null;
            return {
                id: item.id,
                fullName: item.fullName,
                nickname: item.nickname,
                className: item.className,
                photoUrl: item.photoUrl,
                passedAwayYear: item.passedAwayYear,
                passedAwayDate: item.passedAwayDate,
                bio: item.bio,
                createdById: item.createdById,
                flowerCount: item.flowers.length,
                prayerCount: item._count?.prayers || 0,
                hasGivenFlower: Boolean(userFlower),
                flowerExpiresAt: userFlower ? userFlower.expiresAt.toISOString() : null,
                recentPrayers: item.prayers.map((p) => ({
                    id: p.id,
                    deceasedId: p.deceasedId,
                    authorId: p.authorId,
                    authorName: p.author?.profile?.fullName || p.author?.email || 'Alumni 99',
                    authorNickname: p.author?.profile?.nickname,
                    authorPhotoUrl: p.author?.profile?.profilePhotoUrl,
                    authorClass: p.author?.profile?.className || 'Alumni 99',
                    text: p.text,
                    createdAt: p.createdAt.toISOString(),
                })),
            };
        });
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('Error fetching deceased alumni:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat data alumni in memoriam.' });
    }
}
/**
 * GET /api/v1/memorial/:id
 * Get single deceased alumni detail
 */
export async function getDeceasedAlumniById(req, res) {
    try {
        const id = String(req.params.id);
        const currentUserId = req.user?.id;
        const now = new Date();
        const item = await prisma.deceasedAlumni.findUnique({
            where: { id },
            include: {
                flowers: {
                    where: { expiresAt: { gt: now } },
                },
                prayers: {
                    include: {
                        author: {
                            include: { profile: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                _count: {
                    select: { prayers: true },
                },
            },
        });
        if (!item) {
            res.status(404).json({ success: false, message: 'Data alumni tidak ditemukan.' });
            return;
        }
        const userFlower = currentUserId
            ? item.flowers.find((f) => f.userId === currentUserId)
            : null;
        res.json({
            success: true,
            data: {
                id: item.id,
                fullName: item.fullName,
                nickname: item.nickname,
                className: item.className,
                photoUrl: item.photoUrl,
                passedAwayYear: item.passedAwayYear,
                passedAwayDate: item.passedAwayDate,
                bio: item.bio,
                flowerCount: item.flowers.length,
                prayerCount: item._count?.prayers || 0,
                hasGivenFlower: Boolean(userFlower),
                flowerExpiresAt: userFlower ? userFlower.expiresAt.toISOString() : null,
                prayers: item.prayers.map((p) => ({
                    id: p.id,
                    deceasedId: p.deceasedId,
                    authorId: p.authorId,
                    authorName: p.author?.profile?.fullName || p.author?.email || 'Alumni 99',
                    authorNickname: p.author?.profile?.nickname,
                    authorPhotoUrl: p.author?.profile?.profilePhotoUrl,
                    authorClass: p.author?.profile?.className || 'Alumni 99',
                    text: p.text,
                    createdAt: p.createdAt.toISOString(),
                })),
            },
        });
    }
    catch (error) {
        console.error('Error fetching deceased detail:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat detail alumni.' });
    }
}
/**
 * POST /api/v1/memorial/:id/flowers
 * Give flower to deceased alumni (valid for 30 days)
 */
export async function giveFlower(req, res) {
    try {
        const deceasedId = String(req.params.id);
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const deceased = await prisma.deceasedAlumni.findUnique({
            where: { id: deceasedId },
        });
        if (!deceased) {
            res.status(404).json({ success: false, message: 'Data alumni tidak ditemukan.' });
            return;
        }
        const now = new Date();
        // Check if user already gave an active flower (expiresAt > now)
        const existingFlower = await prisma.memorialFlower.findFirst({
            where: {
                deceasedId,
                userId,
                expiresAt: { gt: now },
            },
        });
        if (existingFlower) {
            const daysRemaining = Math.max(1, Math.ceil((existingFlower.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            res.status(400).json({
                success: false,
                message: `Bunga harum Anda masih mekar untuk almarhum/almarhumah (${daysRemaining} hari tersisa). Anda dapat menaburkan bunga kembali setelah masa aktif 1 bulan selesai.`,
                daysRemaining,
                expiresAt: existingFlower.expiresAt.toISOString(),
            });
            return;
        }
        // Set 30 days expiration
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const newFlower = await prisma.memorialFlower.create({
            data: {
                deceasedId,
                userId,
                expiresAt,
            },
        });
        // Count total active flowers
        const activeFlowerCount = await prisma.memorialFlower.count({
            where: {
                deceasedId,
                expiresAt: { gt: now },
            },
        });
        res.json({
            success: true,
            message: 'Bunga harum dan doa Anda telah berhasil ditaburkan.',
            flowerCount: activeFlowerCount,
            hasGivenFlower: true,
            flowerExpiresAt: newFlower.expiresAt.toISOString(),
        });
    }
    catch (error) {
        console.error('Error giving memorial flower:', error);
        res.status(500).json({ success: false, message: 'Gagal memberikan bunga memorial.' });
    }
}
/**
 * GET /api/v1/memorial/:id/prayers
 * Fetch all prayers for a deceased alumni
 */
export async function getPrayers(req, res) {
    try {
        const deceasedId = String(req.params.id);
        const prayers = await prisma.memorialPrayer.findMany({
            where: { deceasedId },
            include: {
                author: {
                    include: {
                        profile: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        const formatted = prayers.map((p) => ({
            id: p.id,
            deceasedId: p.deceasedId,
            authorId: p.authorId,
            authorName: p.author?.profile?.fullName || p.author?.email || 'Alumni 99',
            authorNickname: p.author?.profile?.nickname,
            authorPhotoUrl: p.author?.profile?.profilePhotoUrl,
            authorClass: p.author?.profile?.className || 'Alumni 99',
            text: p.text,
            createdAt: p.createdAt.toISOString(),
        }));
        res.json({
            success: true,
            data: formatted,
        });
    }
    catch (error) {
        console.error('Error fetching prayers:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat untaian doa.' });
    }
}
/**
 * POST /api/v1/memorial/:id/prayers
 * Submit a prayer for a deceased alumni
 */
export async function submitPrayer(req, res) {
    try {
        const deceasedId = String(req.params.id);
        const userId = req.user?.id;
        const { text } = req.body;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        if (!text || !text.trim()) {
            res.status(400).json({ success: false, message: 'Isi doa tidak boleh kosong.' });
            return;
        }
        const deceased = await prisma.deceasedAlumni.findUnique({
            where: { id: deceasedId },
        });
        if (!deceased) {
            res.status(404).json({ success: false, message: 'Data alumni tidak ditemukan.' });
            return;
        }
        const prayer = await prisma.memorialPrayer.create({
            data: {
                deceasedId,
                authorId: userId,
                text: text.trim(),
            },
            include: {
                author: {
                    include: {
                        profile: true,
                    },
                },
            },
        });
        const totalPrayers = await prisma.memorialPrayer.count({
            where: { deceasedId },
        });
        res.status(201).json({
            success: true,
            message: 'Doa tulus Anda telah terkirim.',
            prayerCount: totalPrayers,
            data: {
                id: prayer.id,
                deceasedId: prayer.deceasedId,
                authorId: prayer.authorId,
                authorName: prayer.author?.profile?.fullName || prayer.author?.email || 'Alumni 99',
                authorNickname: prayer.author?.profile?.nickname,
                authorPhotoUrl: prayer.author?.profile?.profilePhotoUrl,
                authorClass: prayer.author?.profile?.className || 'Alumni 99',
                text: prayer.text,
                createdAt: prayer.createdAt.toISOString(),
            },
        });
    }
    catch (error) {
        console.error('Error submitting prayer:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirimkan doa.' });
    }
}
/**
 * DELETE /api/v1/memorial/prayers/:prayerId
 * Delete a prayer (Author or Admin)
 */
export async function deletePrayer(req, res) {
    try {
        const prayerId = String(req.params.prayerId);
        const userId = req.user?.id;
        const userRoles = req.user?.roles || [];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const prayer = await prisma.memorialPrayer.findUnique({
            where: { id: prayerId },
        });
        if (!prayer) {
            res.status(404).json({ success: false, message: 'Doa tidak ditemukan.' });
            return;
        }
        const isAdmin = userRoles.includes('admin') ||
            userRoles.includes('moderator') ||
            userRoles.includes('super_admin');
        const isAuthor = prayer.authorId === userId;
        if (!isAdmin && !isAuthor) {
            res.status(403).json({
                success: false,
                message: 'Hanya pengirim doa atau admin yang dapat menghapus doa ini.',
            });
            return;
        }
        await prisma.memorialPrayer.delete({
            where: { id: prayerId },
        });
        const totalPrayers = await prisma.memorialPrayer.count({
            where: { deceasedId: prayer.deceasedId },
        });
        res.json({
            success: true,
            message: 'Doa berhasil dihapus.',
            prayerCount: totalPrayers,
            deceasedId: prayer.deceasedId,
        });
    }
    catch (error) {
        console.error('Error deleting prayer:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus doa.' });
    }
}
/**
 * POST /api/v1/memorial
 * Create a new deceased alumni record (Admin or contributor)
 */
export async function createDeceasedAlumni(req, res) {
    try {
        const userId = req.user?.id;
        const { fullName, nickname, className, photoUrl, passedAwayYear, passedAwayDate, bio } = req.body;
        if (!fullName || !passedAwayYear) {
            res.status(400).json({ success: false, message: 'Nama lengkap dan tahun wafat wajib diisi.' });
            return;
        }
        const created = await prisma.deceasedAlumni.create({
            data: {
                fullName,
                nickname: nickname || null,
                className: className || null,
                photoUrl: photoUrl || null,
                passedAwayYear: Number(passedAwayYear),
                passedAwayDate: passedAwayDate || null,
                bio: bio || null,
                createdById: userId || null,
            },
        });
        res.status(201).json({
            success: true,
            message: 'Data alumni in memoriam berhasil ditambahkan.',
            data: created,
        });
    }
    catch (error) {
        console.error('Error creating deceased alumni:', error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan data alumni.' });
    }
}
/**
 * DELETE /api/v1/memorial/:id
 * Delete a deceased alumni record (Admin, moderator, or creator)
 */
export async function deleteDeceasedAlumni(req, res) {
    try {
        const id = String(req.params.id);
        const userId = req.user?.id;
        const userRoles = req.user?.roles || [];
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const item = await prisma.deceasedAlumni.findUnique({
            where: { id },
        });
        if (!item) {
            res.status(404).json({ success: false, message: 'Data alumni tidak ditemukan.' });
            return;
        }
        const isAdmin = userRoles.includes('admin') ||
            userRoles.includes('moderator') ||
            userRoles.includes('super_admin');
        const isCreator = item.createdById === userId;
        if (!isAdmin && !isCreator) {
            res.status(403).json({
                success: false,
                message: 'Hanya admin, moderator, atau pengisi data awal yang dapat menghapus data ini.',
            });
            return;
        }
        await prisma.deceasedAlumni.delete({
            where: { id },
        });
        res.json({
            success: true,
            message: 'Data alumni in memoriam berhasil dihapus.',
        });
    }
    catch (error) {
        console.error('Error deleting deceased alumni:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus data alumni.' });
    }
}
