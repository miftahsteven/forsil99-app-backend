import { prisma } from '../lib/prisma.js';
import { sendPushNotification } from '../services/firebase/firebaseAdmin.js';
import { getParam } from '../lib/paramHelper.js';
export const verificationController = {
    /**
     * POST /api/v1/verification/submit
     */
    async submitVerification(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const { fullName, className, evidencePaths = [], submittedData = {} } = req.body;
        await prisma.user.update({
            where: { id: userId },
            data: { verificationStatus: 'under_review' },
        });
        const profile = await prisma.profile.findUnique({ where: { userId } });
        res.status(201).json({
            success: true,
            message: 'Permohonan verifikasi berhasil diajukan.',
            request: {
                id: `req_${userId}`,
                uid: userId,
                fullName: fullName || profile?.fullName || 'Alumni 59',
                className: className || profile?.className || '3 IPA 1',
                submittedData,
                evidencePaths,
                referenceUids: [],
                status: 'under_review',
                submittedAt: new Date().toISOString(),
            },
        });
    },
    /**
     * GET /api/v1/verification/status
     */
    async getMyStatus(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
            return;
        }
        res.json({
            success: true,
            request: {
                id: `req_${userId}`,
                uid: userId,
                fullName: user.profile?.fullName || 'Alumni 59',
                className: user.profile?.className || 'Alumni 59',
                status: user.verificationStatus,
                submittedAt: user.createdAt.toISOString(),
            },
        });
    },
    /**
     * GET /api/v1/verification/queue (Admin only)
     */
    async getQueue(req, res) {
        const pendingUsers = await prisma.user.findMany({
            where: {
                verificationStatus: { in: ['submitted', 'under_review', 'need_revision'] },
            },
            include: { profile: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            requests: pendingUsers.map((u) => ({
                id: `req_${u.id}`,
                uid: u.id,
                fullName: u.profile?.fullName || 'Alumni 59',
                className: u.profile?.className || 'Alumni 59',
                submittedData: {
                    phone: u.phoneNumber,
                    email: u.email,
                },
                evidencePaths: [],
                referenceUids: [],
                status: u.verificationStatus,
                submittedAt: u.createdAt.toISOString(),
            })),
        });
    },
    /**
     * POST /api/v1/verification/:id/review (Admin only)
     */
    async reviewVerification(req, res) {
        const id = getParam(req.params.id);
        const { action, reason } = req.body;
        const targetUserId = id.replace('req_', '');
        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        await prisma.user.update({
            where: { id: targetUserId },
            data: {
                verificationStatus: newStatus,
            },
        });
        if (newStatus === 'approved') {
            await prisma.profile.update({
                where: { userId: targetUserId },
                data: { verifiedAt: new Date() },
            });
        }
        await sendPushNotification({
            recipientId: targetUserId,
            actorName: 'Admin Forsil 99',
            type: 'verification',
            title: 'Status Verifikasi Alumni',
            body: newStatus === 'approved'
                ? 'Selamat! Akun Anda telah terverifikasi sebagai Alumni SMAN 59 Angkatan 99.'
                : `Mohon maaf, verifikasi belum dapat disetujui: ${reason || 'Data tidak sesuai.'}`,
        });
        res.json({
            success: true,
            message: `Verifikasi berhasil di-${newStatus === 'approved' ? 'setujui' : 'tolak'}.`,
        });
    },
};
