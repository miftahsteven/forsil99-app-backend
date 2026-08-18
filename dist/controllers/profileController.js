import { prisma } from '../lib/prisma.js';
import { formatProfileResponse } from './authController.js';
import { getParam } from '../lib/paramHelper.js';
import { sendPushNotification } from '../services/firebase/firebaseAdmin.js';
async function resolveUserId(identifier) {
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { id: identifier },
                { profile: { id: identifier } },
                { profile: { userId: identifier } },
                { email: identifier },
            ],
        },
    });
    return user ? user.id : null;
}
export const profileController = {
    /**
     * GET /api/v1/profiles
     */
    async getProfiles(req, res) {
        const { q, kelas, kota, profesi, seller } = req.query;
        const where = {};
        if (q && typeof q === 'string' && q.trim().length > 0) {
            const searchTerm = q.trim().toLowerCase();
            where.OR = [
                { fullName: { contains: searchTerm, mode: 'insensitive' } },
                { nickname: { contains: searchTerm, mode: 'insensitive' } },
                { className: { contains: searchTerm, mode: 'insensitive' } },
                { occupation: { contains: searchTerm, mode: 'insensitive' } },
                { company: { contains: searchTerm, mode: 'insensitive' } },
                { city: { contains: searchTerm, mode: 'insensitive' } },
            ];
        }
        if (kelas && kelas !== 'all') {
            where.className = String(kelas);
        }
        if (kota && kota !== 'all') {
            where.city = { contains: String(kota), mode: 'insensitive' };
        }
        if (profesi && profesi !== 'all') {
            where.occupation = { contains: String(profesi), mode: 'insensitive' };
        }
        if (seller === 'true') {
            where.sellerStatus = 'approved';
        }
        const profiles = await prisma.profile.findMany({
            where,
            orderBy: { fullName: 'asc' },
        });
        res.json({
            success: true,
            profiles: profiles.map(formatProfileResponse),
        });
    },
    /**
     * GET /api/v1/profiles/:id
     */
    async getProfileById(req, res) {
        const id = getParam(req.params.id);
        const profile = await prisma.profile.findFirst({
            where: {
                OR: [{ id }, { userId: id }],
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        phoneNumber: true,
                        roles: true,
                        verificationStatus: true,
                        createdAt: true,
                    },
                },
            },
        });
        if (!profile) {
            res.status(404).json({ success: false, message: 'Profil alumni tidak ditemukan.' });
            return;
        }
        res.json({
            success: true,
            profile: formatProfileResponse(profile),
        });
    },
    /**
     * PUT /api/v1/profiles/me
     */
    async updateMyProfile(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const { fullName, nickname, bio, className, occupation, company, businessField, city, province, profilePhotoUrl, coverPhotoUrl, skills, interests, socialLinks, privacy, } = req.body;
        const searchKeywords = [
            fullName?.toLowerCase(),
            nickname?.toLowerCase(),
            className?.toLowerCase(),
            occupation?.toLowerCase(),
            city?.toLowerCase(),
        ].filter(Boolean);
        const profile = await prisma.profile.upsert({
            where: { userId },
            update: {
                ...(fullName ? { fullName } : {}),
                ...(nickname !== undefined ? { nickname } : {}),
                ...(bio !== undefined ? { bio } : {}),
                ...(className ? { className } : {}),
                ...(occupation !== undefined ? { occupation } : {}),
                ...(company !== undefined ? { company } : {}),
                ...(businessField !== undefined ? { businessField } : {}),
                ...(city !== undefined ? { city } : {}),
                ...(province !== undefined ? { province } : {}),
                ...(profilePhotoUrl !== undefined ? { profilePhotoUrl } : {}),
                ...(coverPhotoUrl !== undefined ? { coverPhotoUrl } : {}),
                ...(skills ? { skills } : {}),
                ...(interests ? { interests } : {}),
                ...(socialLinks ? { socialLinks } : {}),
                ...(privacy ? { privacy } : {}),
                searchKeywords,
            },
            create: {
                userId,
                fullName: fullName || 'Alumni SMAN 59',
                nickname,
                bio,
                className: className || '3 IPA 1',
                occupation,
                company,
                businessField,
                city,
                province,
                profilePhotoUrl,
                coverPhotoUrl,
                skills: skills || [],
                interests: interests || [],
                socialLinks: socialLinks || {},
                privacy: privacy || {},
                searchKeywords,
            },
        });
        res.json({
            success: true,
            message: 'Profil berhasil diperbarui.',
            profile: formatProfileResponse(profile),
        });
    },
    /**
     * POST /api/v1/profiles/:id/follow
     * Toggle follow a user
     */
    async toggleFollow(req, res) {
        const currentUserId = req.user?.id;
        if (!currentUserId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const targetParam = getParam(req.params.id);
        const targetUserId = await resolveUserId(targetParam);
        if (!targetUserId) {
            res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
            return;
        }
        if (currentUserId === targetUserId) {
            res.status(400).json({ success: false, message: 'Anda tidak dapat mengikuti akun sendiri.' });
            return;
        }
        const existingFollow = await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: currentUserId,
                    followingId: targetUserId,
                },
            },
        });
        let isFollowing = false;
        if (existingFollow) {
            await prisma.follow.delete({
                where: { id: existingFollow.id },
            });
            isFollowing = false;
        }
        else {
            await prisma.follow.create({
                data: {
                    followerId: currentUserId,
                    followingId: targetUserId,
                },
            });
            isFollowing = true;
            // Send push notification
            const myProfile = await prisma.profile.findUnique({ where: { userId: currentUserId } });
            sendPushNotification({
                recipientId: targetUserId,
                actorName: myProfile?.fullName || 'Rekan Alumni',
                type: 'verification',
                title: 'Pengikut Baru 🎉',
                body: `${myProfile?.fullName || 'Rekan Alumni'} mulai mengikuti profil Anda di Forsil 99.`,
            }).catch(() => { });
        }
        const [followersCount, followingCount] = await Promise.all([
            prisma.follow.count({ where: { followingId: targetUserId } }),
            prisma.follow.count({ where: { followerId: targetUserId } }),
        ]);
        res.json({
            success: true,
            isFollowing,
            followersCount,
            followingCount,
            message: isFollowing ? 'Berhasil mengikuti.' : 'Berhenti mengikuti.',
        });
    },
    /**
     * GET /api/v1/profiles/:id/follow-status
     */
    async getFollowStatus(req, res) {
        const currentUserId = req.user?.id;
        const targetParam = getParam(req.params.id);
        const targetUserId = await resolveUserId(targetParam);
        if (!targetUserId) {
            res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
            return;
        }
        let isFollowing = false;
        if (currentUserId && currentUserId !== targetUserId) {
            const follow = await prisma.follow.findUnique({
                where: {
                    followerId_followingId: {
                        followerId: currentUserId,
                        followingId: targetUserId,
                    },
                },
            });
            isFollowing = Boolean(follow);
        }
        const [followersCount, followingCount] = await Promise.all([
            prisma.follow.count({ where: { followingId: targetUserId } }),
            prisma.follow.count({ where: { followerId: targetUserId } }),
        ]);
        res.json({
            success: true,
            isFollowing,
            followersCount,
            followingCount,
        });
    },
    /**
     * GET /api/v1/profiles/:id/followers
     */
    async getFollowers(req, res) {
        const targetParam = getParam(req.params.id);
        const targetUserId = await resolveUserId(targetParam);
        if (!targetUserId) {
            res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
            return;
        }
        const follows = await prisma.follow.findMany({
            where: { followingId: targetUserId },
            include: {
                follower: {
                    include: { profile: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const followers = follows
            .map((f) => f.follower.profile)
            .filter(Boolean)
            .map(formatProfileResponse);
        res.json({
            success: true,
            followers,
            count: followers.length,
        });
    },
    /**
     * GET /api/v1/profiles/:id/following
     */
    async getFollowing(req, res) {
        const targetParam = getParam(req.params.id);
        const targetUserId = await resolveUserId(targetParam);
        if (!targetUserId) {
            res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
            return;
        }
        const follows = await prisma.follow.findMany({
            where: { followerId: targetUserId },
            include: {
                following: {
                    include: { profile: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const following = follows
            .map((f) => f.following.profile)
            .filter(Boolean)
            .map(formatProfileResponse);
        res.json({
            success: true,
            following,
            count: following.length,
        });
    },
};
