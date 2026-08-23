import { prisma } from '../lib/prisma.js';
import { sendPushNotification } from '../services/firebase/firebaseAdmin.js';
import { getParam } from '../lib/paramHelper.js';
export const chatController = {
    /**
     * GET /api/v1/chat/threads
     */
    async getThreads(req, res) {
        const currentUserId = req.user?.id;
        if (!currentUserId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const threads = await prisma.chatThread.findMany({
            where: {
                memberIds: { has: currentUserId },
            },
            orderBy: { updatedAt: 'desc' },
        });
        const formattedThreads = await Promise.all(threads.map(async (t) => {
            const otherUserId = t.memberIds.find((id) => id !== currentUserId) || currentUserId;
            const otherProfile = await prisma.profile.findUnique({
                where: { userId: otherUserId },
                include: { user: true },
            });
            const unreadCount = await prisma.chatMessage.count({
                where: {
                    threadId: t.id,
                    senderId: { not: currentUserId },
                    isRead: false,
                },
            });
            return {
                id: t.id,
                memberIds: t.memberIds,
                otherUser: {
                    uid: otherUserId,
                    name: otherProfile?.fullName || 'Alumni 59',
                    photoUrl: otherProfile?.profilePhotoUrl || undefined,
                    className: otherProfile?.className || 'Alumni 59',
                    isVerified: otherProfile?.user?.verificationStatus === 'approved',
                },
                lastMessageText: t.lastMessageText || undefined,
                lastMessageAt: t.lastMessageAt ? t.lastMessageAt.toISOString() : undefined,
                unreadCount,
            };
        }));
        res.json({
            success: true,
            threads: formattedThreads,
        });
    },
    /**
     * POST /api/v1/chat/start
     */
    async startDirectChat(req, res) {
        const currentUserId = req.user?.id;
        const targetAccountId = req.body.targetAccountId || req.body.targetUserId || req.body.targetId;
        if (!currentUserId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        if (!targetAccountId) {
            res.status(400).json({ success: false, message: 'Target akun chat harus ditentukan.' });
            return;
        }
        // Check if targetAccountId is already an existing thread ID
        let thread = await prisma.chatThread.findFirst({
            where: {
                OR: [
                    { id: targetAccountId },
                    {
                        AND: [
                            { memberIds: { has: currentUserId } },
                            { memberIds: { has: targetAccountId } },
                        ],
                    },
                ],
            },
        });
        if (!thread) {
            thread = await prisma.chatThread.create({
                data: {
                    memberIds: [currentUserId, targetAccountId],
                },
            });
        }
        const otherUserId = thread.memberIds.find((id) => id !== currentUserId) || targetAccountId;
        const otherProfile = await prisma.profile.findUnique({
            where: { userId: otherUserId },
            include: { user: true },
        });
        res.json({
            success: true,
            thread: {
                id: thread.id,
                memberIds: thread.memberIds,
                otherUser: {
                    uid: otherUserId,
                    name: otherProfile?.fullName || 'Alumni 59',
                    photoUrl: otherProfile?.profilePhotoUrl || undefined,
                    className: otherProfile?.className || 'Alumni 59',
                    isVerified: otherProfile?.user?.verificationStatus === 'approved',
                },
                lastMessageText: thread.lastMessageText || undefined,
                lastMessageAt: thread.lastMessageAt ? thread.lastMessageAt.toISOString() : undefined,
                unreadCount: 0,
            },
        });
    },
    /**
     * GET /api/v1/chat/threads/:id/messages
     */
    async getThreadMessages(req, res) {
        const threadId = getParam(req.params.id);
        const currentUserId = req.user?.id;
        const messages = await prisma.chatMessage.findMany({
            where: { threadId },
            include: {
                sender: { include: { profile: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
        if (currentUserId) {
            await prisma.chatMessage.updateMany({
                where: {
                    threadId,
                    senderId: { not: currentUserId },
                    isRead: false,
                },
                data: { isRead: true },
            });
        }
        res.json({
            success: true,
            messages: messages.map((m) => ({
                id: m.id,
                chatId: m.threadId,
                senderId: m.senderId,
                senderName: m.sender?.profile?.fullName || 'Alumni 59',
                text: m.text,
                imageUrl: m.imageUrl || undefined,
                isRead: m.isRead,
                createdAt: m.createdAt.toISOString(),
            })),
        });
    },
    /**
     * POST /api/v1/chat/threads/:id/messages
     */
    async sendMessage(req, res) {
        const threadId = getParam(req.params.id);
        const senderId = req.user?.id;
        const { text } = req.body;
        const mediaUrl = req.body.mediaUrl || req.body.imageUrl;
        if (!senderId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        if (!text && !mediaUrl) {
            res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong.' });
            return;
        }
        const message = await prisma.chatMessage.create({
            data: {
                threadId,
                senderId,
                text: text || '',
                imageUrl: mediaUrl || null,
                isRead: false,
            },
            include: {
                sender: { include: { profile: true } },
                thread: true,
            },
        });
        await prisma.chatThread.update({
            where: { id: threadId },
            data: {
                lastMessageText: text || '📸 Foto',
                lastMessageAt: new Date(),
            },
        });
        const otherMemberId = message.thread.memberIds.find((id) => id !== senderId);
        if (otherMemberId) {
            const senderProfile = message.sender?.profile;
            await sendPushNotification({
                recipientId: otherMemberId,
                actorName: senderProfile?.fullName || 'Rekan Alumni',
                actorPhotoUrl: senderProfile?.profilePhotoUrl || undefined,
                type: 'chat',
                title: senderProfile?.fullName || 'Pesan Baru',
                body: text ? (text.length > 50 ? `${text.slice(0, 50)}...` : text) : 'Mengirim sebuah foto',
                data: { threadId },
            });
        }
        res.status(201).json({
            success: true,
            message: {
                id: message.id,
                chatId: message.threadId,
                senderId: message.senderId,
                senderName: message.sender?.profile?.fullName || 'Alumni 59',
                text: message.text,
                imageUrl: message.imageUrl || undefined,
                isRead: message.isRead,
                createdAt: message.createdAt.toISOString(),
            },
        });
    },
};
