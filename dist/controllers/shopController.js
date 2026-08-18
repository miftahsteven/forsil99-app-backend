import { prisma } from '../lib/prisma.js';
export const shopController = {
    /**
     * GET /api/v1/shops
     */
    async getShops(req, res) {
        const shops = await prisma.shop.findMany({
            where: { status: 'approved' },
            include: {
                owner: {
                    include: { profile: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            success: true,
            shops: shops.map((s) => ({
                id: s.id,
                ownerId: s.ownerId,
                ownerName: s.owner?.profile?.fullName || 'Alumni 59',
                name: s.name,
                logoUrl: s.logoUrl || undefined,
                description: s.description,
                categoryIds: s.categoryIds,
                businessType: s.businessType,
                city: s.city || undefined,
                serviceAreas: s.serviceAreas,
                contactPhone: s.contactPhone || undefined,
                contactMethod: s.contactMethod,
                status: s.status,
                viewCount: s.viewCount,
                createdAt: s.createdAt.toISOString(),
            })),
        });
    },
    /**
     * POST /api/v1/shops
     */
    async createShop(req, res) {
        const ownerId = req.user?.id;
        if (!ownerId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const { name, logoUrl, description, categoryIds = [], businessType = 'product', city, serviceAreas = [], contactPhone, contactMethod = 'chat', } = req.body;
        const shop = await prisma.shop.create({
            data: {
                ownerId,
                name,
                logoUrl,
                description,
                categoryIds,
                businessType,
                city,
                serviceAreas,
                contactPhone,
                contactMethod,
                status: 'approved', // Auto-approved for verified alumni
            },
            include: {
                owner: { include: { profile: true } },
            },
        });
        // Update profile sellerStatus
        await prisma.profile.update({
            where: { userId: ownerId },
            data: { sellerStatus: 'approved' },
        });
        // Add 'seller' role to user
        await prisma.user.update({
            where: { id: ownerId },
            data: {
                roles: {
                    push: 'seller',
                },
            },
        });
        res.status(201).json({
            success: true,
            message: 'Toko Seller 99 berhasil didaftarkan.',
            shop: {
                id: shop.id,
                ownerId: shop.ownerId,
                ownerName: shop.owner?.profile?.fullName || 'Alumni 59',
                name: shop.name,
                logoUrl: shop.logoUrl || undefined,
                description: shop.description,
                categoryIds: shop.categoryIds,
                businessType: shop.businessType,
                city: shop.city || undefined,
                serviceAreas: shop.serviceAreas,
                contactPhone: shop.contactPhone || undefined,
                contactMethod: shop.contactMethod,
                status: shop.status,
                viewCount: shop.viewCount,
                createdAt: shop.createdAt.toISOString(),
            },
        });
    },
    /**
     * GET /api/v1/products
     * Returns list of active products sorted descending (newest first)
     */
    async getProducts(req, res) {
        const { category, q } = req.query;
        const where = {
            status: 'active',
        };
        if (category && category !== 'all') {
            where.OR = [
                { categoryId: String(category) },
                { categoryName: { contains: String(category), mode: 'insensitive' } },
            ];
        }
        if (q && typeof q === 'string' && q.trim().length > 0) {
            where.OR = [
                { name: { contains: q.trim(), mode: 'insensitive' } },
                { description: { contains: q.trim(), mode: 'insensitive' } },
            ];
        }
        const products = await prisma.product.findMany({
            where,
            include: {
                owner: {
                    include: { profile: true },
                },
            },
            orderBy: { createdAt: 'desc' }, // Sort descending: newest to oldest
        });
        res.json({
            success: true,
            products: products.map((p) => {
                const defaultExpiry = new Date(p.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
                return {
                    id: p.id,
                    shopId: p.shopId,
                    ownerId: p.ownerId,
                    ownerName: p.owner?.profile?.fullName || 'Alumni 59',
                    name: p.name,
                    type: p.type,
                    categoryId: p.categoryId,
                    categoryName: p.categoryName,
                    description: p.description,
                    imageUrls: p.imageUrls,
                    priceType: p.priceType,
                    price: p.price ?? undefined,
                    unit: p.unit || undefined,
                    city: p.city || undefined,
                    serviceAreas: p.serviceAreas,
                    status: p.status,
                    expiresAt: p.expiresAt ? p.expiresAt.toISOString() : defaultExpiry.toISOString(),
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString(),
                };
            }),
        });
    },
    /**
     * GET /api/v1/products/:id
     */
    async getProductById(req, res) {
        const id = String(req.params.id);
        const p = await prisma.product.findUnique({
            where: { id },
            include: {
                owner: {
                    include: { profile: true },
                },
            },
        });
        if (!p) {
            // Also check if there's a post with this ID
            const post = await prisma.post.findUnique({
                where: { id },
                include: { author: { include: { profile: true } } },
            });
            if (post && post.type === 'shop_share') {
                const mediaUrls = Array.isArray(post.media) ? post.media.map((m) => m.url).filter(Boolean) : [];
                const defaultExpiry = new Date(post.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
                res.json({
                    success: true,
                    product: {
                        id: post.id,
                        shopId: `shop_${post.authorId}`,
                        ownerId: post.authorId,
                        ownerName: post.author?.profile?.fullName || 'Alumni 59',
                        name: post.text.slice(0, 60) || 'Lapak Seller 99',
                        type: 'product',
                        categoryId: post.memoryMeta?.shopCategory || 'lainnya',
                        categoryName: 'Aneka Kebutuhan',
                        description: post.text,
                        imageUrls: mediaUrls,
                        priceType: post.memoryMeta?.price ? 'fixed' : 'contact_seller',
                        price: post.memoryMeta?.price ? Number(post.memoryMeta.price) : undefined,
                        status: 'active',
                        expiresAt: defaultExpiry.toISOString(),
                        createdAt: post.createdAt.toISOString(),
                        updatedAt: post.updatedAt.toISOString(),
                    },
                });
                return;
            }
            res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
            return;
        }
        const defaultExpiry = new Date(p.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        res.json({
            success: true,
            product: {
                id: p.id,
                shopId: p.shopId,
                ownerId: p.ownerId,
                ownerName: p.owner?.profile?.fullName || 'Alumni 59',
                name: p.name,
                type: p.type,
                categoryId: p.categoryId,
                categoryName: p.categoryName,
                description: p.description,
                imageUrls: p.imageUrls,
                priceType: p.priceType,
                price: p.price ?? undefined,
                unit: p.unit || undefined,
                city: p.city || undefined,
                serviceAreas: p.serviceAreas,
                status: p.status,
                expiresAt: p.expiresAt ? p.expiresAt.toISOString() : defaultExpiry.toISOString(),
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
            },
        });
    },
    /**
     * POST /api/v1/products
     */
    async createProduct(req, res) {
        const ownerId = req.user?.id;
        if (!ownerId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const { shopId, name, type = 'product', categoryId = 'makanan', categoryName = 'Makanan & Kuliner', description = '', imageUrls = [], priceType = 'fixed', price, unit, city, serviceAreas = [], durationDays = 30, // Default 30 days active
         } = req.body;
        let targetShopId = shopId;
        if (!targetShopId) {
            // Find or create default shop for this owner
            let userShop = await prisma.shop.findFirst({ where: { ownerId } });
            if (!userShop) {
                const ownerProfile = await prisma.profile.findUnique({ where: { userId: ownerId } });
                userShop = await prisma.shop.create({
                    data: {
                        ownerId,
                        name: `Lapak ${ownerProfile?.fullName || 'Alumni 59'}`,
                        description: 'Toko UMKM Alumni Forsil 99',
                        categoryIds: [categoryId],
                        businessType: type,
                        city: ownerProfile?.city,
                        status: 'approved',
                    },
                });
            }
            targetShopId = userShop.id;
        }
        const firstLine = (name || description || '').trim().split('\n')[0] || '';
        const resolvedName = firstLine.slice(0, 60) || 'Lapak Seller 99';
        const expiresAt = new Date(Date.now() + Number(durationDays || 30) * 24 * 60 * 60 * 1000);
        const product = await prisma.product.create({
            data: {
                shopId: targetShopId,
                ownerId,
                name: resolvedName,
                type,
                categoryId,
                categoryName,
                description: description || name || '',
                imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
                priceType,
                price: price ? parseFloat(price) : null,
                unit,
                city,
                serviceAreas,
                status: 'active',
                expiresAt,
            },
            include: {
                owner: { include: { profile: true } },
            },
        });
        // Also auto-create a corresponding post in the social feed so it appears on timeline
        try {
            const mediaList = (Array.isArray(imageUrls) ? imageUrls : []).map((url) => ({
                type: 'image',
                url,
                caption: resolvedName.slice(0, 30),
            }));
            await prisma.post.create({
                data: {
                    authorId: ownerId,
                    type: 'shop_share',
                    text: description || name || resolvedName,
                    media: mediaList,
                    visibility: 'verified_alumni',
                    linkedProductId: product.id,
                    memoryMeta: {
                        shopCategory: categoryId,
                        price: price ? parseFloat(price) : undefined,
                    },
                },
            });
        }
        catch (e) {
            console.warn('Auto-create feed post for product warning:', e);
        }
        res.status(201).json({
            success: true,
            message: 'Lapak berhasil disimpan dan tayang di Seller 99.',
            product: {
                id: product.id,
                shopId: product.shopId,
                ownerId: product.ownerId,
                ownerName: product.owner?.profile?.fullName || 'Alumni 59',
                name: product.name,
                type: product.type,
                categoryId: product.categoryId,
                categoryName: product.categoryName,
                description: product.description,
                imageUrls: product.imageUrls,
                priceType: product.priceType,
                price: product.price ?? undefined,
                unit: product.unit || undefined,
                city: product.city || undefined,
                serviceAreas: product.serviceAreas,
                status: product.status,
                expiresAt: product.expiresAt ? product.expiresAt.toISOString() : expiresAt.toISOString(),
                createdAt: product.createdAt.toISOString(),
                updatedAt: product.updatedAt.toISOString(),
            },
        });
    },
    /**
     * PUT /api/v1/products/:id
     */
    async updateProduct(req, res) {
        const ownerId = req.user?.id;
        const id = String(req.params.id);
        if (!ownerId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        let existing = await prisma.product.findUnique({ where: { id } });
        // If not found in product table, check if it's a post id
        if (!existing) {
            const existingPost = await prisma.post.findUnique({ where: { id } });
            if (existingPost) {
                if (existingPost.authorId !== ownerId && !req.user?.roles?.includes('admin')) {
                    res.status(403).json({ success: false, message: 'Akses ditolak.' });
                    return;
                }
                const { name, categoryId, description, imageUrls, price } = req.body;
                const media = Array.isArray(imageUrls)
                    ? imageUrls.map((u) => ({ type: 'image', url: u, caption: (name || '').slice(0, 30) }))
                    : existingPost.media;
                const updatedPost = await prisma.post.update({
                    where: { id },
                    data: {
                        text: description || name || existingPost.text,
                        media: media,
                        memoryMeta: {
                            ...(typeof existingPost.memoryMeta === 'object' && existingPost.memoryMeta !== null ? existingPost.memoryMeta : {}),
                            ...(categoryId ? { shopCategory: categoryId } : {}),
                            ...(price ? { price: parseFloat(price) } : {}),
                        },
                    },
                });
                res.json({
                    success: true,
                    message: 'Lapak berhasil diperbarui.',
                    product: {
                        id: updatedPost.id,
                        shopId: `shop_${updatedPost.authorId}`,
                        ownerId: updatedPost.authorId,
                        ownerName: 'Alumni 59',
                        name: description ? description.slice(0, 60) : 'Lapak Seller 99',
                        type: 'product',
                        categoryId: categoryId || 'makanan',
                        categoryName: 'Aneka Produk',
                        description: updatedPost.text,
                        imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
                        price: price ? parseFloat(price) : undefined,
                        status: 'active',
                        createdAt: updatedPost.createdAt.toISOString(),
                        updatedAt: updatedPost.updatedAt.toISOString(),
                    },
                });
                return;
            }
            res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
            return;
        }
        if (existing.ownerId !== ownerId && !req.user?.roles?.includes('admin')) {
            res.status(403).json({ success: false, message: 'Akses ditolak.' });
            return;
        }
        const { name, categoryId, categoryName, description, imageUrls, price, status, } = req.body;
        const updated = await prisma.product.update({
            where: { id },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(categoryId !== undefined ? { categoryId } : {}),
                ...(categoryName !== undefined ? { categoryName } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(imageUrls !== undefined ? { imageUrls: Array.isArray(imageUrls) ? imageUrls : [] } : {}),
                ...(price !== undefined ? { price: price ? parseFloat(price) : null } : {}),
                ...(status !== undefined ? { status } : {}),
            },
            include: {
                owner: { include: { profile: true } },
            },
        });
        // Also sync linked post if any
        try {
            const linkedPost = await prisma.post.findFirst({
                where: { OR: [{ linkedProductId: id }, { id }] },
            });
            if (linkedPost) {
                const media = Array.isArray(imageUrls)
                    ? imageUrls.map((u) => ({ type: 'image', url: u, caption: (name || '').slice(0, 30) }))
                    : linkedPost.media;
                await prisma.post.update({
                    where: { id: linkedPost.id },
                    data: {
                        text: description || name || linkedPost.text,
                        media: media,
                        memoryMeta: {
                            ...(typeof linkedPost.memoryMeta === 'object' && linkedPost.memoryMeta !== null ? linkedPost.memoryMeta : {}),
                            ...(categoryId ? { shopCategory: categoryId } : {}),
                            ...(price ? { price: parseFloat(price) } : {}),
                        },
                    },
                });
            }
        }
        catch (e) {
            console.warn('Sync linked post on product update error:', e);
        }
        const defaultExpiry = new Date(updated.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        res.json({
            success: true,
            message: 'Lapak berhasil diperbarui.',
            product: {
                id: updated.id,
                shopId: updated.shopId,
                ownerId: updated.ownerId,
                ownerName: updated.owner?.profile?.fullName || 'Alumni 59',
                name: updated.name,
                type: updated.type,
                categoryId: updated.categoryId,
                categoryName: updated.categoryName,
                description: updated.description,
                imageUrls: updated.imageUrls,
                priceType: updated.priceType,
                price: updated.price ?? undefined,
                unit: updated.unit || undefined,
                city: updated.city || undefined,
                serviceAreas: updated.serviceAreas,
                status: updated.status,
                expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : defaultExpiry.toISOString(),
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
            },
        });
    },
    /**
     * DELETE /api/v1/products/:id
     */
    async deleteProduct(req, res) {
        const ownerId = req.user?.id;
        const id = String(req.params.id);
        if (!ownerId) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        const existing = await prisma.product.findUnique({ where: { id } });
        if (!existing) {
            // Check if it's a post with this id
            const existingPost = await prisma.post.findUnique({ where: { id } });
            if (existingPost) {
                if (existingPost.authorId !== ownerId && !req.user?.roles?.includes('admin')) {
                    res.status(403).json({ success: false, message: 'Akses ditolak.' });
                    return;
                }
                await prisma.post.delete({ where: { id } });
                res.json({ success: true, message: 'Lapak berhasil dihapus.' });
                return;
            }
            res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
            return;
        }
        if (existing.ownerId !== ownerId && !req.user?.roles?.includes('admin')) {
            res.status(403).json({ success: false, message: 'Akses ditolak.' });
            return;
        }
        await prisma.product.delete({ where: { id } });
        // Also delete linked post if any
        try {
            await prisma.post.deleteMany({
                where: { OR: [{ linkedProductId: id }, { id }] },
            });
        }
        catch (e) {
            console.warn('Delete linked post on product delete error:', e);
        }
        res.json({
            success: true,
            message: 'Lapak berhasil dihapus.',
        });
    },
};
