import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/paramHelper.js';
export const eventController = {
    /**
     * GET /api/v1/events
     */
    async getEvents(req, res) {
        const currentUserId = req.user?.id;
        const events = await prisma.event.findMany({
            include: {
                rsvps: true,
            },
            orderBy: { startAt: 'asc' },
        });
        const formatted = events.map((e) => {
            const userRsvpObj = currentUserId
                ? e.rsvps.find((r) => r.userId === currentUserId)
                : undefined;
            return {
                id: e.id,
                title: e.title,
                description: e.description,
                coverUrl: e.coverUrl || undefined,
                startAt: e.startAt.toISOString(),
                endAt: e.endAt ? e.endAt.toISOString() : undefined,
                locationName: e.locationName,
                address: e.address || undefined,
                organizerName: e.organizerName,
                attendeeCount: e.attendeeCount || e.rsvps.filter((r) => r.status === 'hadir').length,
                userRsvp: userRsvpObj ? userRsvpObj.status : undefined,
                status: e.status,
            };
        });
        res.json({ success: true, events: formatted });
    },
    /**
     * POST /api/v1/events/:id/rsvp
     */
    async rsvpEvent(req, res) {
        const eventId = getParam(req.params.id);
        const userId = req.user?.id;
        const { rsvp } = req.body;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) {
            res.status(404).json({ success: false, message: 'Acara tidak ditemukan.' });
            return;
        }
        await prisma.eventRsvp.upsert({
            where: {
                eventId_userId: { eventId, userId },
            },
            update: {
                status: String(rsvp),
            },
            create: {
                eventId,
                userId,
                status: String(rsvp),
            },
        });
        const hadirCount = await prisma.eventRsvp.count({
            where: { eventId, status: 'hadir' },
        });
        await prisma.event.update({
            where: { id: eventId },
            data: { attendeeCount: hadirCount },
        });
        res.json({
            success: true,
            message: 'Status kehadiran RSVP berhasil diperbarui.',
            userRsvp: rsvp,
            attendeeCount: hadirCount,
        });
    },
};
