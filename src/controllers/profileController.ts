import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { formatProfileResponse } from './authController.js';
import { getParam } from '../lib/paramHelper.js';
import { sendPushNotification } from '../services/firebase/firebaseAdmin.js';
import { optimizeImageBase64 } from '../services/imageService.js';

async function resolveUserId(identifier: string): Promise<string | null> {
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
  async getProfiles(req: Request, res: Response): Promise<void> {
    const { q, kelas, kota, profesi, seller } = req.query;

    const where: any = {};

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

    const currentUserId = req.user?.id;
    let followingSet = new Set<string>();
    if (currentUserId) {
      const myFollows = await prisma.follow.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true },
      });
      followingSet = new Set(myFollows.map((f) => f.followingId));
    }

    const profiles = await prisma.profile.findMany({
      where,
      select: {
        id: true,
        userId: true,
        fullName: true,
        nickname: true,
        profilePhotoUrl: true,
        className: true,
        major: true,
        graduationYear: true,
        nia: true,
        city: true,
        province: true,
        occupation: true,
        company: true,
        businessField: true,
        bio: true,
        skills: true,
        interests: true,
        sellerStatus: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({
      success: true,
      profiles: profiles.map((p) => {
        const formatted = formatProfileResponse(p);
        return {
          ...formatted,
          isFollowing: followingSet.has(p.userId) || followingSet.has(p.id),
        };
      }),
    });
  },

  /**
   * GET /api/v1/profiles/:id
   */
  async getProfileById(req: Request, res: Response): Promise<void> {
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

    const currentUserId = req.user?.id;
    let isFollowing = false;
    if (currentUserId && profile.userId !== currentUserId) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: profile.userId,
          },
        },
      });
      isFollowing = Boolean(follow);
    }

    res.json({
      success: true,
      profile: {
        ...formatProfileResponse(profile),
        isFollowing,
      },
    });
  },

  /**
   * PUT /api/v1/profiles/me
   */
  async updateMyProfile(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
      return;
    }

    const {
      fullName,
      nickname,
      bio,
      className,
      occupation,
      company,
      businessField,
      city,
      province,
      profilePhotoUrl,
      coverPhotoUrl,
      skills,
      interests,
      socialLinks,
      privacy,
    } = req.body;

    const searchKeywords = [
      fullName?.toLowerCase(),
      nickname?.toLowerCase(),
      className?.toLowerCase(),
      occupation?.toLowerCase(),
      city?.toLowerCase(),
    ].filter(Boolean);

    let finalProfilePhotoUrl = profilePhotoUrl;
    if (profilePhotoUrl && typeof profilePhotoUrl === 'string' && profilePhotoUrl.startsWith('data:image')) {
      finalProfilePhotoUrl = await optimizeImageBase64(profilePhotoUrl, { maxDimension: 600, quality: 80 });
    }

    let finalCoverPhotoUrl = coverPhotoUrl;
    if (coverPhotoUrl && typeof coverPhotoUrl === 'string' && coverPhotoUrl.startsWith('data:image')) {
      finalCoverPhotoUrl = await optimizeImageBase64(coverPhotoUrl, { maxDimension: 1200, quality: 80 });
    }

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
        ...(profilePhotoUrl !== undefined ? { profilePhotoUrl: finalProfilePhotoUrl } : {}),
        ...(coverPhotoUrl !== undefined ? { coverPhotoUrl: finalCoverPhotoUrl } : {}),
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
  async toggleFollow(req: Request, res: Response): Promise<void> {
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
    } else {
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
      }).catch(() => {});
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
  async getFollowStatus(req: Request, res: Response): Promise<void> {
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
  async getFollowers(req: Request, res: Response): Promise<void> {
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

    const currentUserId = req.user?.id;
    let followingSet = new Set<string>();
    if (currentUserId) {
      const myFollows = await prisma.follow.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true },
      });
      followingSet = new Set(myFollows.map((f) => f.followingId));
    }

    const followers = follows
      .map((f) => f.follower.profile)
      .filter(Boolean)
      .map((p: any) => ({
        ...formatProfileResponse(p),
        isFollowing: followingSet.has(p.userId) || followingSet.has(p.id),
      }));

    res.json({
      success: true,
      followers,
      count: followers.length,
    });
  },

  /**
   * GET /api/v1/profiles/:id/following
   */
  async getFollowing(req: Request, res: Response): Promise<void> {
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

    const currentUserId = req.user?.id;
    let followingSet = new Set<string>();
    if (currentUserId) {
      const myFollows = await prisma.follow.findMany({
        where: { followerId: currentUserId },
        select: { followingId: true },
      });
      followingSet = new Set(myFollows.map((f) => f.followingId));
    }

    const following = follows
      .map((f) => f.following.profile)
      .filter(Boolean)
      .map((p: any) => ({
        ...formatProfileResponse(p),
        isFollowing: followingSet.has(p.userId) || followingSet.has(p.id),
      }));

    res.json({
      success: true,
      following,
      count: following.length,
    });
  },
};
