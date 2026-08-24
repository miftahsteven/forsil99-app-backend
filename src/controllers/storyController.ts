import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { optimizeImageBase64 } from '../services/imageService.js';

export const storyController = {
  /**
   * GET /api/v1/stories
   */
  async getActiveStories(req: Request, res: Response): Promise<void> {
    const currentUserId = req.user?.id;
    const now = new Date();

    // If user is not authenticated, return empty stories
    if (!currentUserId) {
      res.json({
        success: true,
        stories: [],
      });
      return;
    }

    // 1. Get list of user IDs that current user follows
    const follows = await prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });
    const followingIds = new Set(follows.map((f) => f.followingId));

    // Get current user's profile info
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: { profile: true },
    });
    const currentUserClass = currentUser?.profile?.className || undefined;

    // 2. Fetch all ACTIVE stories (expiresAt > now)
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

    // 3. Filter stories:
    // Only include if story author is current user (self) OR someone current user follows
    // (If a followed user has no active stories, they will NOT appear because they have no rows in active stories)
    const visibleStories = stories.filter((s) => {
      const isOwner = s.authorId === currentUserId;
      const isFollowed = followingIds.has(s.authorId);

      // Only display self stories or followed users' stories
      if (!isOwner && !isFollowed) {
        return false;
      }

      // Check same_class privacy if configured
      if (s.visibility === 'same_class') {
        const authorClass = s.author?.profile?.className;
        if (isOwner) return true;
        if (currentUserClass && authorClass && currentUserClass === authorClass) return true;
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
        authorNickname: s.author?.profile?.nickname || undefined,
        authorPhotoUrl: s.author?.profile?.profilePhotoUrl,
        authorClass: s.author?.profile?.className || 'Alumni 59',
        isOwner: s.authorId === currentUserId,
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
  async createStory(req: Request, res: Response): Promise<void> {
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

    let finalMediaUrl = mediaUrl;
    if (mediaType === 'image' && typeof mediaUrl === 'string' && mediaUrl.startsWith('data:image')) {
      finalMediaUrl = await optimizeImageBase64(mediaUrl, { imageCount: 1, maxDimension: 1200, quality: 75 });
    }

    // 24 hours expiry
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        authorId,
        mediaUrl: finalMediaUrl,
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
