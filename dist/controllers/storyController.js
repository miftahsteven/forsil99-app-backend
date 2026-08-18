import { prisma } from '../lib/prisma.js';
export const storyController = {
    /**
     * GET /api/v1/stories
     */
    async getActiveStories(req, res) {
        const currentUserId = req.user?.id;
        const now = new Date();
        const stories = await prisma.story.findMany({
            where: {
                expiresAt: { gt: now },
            },
            include: {
                author: {
                    include: { profile: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        let currentUserClass = undefined;
        if (currentUserId) {
            const currentUser = await prisma.user.findUnique({
                where: { id: currentUserId },
                include: { profile: true },
            });
            currentUserClass = currentUser?.profile?.className || undefined;
        }
        const visibleStories = stories.filter((s) => {
            if (s.visibility === 'same_class') {
                const authorClass = s.author?.profile?.className;
                if (s.authorId === currentUserId)
                    return true;
                if (currentUserClass && authorClass && currentUserClass === authorClass)
                    return true;
                return false;
            }
            return true;
        });
        res.json({
            success: true,
            stories: visibleStories.map((s) => ({
                id: s.id,
                authorId: s.authorId,
                authorName: s.author?.profile?.fullName || 'Alumni 59',
                authorPhotoUrl: s.author?.profile?.profilePhotoUrl,
                authorClass: s.author?.profile?.className || 'Alumni 59',
                mediaType: s.mediaType,
                mediaUrl: s.mediaUrl,
                caption: s.caption || undefined,
                visibility: s.visibility,
                createdAt: s.createdAt.toISOString(),
                expiresAt: s.expiresAt.toISOString(),
            })),
        });
    },
    /**
     * POST /api/v1/stories
     */
    async createStory(req, res) {
        const authorId = req.user?.id;
        if (!authorId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const { mediaUrl, mediaType = 'image', caption = '', visibility = 'verified_alumni' } = req.body;
        if (!mediaUrl) {
            res.status(400).json({ success: false, message: 'Media cerita tidak boleh kosong.' });
            return;
        }
        // 24 hours expiry
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const story = await prisma.story.create({
            data: {
                authorId,
                mediaUrl,
                mediaType,
                caption,
                visibility,
                expiresAt,
            },
            include: {
                author: {
                    include: { profile: true },
                },
            },
        });
        res.status(201).json({
            success: true,
            message: 'Cerita berhasil dipublikasikan.',
            story: {
                id: story.id,
                authorId: story.authorId,
                authorName: story.author?.profile?.fullName || 'Alumni 59',
                authorPhotoUrl: story.author?.profile?.profilePhotoUrl,
                authorClass: story.author?.profile?.className || 'Alumni 59',
                mediaType: story.mediaType,
                mediaUrl: story.mediaUrl,
                caption: story.caption || undefined,
                visibility: story.visibility,
                createdAt: story.createdAt.toISOString(),
                expiresAt: story.expiresAt.toISOString(),
            },
        });
    },
};
