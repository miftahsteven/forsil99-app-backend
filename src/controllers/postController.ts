import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendPushNotification } from '../services/firebase/firebaseAdmin.js';
import { getParam } from '../lib/paramHelper.js';

export function formatPostResponse(post: any, currentUserId?: string) {
  const authorProfile = post.author?.profile;
  const userReactionObj = currentUserId
    ? post.reactions?.find((r: any) => r.userId === currentUserId)
    : undefined;

  const reactors = (post.reactions || []).map((r: any) => ({
    uid: r.userId,
    reaction: r.reactionType,
    fullName: r.user?.profile?.fullName || 'Alumni',
    nickname: r.user?.profile?.nickname || '',
    photoUrl: r.user?.profile?.profilePhotoUrl,
    className: r.user?.profile?.className || 'Alumni 59',
  }));

  const comments = (post.comments || []).map((c: any) => ({
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    authorName: c.author?.profile?.fullName || 'Alumni 59',
    authorPhotoUrl: c.author?.profile?.profilePhotoUrl || undefined,
    authorClass: c.author?.profile?.className || 'Alumni 59',
    authorIsVerified: c.author?.verificationStatus === 'approved',
    text: c.text,
    parentId: c.parentId || undefined,
    likeCount: c.likeCount || 0,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  }));

  return {
    id: post.id,
    authorId: post.authorId,
    authorName: authorProfile?.fullName || 'Alumni 59',
    authorNickname: authorProfile?.nickname || undefined,
    authorPhotoUrl: authorProfile?.profilePhotoUrl || undefined,
    authorClass: authorProfile?.className || 'Alumni 59',
    authorIsVerified: post.author?.verificationStatus === 'approved',
    type: post.type,
    text: post.text,
    media: Array.isArray(post.media) ? post.media : [],
    visibility: post.visibility,
    memoryMeta: post.memoryMeta || undefined,
    shopCategory: (post.memoryMeta as any)?.shopCategory || undefined,
    price: (post.memoryMeta as any)?.price || undefined,
    linkedProductId: post.linkedProductId || undefined,
    linkedEventId: post.linkedEventId || undefined,
    reactionCount: post.reactionCount ?? (post.reactions ? post.reactions.length : 0),
    userReaction: userReactionObj ? userReactionObj.reactionType : undefined,
    reactors,
    comments,
    commentCount: post.comments ? post.comments.length : (post.commentCount || 0),
    saveCount: post.saveCount || 0,
    isPinned: post.isPinned || false,
    commentsEnabled: post.commentsEnabled ?? true,
    moderationStatus: post.moderationStatus || 'visible',
    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
    updatedAt: post.updatedAt instanceof Date ? post.updatedAt.toISOString() : post.updatedAt,
  };
}

export const postController = {
  /**
   * GET /api/v1/posts
   */
  async getPosts(req: Request, res: Response): Promise<void> {
    const currentUserId = req.user?.id;
    const { type, q } = req.query;

    const where: any = {
      moderationStatus: 'visible',
    };

    if (type && type !== 'all') {
      where.type = String(type);
    } else {
      // By default (general timeline), exclude seller product shares (shop_share)
      where.type = { not: 'shop_share' };
    }

    if (q && typeof q === 'string' && q.trim().length > 0) {
      where.text = { contains: q.trim(), mode: 'insensitive' };
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        author: {
          include: { profile: true },
        },
        reactions: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        comments: {
          include: {
            author: {
              include: { profile: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    let currentUserClass: string | undefined = undefined;
    if (currentUserId) {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        include: { profile: true },
      });
      currentUserClass = currentUser?.profile?.className || undefined;
    }

    const visiblePosts = posts.filter((p) => {
      if (p.visibility === 'same_class') {
        const postAuthorClass = p.author?.profile?.className;
        if (p.authorId === currentUserId) return true;
        if (currentUserClass && postAuthorClass && currentUserClass === postAuthorClass) return true;
        return false;
      }
      return true;
    });

    res.json({
      success: true,
      posts: visiblePosts.map((p) => formatPostResponse(p, currentUserId)),
    });
  },

  /**
   * POST /api/v1/posts
   */
  async createPost(req: Request, res: Response): Promise<void> {
    const authorId = req.user?.id;
    if (!authorId) {
      res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
      return;
    }

    const {
      type = 'standard',
      text = '',
      media = [],
      visibility = 'verified_alumni',
      memoryMeta,
      shopCategory,
      price,
      linkedProductId,
      linkedEventId,
      commentsEnabled = true,
    } = req.body;

    const mergedMemoryMeta = {
      ...(typeof memoryMeta === 'object' && memoryMeta !== null ? memoryMeta : {}),
      ...(shopCategory ? { shopCategory } : {}),
      ...(price ? { price: Number(price) } : {}),
    };

    let actualLinkedProductId = linkedProductId;

    // If this is a shop_share post, ensure the user has a Shop and create an associated Product
    if (type === 'shop_share') {
      try {
        let userShop = await prisma.shop.findFirst({
          where: { ownerId: authorId },
        });

        if (!userShop) {
          const authorProfile = await prisma.profile.findUnique({
            where: { userId: authorId },
          });
          userShop = await prisma.shop.create({
            data: {
              ownerId: authorId,
              name: `Lapak ${authorProfile?.fullName || 'Alumni 59'}`,
              description: `Etalase produk dan jasa resmi alumni 59`,
              status: 'approved',
              categoryIds: [shopCategory || 'lainnya'],
            },
          });
        }

        const categoryNamesMap: Record<string, string> = {
          makanan: 'Makanan & Kuliner',
          minuman: 'Minuman & Kopi',
          fashion: 'Pakaian & Fashion',
          elektronik: 'Elektronik & Gadget',
          kesehatan_kecantikan: 'Kecantikan & Kesehatan',
          jasa_layanan: 'Jasa & Layanan Profesional',
          otomotif: 'Otomotif & Aksesoris',
          properti: 'Properti & Hunian',
          lainnya: 'Lain-lain',
        };

        const catKey = shopCategory || 'lainnya';
        const catName = categoryNamesMap[catKey] || 'Aneka Produk';
        const firstLine = (text || '').trim().split('\n')[0] || '';
        const prodName = firstLine.slice(0, 60) || 'Lapak Seller 99';
        const mediaUrls = Array.isArray(media) ? media.map((m: any) => m.url).filter(Boolean) : [];
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const createdProduct = await prisma.product.create({
          data: {
            shopId: userShop.id,
            ownerId: authorId,
            name: prodName,
            description: text,
            categoryId: catKey,
            categoryName: catName,
            price: price ? Number(price) : undefined,
            imageUrls: mediaUrls,
            expiresAt,
            status: 'active',
          },
        });
        actualLinkedProductId = createdProduct.id;
      } catch (err) {
        console.warn('Auto-create product for shop_share error:', err);
      }
    }

    const post = await prisma.post.create({
      data: {
        authorId,
        type,
        text,
        media: Array.isArray(media) ? media : [],
        visibility,
        memoryMeta: mergedMemoryMeta,
        linkedProductId: actualLinkedProductId,
        linkedEventId,
        commentsEnabled,
      },
      include: {
        author: {
          include: { profile: true },
        },
        reactions: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Postingan berhasil diterbitkan.',
      post: formatPostResponse(post, authorId),
    });
  },

  /**
   * GET /api/v1/posts/:id
   */
  async getPostById(req: Request, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const currentUserId = req.user?.id;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: { include: { profile: true } },
        reactions: {
          include: {
            user: { include: { profile: true } },
          },
        },
        comments: {
          include: {
            author: { include: { profile: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!post) {
      res.status(404).json({ success: false, message: 'Postingan tidak ditemukan.' });
      return;
    }

    res.json({
      success: true,
      post: formatPostResponse(post, currentUserId),
    });
  },

  /**
   * PUT /api/v1/posts/:id
   */
  async updatePost(req: Request, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const userId = req.user?.id;

    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Postingan tidak ditemukan.' });
      return;
    }

    if (existing.authorId !== userId && !req.user?.roles.includes('admin')) {
      res.status(403).json({ success: false, message: 'Anda tidak memiliki hak untuk mengedit postingan ini.' });
      return;
    }

    const { text, media, visibility } = req.body;

    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...(text !== undefined ? { text } : {}),
        ...(media !== undefined ? { media } : {}),
        ...(visibility !== undefined ? { visibility } : {}),
      },
      include: {
        author: { include: { profile: true } },
        reactions: true,
      },
    });

    res.json({
      success: true,
      message: 'Postingan berhasil diperbarui.',
      post: formatPostResponse(updated, userId),
    });
  },

  /**
   * DELETE /api/v1/posts/:id
   */
  async deletePost(req: Request, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const userId = req.user?.id;

    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Postingan tidak ditemukan.' });
      return;
    }

    if (existing.authorId !== userId && !req.user?.roles.includes('admin')) {
      res.status(403).json({ success: false, message: 'Anda tidak memiliki hak untuk menghapus postingan ini.' });
      return;
    }

    await prisma.post.delete({ where: { id } });

    res.json({ success: true, message: 'Postingan berhasil dihapus.' });
  },

  /**
   * POST /api/v1/posts/:id/react
   */
  async reactToPost(req: Request, res: Response): Promise<void> {
    const postId = getParam(req.params.id);
    const userId = req.user?.id;
    const { reactionType } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { author: { include: { profile: true } } },
    });

    if (!post) {
      res.status(404).json({ success: false, message: 'Postingan tidak ditemukan.' });
      return;
    }

    const existingReaction = await prisma.postReaction.findUnique({
      where: {
        postId_userId: { postId, userId },
      },
    });

    let newReaction: string | null = null;

    if (existingReaction) {
      if (existingReaction.reactionType === reactionType) {
        await prisma.postReaction.delete({
          where: { id: existingReaction.id },
        });
        await prisma.post.update({
          where: { id: postId },
          data: { reactionCount: { decrement: 1 } },
        });
        newReaction = null;
      } else {
        await prisma.postReaction.update({
          where: { id: existingReaction.id },
          data: { reactionType },
        });
        newReaction = reactionType;
      }
    } else {
      await prisma.postReaction.create({
        data: {
          postId,
          userId,
          reactionType,
        },
      });
      await prisma.post.update({
        where: { id: postId },
        data: { reactionCount: { increment: 1 } },
      });
      newReaction = reactionType;

      if (post.authorId !== userId) {
        const actorProfile = await prisma.profile.findUnique({ where: { userId } });
        const reactionLabel =
          reactionType === 'kangen' ? 'Kangen' : reactionType === 'salut' ? 'Salut' : 'Suka';

        await sendPushNotification({
          recipientId: post.authorId,
          actorName: actorProfile?.fullName || 'Rekan Alumni',
          actorPhotoUrl: actorProfile?.profilePhotoUrl || undefined,
          type: 'reaction',
          title: 'Reaksi Baru',
          body: `${actorProfile?.fullName || 'Rekan Alumni'} memberi reaksi "${reactionLabel}" pada postingan Anda.`,
          data: { postId },
        });
      }
    }

    const totalReactions = await prisma.postReaction.count({ where: { postId } });

    res.json({
      success: true,
      reactionCount: totalReactions,
      userReaction: newReaction,
    });
  },

  /**
   * GET /api/v1/posts/:id/comments
   */
  async getComments(req: Request, res: Response): Promise<void> {
    const postId = getParam(req.params.id);

    const comments = await prisma.comment.findMany({
      where: { postId },
      include: {
        author: { include: { profile: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      comments: comments.map((c) => ({
        id: c.id,
        postId: c.postId,
        authorId: c.authorId,
        authorName: c.author?.profile?.fullName || 'Alumni 59',
        authorPhotoUrl: c.author?.profile?.profilePhotoUrl || undefined,
        authorClass: c.author?.profile?.className || 'Alumni 59',
        authorIsVerified: c.author?.verificationStatus === 'approved',
        text: c.text,
        parentId: c.parentId || undefined,
        likeCount: c.likeCount,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  },

  /**
   * POST /api/v1/posts/:id/comments
   */
  async addComment(req: Request, res: Response): Promise<void> {
    const postId = getParam(req.params.id);
    const authorId = req.user?.id;
    const { text, parentId } = req.body;

    if (!authorId) {
      res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
      return;
    }

    if (!text || text.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Teks komentar tidak boleh kosong.' });
      return;
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      res.status(404).json({ success: false, message: 'Postingan tidak ditemukan.' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        postId,
        authorId,
        parentId: parentId || null,
        text: text.trim(),
      },
      include: {
        author: { include: { profile: true } },
      },
    });

    await prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } },
    });

    if (post.authorId !== authorId) {
      const actorProfile = await prisma.profile.findUnique({ where: { userId: authorId } });
      await sendPushNotification({
        recipientId: post.authorId,
        actorName: actorProfile?.fullName || 'Rekan Alumni',
        actorPhotoUrl: actorProfile?.profilePhotoUrl || undefined,
        type: 'comment',
        title: 'Komentar Baru',
        body: `${actorProfile?.fullName || 'Rekan Alumni'} mengomentari postingan Anda: "${text.slice(0, 40)}..."`,
        data: { postId, commentId: comment.id },
      });
    }

    res.status(201).json({
      success: true,
      comment: {
        id: comment.id,
        postId: comment.postId,
        authorId: comment.authorId,
        authorName: comment.author?.profile?.fullName || 'Alumni 59',
        authorPhotoUrl: comment.author?.profile?.profilePhotoUrl || undefined,
        authorClass: comment.author?.profile?.className || 'Alumni 59',
        authorIsVerified: comment.author?.verificationStatus === 'approved',
        text: comment.text,
        parentId: comment.parentId || undefined,
        likeCount: 0,
        createdAt: comment.createdAt.toISOString(),
      },
    });
  },

  /**
   * POST /api/v1/reports
   */
  async submitReport(req: Request, res: Response): Promise<void> {
    const reporterId = req.user?.id;
    const { targetId, targetType, category, description } = req.body;

    if (!reporterId) {
      res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
      return;
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        targetId: String(targetId),
        targetType: String(targetType || 'post'),
        category: String(category || 'other'),
        description: description ? String(description) : null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Laporan Anda telah diterima dan akan segera ditinjau oleh tim moderasi.',
      report,
    });
  },
};
