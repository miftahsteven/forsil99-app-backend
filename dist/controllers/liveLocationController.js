import { prisma } from '../lib/prisma.js';
export const liveLocationController = {
    /**
     * GET /api/v1/live-locations
     */
    async getLiveLocations(req, res) {
        const locations = await prisma.liveLocation.findMany({
            where: { isSharing: true },
            orderBy: { updatedAt: 'desc' },
        });
        const userIds = locations.map((l) => l.userId);
        const profiles = await prisma.profile.findMany({
            where: {
                OR: [
                    { userId: { in: userIds } },
                    { id: { in: userIds } },
                ],
            },
        });
        const profileMap = new Map();
        profiles.forEach((p) => {
            profileMap.set(p.userId, p);
            profileMap.set(p.id, p);
        });
        const now = Date.now();
        const formatted = locations.map((loc) => {
            const p = profileMap.get(loc.userId);
            const isStale = now - loc.updatedAt.getTime() > 60 * 60 * 1000; // > 60 mins
            return {
                uid: loc.userId,
                fullName: p?.fullName || loc.fullName,
                nickname: p?.nickname || loc.nickname || undefined,
                photoUrl: p?.profilePhotoUrl || loc.photoUrl || undefined,
                className: p?.className || loc.className || undefined,
                occupation: p?.occupation || undefined,
                company: p?.company || undefined,
                isSharing: loc.isSharing,
                lat: loc.lat,
                lng: loc.lng,
                cityName: loc.cityName,
                areaName: loc.areaName,
                updatedAt: loc.updatedAt.toISOString(),
                isStale,
            };
        });
        res.json({ success: true, locations: formatted });
    },
    /**
     * POST /api/v1/live-locations
     */
    async updateLiveLocation(req, res) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const { isSharing = true, lat, lng, cityName = 'Jakarta Timur', areaName = 'Duren Sawit' } = req.body;
        const profile = await prisma.profile.findUnique({ where: { userId } });
        if (!isSharing) {
            await prisma.liveLocation.updateMany({
                where: { userId },
                data: { isSharing: false },
            });
            res.json({ success: true, message: 'Berbagi lokasi dimatikan.' });
            return;
        }
        const location = await prisma.liveLocation.upsert({
            where: { userId },
            update: {
                fullName: profile?.fullName || 'Alumni 59',
                nickname: profile?.nickname,
                photoUrl: profile?.profilePhotoUrl,
                className: profile?.className,
                isSharing: true,
                lat: typeof lat === 'number' ? lat : -6.2297,
                lng: typeof lng === 'number' ? lng : 106.8624,
                cityName,
                areaName,
                updatedAt: new Date(),
            },
            create: {
                userId,
                fullName: profile?.fullName || 'Alumni 59',
                nickname: profile?.nickname,
                photoUrl: profile?.profilePhotoUrl,
                className: profile?.className,
                isSharing: true,
                lat: typeof lat === 'number' ? lat : -6.2297,
                lng: typeof lng === 'number' ? lng : 106.8624,
                cityName,
                areaName,
            },
        });
        res.json({ success: true, location });
    },
};
