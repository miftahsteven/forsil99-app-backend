import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { generateToken } from '../middlewares/authMiddleware.js';
import { verifyGoogleToken, sendPushNotification } from '../services/firebase/firebaseAdmin.js';
import { sendReferralRequestEmail, sendRegistrationApprovedEmail } from '../services/emailService.js';
import { verifyRecaptchaToken } from '../services/recaptchaService.js';
import { getParam } from '../lib/paramHelper.js';

// Schemas
export const loginSchema = z.object({
  identifier: z.string().min(3, 'Nomor HP atau Email harus diisi.'),
  password: z.string().min(4, 'Password minimal 4 karakter.'),
  recaptchaToken: z.string().optional(),
  platform: z.string().optional(),
}).passthrough();

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Nama lengkap harus diisi.'),
  nickname: z.string().optional(),
  className: z.string().min(2, 'Kelas harus dipilih.'),
  phoneNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Format email tidak valid.').optional().or(z.literal('')),
  password: z.string().min(6, 'Password minimal 6 karakter.'),
  graduationYear: z.number().default(1999).optional(),
  referralAccountId: z.string().min(1, 'Rekan referral wajib dipilih.').optional(),
  referralName: z.string().optional(),
  selfieBase64: z.string().min(1, 'Foto selfie verifikasi wajah wajib diunggah.').optional(),
  recaptchaToken: z.string().optional(),
  platform: z.string().optional(),
}).passthrough();

export const submitRegistrationSchema = z.object({
  googleUid: z.string().optional(),
  userId: z.string().optional(),
  googleEmail: z.string().email('Format email tidak valid.').or(z.string()),
  fullName: z.string().min(2, 'Nama lengkap minimal 2 karakter.'),
  nickname: z.string().optional(),
  className: z.string().min(2, 'Kelas wajib diisi.'),
  whatsapp: z.string().min(8, 'Nomor WhatsApp minimal 8 digit.'),
  referralAccountId: z.string().min(1, 'Rekan alumni referral (teman seangkatan) wajib dipilih.'),
  referralName: z.string().min(1, 'Nama rekan referral wajib tertera.'),
  selfieBase64: z.string().min(1, 'Foto selfie verifikasi wajah wajib diunggah.'),
});

/**
 * Normalizer for Profile object
 */
export function formatProfileResponse(profile: any) {
  if (!profile) return null;
  return {
    ...profile,
    uid: profile.userId || profile.id,
    accountId: profile.userId || profile.id,
  };
}

/**
 * Helper to detect request platform (Web, iOS Web, Android App, etc.)
 */
export function detectPlatform(req: Request): string {
  const headerPlatform = (req.headers['x-platform'] as string)?.toLowerCase();
  if (headerPlatform) return headerPlatform;
  
  const bodyPlatform = (req.body?.platform as string)?.toLowerCase();
  if (bodyPlatform) return bodyPlatform;

  const ua = req.get('user-agent') || '';
  if (/android/i.test(ua) && /okhttp|expo|reactnative/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'web_ios';
  if (/android/i.test(ua)) return 'web_android';
  return 'web';
}

export const authController = {
  /**
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    const { identifier, password } = req.body;
    const tokenFromReq = req.body.recaptchaToken || (req.headers['x-recaptcha-token'] as string);
    const cleanIdentifier = String(identifier || '').trim().replace(/\0/g, '');
    const platform = detectPlatform(req);

    // Verify reCAPTCHA token (required for Web)
    const recaptcha = await verifyRecaptchaToken(tokenFromReq, platform, 'login');
    if (!recaptcha.success) {
      console.warn(`[AUTH_LOGIN_BLOCKED] Platform: ${platform.toUpperCase()} | Reason: reCAPTCHA failed`);
      res.status(400).json({
        success: false,
        message: recaptcha.message || 'Verifikasi reCAPTCHA wajib diselesaikan.',
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier },
          { phoneNumber: cleanIdentifier },
        ],
      },
      include: { profile: true },
    });

    if (!user || !user.passwordHash) {
      // Constant-time dummy comparison to prevent user enumeration via timing attack
      await bcrypt.compare(String(password || ''), '$2a$12$e8xLgVpB7MhQj9v01dFw0.Yn0KqE0pC.9rMv8Zq8hVzJk4f03.6Ki');
      console.warn(`[AUTH_LOGIN_FAILED] Platform: ${platform.toUpperCase()} | Identifier: ${cleanIdentifier} | Reason: User not found`);
      res.status(401).json({
        success: false,
        message: 'Nomor HP / Email atau kata sandi tidak cocok.',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      console.warn(`[AUTH_LOGIN_FAILED] Platform: ${platform.toUpperCase()} | User: ${user.profile?.fullName || user.email} | Reason: Wrong password`);
      res.status(401).json({
        success: false,
        message: 'Nomor HP / Email atau kata sandi tidak cocok.',
      });
      return;
    }

    if (!user.isActive) {
      console.warn(`[AUTH_LOGIN_BLOCKED] Platform: ${platform.toUpperCase()} | User: ${user.profile?.fullName || user.email} | Reason: Inactive user`);
      res.status(403).json({
        success: false,
        message: 'Akun Anda telah dinonaktifkan oleh administrator.',
      });
      return;
    }

    if (user.verificationStatus === 'pending' && !user.roles.includes('admin')) {
      console.warn(`[AUTH_LOGIN_PENDING] User: ${user.profile?.fullName || user.email} is pending referral approval`);
      res.status(403).json({
        success: false,
        status: 'pending',
        message: 'Pendaftaran Anda sedang menunggu persetujuan dari rekan alumni referral Anda via email. Silakan hubungi rekan Anda atau tunggu hingga email disetujui.',
      });
      return;
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    console.log(`[AUTH_LOGIN] ✅ Platform: ${platform.toUpperCase()} | User: "${user.profile?.fullName || user.email || user.phoneNumber}" (ID: ${user.id}) | IP: ${req.ip} | Roles: ${user.roles.join(', ')}`);

    const token = generateToken({
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      roles: user.roles,
    });

    res.json({
      success: true,
      platform,
      token,
      user: {
        id: user.id,
        uid: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        roles: user.roles,
        verificationStatus: user.verificationStatus,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      profile: formatProfileResponse(user.profile),
    });
  },

  /**
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    const {
      fullName,
      nickname,
      className,
      phoneNumber,
      phone,
      email,
      password,
      graduationYear,
      referralAccountId,
      referralName,
      selfieBase64,
    } = req.body;
    const tokenFromReq = req.body.recaptchaToken || (req.headers['x-recaptcha-token'] as string);
    const finalPhone = String(phoneNumber || phone || '').trim().replace(/\0/g, '');
    const cleanEmail = String(email || '').trim().replace(/\0/g, '');
    const cleanFullName = String(fullName || '').trim().replace(/\0/g, '');
    const cleanNickname = nickname ? String(nickname).trim().replace(/\0/g, '') : undefined;
    const platform = detectPlatform(req);

    // Verify reCAPTCHA token (required for Web)
    const recaptcha = await verifyRecaptchaToken(tokenFromReq, platform, 'register');
    if (!recaptcha.success) {
      console.warn(`[AUTH_REGISTER_BLOCKED] Platform: ${platform.toUpperCase()} | Reason: reCAPTCHA failed`);
      res.status(400).json({
        success: false,
        message: recaptcha.message || 'Verifikasi reCAPTCHA wajib diselesaikan.',
      });
      return;
    }

    // Mandatory Selfie Photo Check
    if (!selfieBase64 || typeof selfieBase64 !== 'string' || selfieBase64.trim().length === 0) {
      console.warn(`[AUTH_REGISTER_FAILED] Platform: ${platform.toUpperCase()} | Missing mandatory selfie photo`);
      res.status(400).json({ success: false, message: 'Foto selfie verifikasi wajah wajib diunggah.' });
      return;
    }

    // Mandatory Referral Check
    if (!referralAccountId || typeof referralAccountId !== 'string' || referralAccountId.trim().length === 0) {
      console.warn(`[AUTH_REGISTER_FAILED] Platform: ${platform.toUpperCase()} | Missing mandatory referral`);
      res.status(400).json({ success: false, message: 'Rekan alumni referral (teman seangkatan) wajib dipilih.' });
      return;
    }

    // Check if phone or email already taken
    if (finalPhone) {
      const existingPhone = await prisma.user.findUnique({ where: { phoneNumber: finalPhone } });
      if (existingPhone) {
        console.warn(`[AUTH_REGISTER_FAILED] Platform: ${platform.toUpperCase()} | Phone ${finalPhone} already registered`);
        res.status(400).json({ success: false, message: 'Nomor HP/WhatsApp sudah terdaftar.' });
        return;
      }
    }

    if (cleanEmail) {
      const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existingEmail) {
        console.warn(`[AUTH_REGISTER_FAILED] Platform: ${platform.toUpperCase()} | Email ${cleanEmail} already registered`);
        res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
        return;
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        phoneNumber: finalPhone || null,
        email: cleanEmail || null,
        passwordHash,
        roles: ['alumni'],
        verificationStatus: 'pending', // PENDING verification!
        profile: {
          create: {
            fullName,
            nickname: nickname || null,
            className,
            graduationYear: graduationYear || 1999,
            schoolCode: 'SMAN59JKT',
            searchKeywords: [fullName.toLowerCase(), className.toLowerCase()],
            profilePhotoUrl: selfieBase64 || null,
          },
        },
      },
      include: { profile: true },
    });

    console.log(`[AUTH_REGISTER] ✅ Platform: ${platform.toUpperCase()} | New User: "${fullName}" (${className}) | ID: ${user.id} | Status: PENDING`);

    let registrationId = '';
    const applicantEmail = cleanEmail || `${finalPhone.replace(/[^0-9]/g, '')}@sman59.sch.id`;

    if (referralAccountId) {
      const registration = await prisma.alumniRegistration.upsert({
        where: { googleUid: user.id },
        update: {
          googleEmail: applicantEmail,
          fullName,
          nickname: nickname || null,
          className,
          whatsapp: finalPhone,
          referralAccountId,
          referralName: referralName || 'Rekan Alumni',
          selfieBase64: selfieBase64 || null,
          status: 'submitted',
          submittedAt: new Date(),
        },
        create: {
          googleUid: user.id,
          googleEmail: applicantEmail,
          fullName,
          nickname: nickname || null,
          className,
          whatsapp: finalPhone,
          referralAccountId,
          referralName: referralName || 'Rekan Alumni',
          selfieBase64: selfieBase64 || null,
          status: 'submitted',
        },
      });
      registrationId = registration.id;

      (async () => {
        try {
          const referralUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: referralAccountId },
                { profile: { userId: referralAccountId } },
              ],
            },
            include: { profile: true },
          });

          const referralEmail = referralUser?.email || 'mscodx@gmail.com';
          const refName = referralUser?.profile?.fullName || referralName || 'Alumni 59';

          console.log(`[AUTH_REGISTER_EMAIL] Sending referral email to ${referralEmail} for applicant ${fullName}...`);
          await sendReferralRequestEmail({
            referralEmail,
            referralName: refName,
            applicantName: fullName,
            applicantNickname: nickname,
            applicantClass: className,
            applicantWhatsapp: finalPhone,
            applicantEmail,
            applicantSelfieUrl: selfieBase64,
            registrationId: registration.id,
            submittedAt: registration.submittedAt,
          });

          await sendPushNotification({
            recipientId: referralAccountId,
            actorName: fullName,
            type: 'verification',
            title: 'Permintaan Konfirmasi Teman Angkatan',
            body: `${fullName} (${className}) mendaftar dan memilih Anda sebagai referensi alumni 59.`,
            data: { registrationId: registration.id },
          }).catch(() => {});
        } catch (err: any) {
          console.warn('Non-blocking referral notification error:', err?.message || err);
        }
      })();
    }

    res.status(201).json({
      success: true,
      platform,
      message: 'Pendaftaran berhasil. Akun Anda sedang menunggu persetujuan dari rekan alumni referral via email.',
      user: {
        id: user.id,
        uid: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        roles: user.roles,
        verificationStatus: 'pending',
        isActive: user.isActive,
      },
      profile: formatProfileResponse(user.profile),
      registrationId,
    });
  },

  /**
   * GET /api/v1/auth/me
   */
  async getMe(req: Request, res: Response): Promise<void> {
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
      user: {
        id: user.id,
        uid: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        roles: user.roles,
        verificationStatus: user.verificationStatus,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      profile: formatProfileResponse(user.profile),
    });
  },

  /**
   * POST /api/v1/alumni-registration/google-login
   */
  async googleLogin(req: Request, res: Response): Promise<void> {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ success: false, message: 'Google ID Token wajib diberikan.' });
      return;
    }

    const googlePayload = await verifyGoogleToken(idToken);
    if (!googlePayload) {
      res.status(401).json({ success: false, message: 'Token Google tidak valid atau kedaluwarsa.' });
      return;
    }

    const { googleUid, email, name, picture } = googlePayload;

    // 1. Check if user already exists with googleUid or email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { googleUid },
          { email: email || '___invalid___' },
        ],
      },
      include: { profile: true },
    });

    if (existingUser) {
      if (!existingUser.googleUid) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { googleUid },
        });
      }

      const token = generateToken({
        id: existingUser.id,
        email: existingUser.email,
        phoneNumber: existingUser.phoneNumber,
        roles: existingUser.roles,
      });

      res.json({
        success: true,
        loginState: 'approved',
        token,
        user: {
          id: existingUser.id,
          uid: existingUser.id,
          email: existingUser.email,
          roles: existingUser.roles,
          verificationStatus: existingUser.verificationStatus,
        },
        profile: formatProfileResponse(existingUser.profile),
      });
      return;
    }

    // 2. Check if there is an existing AlumniRegistration submission
    const existingReg = await prisma.alumniRegistration.findUnique({
      where: { googleUid },
    });

    if (existingReg) {
      if (existingReg.status === 'approved') {
        const newUser = await prisma.user.create({
          data: {
            googleUid,
            email: existingReg.googleEmail,
            phoneNumber: existingReg.whatsapp,
            roles: ['alumni'],
            verificationStatus: 'approved',
            profile: {
              create: {
                fullName: existingReg.fullName,
                nickname: existingReg.nickname,
                className: existingReg.className,
                profilePhotoUrl: existingReg.selfieBase64 || existingReg.selfieUrl || picture || null,
                graduationYear: 1999,
                schoolCode: 'SMAN59JKT',
                searchKeywords: [existingReg.fullName.toLowerCase(), existingReg.className.toLowerCase()],
                verifiedAt: new Date(),
              },
            },
          },
          include: { profile: true },
        });

        const token = generateToken({
          id: newUser.id,
          email: newUser.email,
          phoneNumber: newUser.phoneNumber,
          roles: newUser.roles,
        });

        res.json({
          success: true,
          loginState: 'approved',
          token,
          user: newUser,
          profile: formatProfileResponse(newUser.profile),
        });
        return;
      } else if (existingReg.status === 'rejected') {
        res.json({
          success: true,
          loginState: 'rejected',
          registration: existingReg,
        });
        return;
      } else {
        res.json({
          success: true,
          loginState: 'pending',
          registration: existingReg,
        });
        return;
      }
    }

    // 3. New user – needs to complete the registration form
    res.json({
      success: true,
      loginState: 'new_user',
      googleUser: {
        googleUid,
        googleEmail: email,
        googleName: name,
        googlePhoto: picture,
      },
    });
  },

  /**
   * GET /api/v1/alumni-registration/alumni-list
   */
  async getAlumniList(req: Request, res: Response): Promise<void> {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const whereClause: any = {};
    if (q.length >= 3) {
      whereClause.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { nickname: { contains: q, mode: 'insensitive' } },
        { className: { contains: q, mode: 'insensitive' } },
      ];
    } else if (q.length > 0) {
      // Query less than 3 chars returns empty
      res.json({ success: true, alumni: [] });
      return;
    }

    const profiles = await prisma.profile.findMany({
      where: whereClause,
      select: {
        userId: true,
        fullName: true,
        nickname: true,
        className: true,
        profilePhotoUrl: true,
      },
      orderBy: { fullName: 'asc' },
      take: 25,
    });

    const alumni = profiles.map((p) => ({
      accountId: p.userId,
      fullName: p.fullName,
      nickname: p.nickname || undefined,
      className: p.className || undefined,
      profilePhotoUrl: p.profilePhotoUrl || undefined,
    }));

    res.json({ success: true, alumni });
  },

  /**
   * POST /api/v1/alumni-registration/submit
   */
  async submitRegistration(req: Request, res: Response): Promise<void> {
    const payload = req.body;
    const effectiveGoogleUid =
      payload.googleUid ||
      payload.userId ||
      (payload.whatsapp ? `web_${payload.whatsapp.replace(/[^0-9]/g, '')}` : `reg_${Date.now()}`);

    const registration = await prisma.alumniRegistration.upsert({
      where: { googleUid: effectiveGoogleUid },
      update: {
        googleEmail: payload.googleEmail,
        fullName: payload.fullName,
        nickname: payload.nickname || null,
        className: payload.className,
        whatsapp: payload.whatsapp,
        referralAccountId: payload.referralAccountId,
        referralName: payload.referralName,
        selfieBase64: payload.selfieBase64 || null,
        status: 'submitted',
        submittedAt: new Date(),
      },
      create: {
        googleUid: effectiveGoogleUid,
        googleEmail: payload.googleEmail,
        fullName: payload.fullName,
        nickname: payload.nickname || null,
        className: payload.className,
        whatsapp: payload.whatsapp,
        referralAccountId: payload.referralAccountId,
        referralName: payload.referralName,
        selfieBase64: payload.selfieBase64 || null,
        status: 'submitted',
      },
    });

    if (payload.referralAccountId) {
      (async () => {
        try {
          const referralUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: payload.referralAccountId },
                { profile: { userId: payload.referralAccountId } },
              ],
            },
            include: { profile: true },
          });

          const referralEmail = referralUser?.email || 'mscodx@gmail.com';
          const referralName = referralUser?.profile?.fullName || payload.referralName || 'Alumni 59';

          sendReferralRequestEmail({
            referralEmail,
            referralName,
            applicantName: payload.fullName,
            applicantNickname: payload.nickname,
            applicantClass: payload.className,
            applicantWhatsapp: payload.whatsapp,
            applicantEmail: payload.googleEmail,
            applicantSelfieUrl: payload.selfieBase64,
            registrationId: registration.id,
            submittedAt: registration.submittedAt,
          }).catch((err) => console.warn('Background email dispatch err:', err));

          sendPushNotification({
            recipientId: payload.referralAccountId,
            actorName: payload.fullName,
            type: 'verification',
            title: 'Permintaan Konfirmasi Teman Angkatan',
            body: `${payload.fullName} (${payload.className}) mendaftar dan memilih Anda sebagai referensi alumni 59.`,
            data: { registrationId: registration.id },
          }).catch((err) => console.warn('Background push dispatch err:', err));
        } catch (err: any) {
          console.warn('Non-blocking referral notification error:', err?.message || err);
        }
      })();
    }

    res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil diajukan. Menunggu konfirmasi dari rekan referral Anda.',
      registration,
    });
  },

  /**
   * GET /api/v1/alumni-registration/status/:googleUid
   */
  async getRegistrationStatus(req: Request, res: Response): Promise<void> {
    const googleUid = getParam(req.params.googleUid);
    const registration = await prisma.alumniRegistration.findUnique({
      where: { googleUid },
    });

    if (!registration) {
      res.status(404).json({ success: false, message: 'Data pendaftaran tidak ditemukan.' });
      return;
    }

    res.json({ success: true, registration });
  },

  /**
   * GET /api/v1/alumni-registration/pending-for-referrer/:accountId
   */
  async getPendingForReferrer(req: Request, res: Response): Promise<void> {
    const accountId = getParam(req.params.accountId);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: accountId },
          { profile: { userId: accountId } },
          { email: 'mscodx@gmail.com' },
          { email: 'admin@mscode.id' },
        ],
      },
      include: { profile: true },
    });

    const isGlobalAdmin =
      accountId === 'admin_miftah_99' ||
      user?.roles?.includes('admin') ||
      user?.roles?.includes('super_admin');

    const registrations = await prisma.alumniRegistration.findMany({
      where: {
        status: 'submitted',
        ...(isGlobalAdmin
          ? {}
          : {
              OR: [
                { referralAccountId: accountId },
                ...(user ? [{ referralAccountId: user.id }] : []),
              ],
            }),
      },
      orderBy: { submittedAt: 'desc' },
    });

    res.json({
      success: true,
      registrations: registrations.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        nickname: r.nickname || '',
        className: r.className,
        whatsapp: r.whatsapp,
        googleEmail: r.googleEmail,
        selfieBase64: r.selfieBase64 || undefined,
        createdAt: r.submittedAt.toISOString(),
        approvalStatus: r.status,
      })),
    });
  },

  /**
   * POST /api/v1/alumni-registration/app-approve/:id
   */
  async appApproveRegistration(req: Request, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const reg = await prisma.alumniRegistration.findUnique({ where: { id } });

    if (!reg) {
      res.status(404).json({ success: false, message: 'Permohonan pendaftaran tidak ditemukan.' });
      return;
    }

    const updatedReg = await prisma.alumniRegistration.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: req.user?.id || 'referral_approval',
      },
    });

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { googleUid: reg.googleUid },
          { email: reg.googleEmail },
        ],
      },
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          googleUid: reg.googleUid,
          email: reg.googleEmail,
          phoneNumber: reg.whatsapp,
          roles: ['alumni'],
          verificationStatus: 'approved',
          profile: {
            create: {
              fullName: reg.fullName,
              nickname: reg.nickname,
              className: reg.className,
              profilePhotoUrl: reg.selfieBase64 || reg.selfieUrl || null,
              graduationYear: 1999,
              schoolCode: 'SMAN59JKT',
              searchKeywords: [reg.fullName.toLowerCase(), reg.className.toLowerCase()],
              verifiedAt: new Date(),
            },
          },
        },
      });
    }

    // Auto-Follow: Newly approved applicant automatically follows the referrer
    try {
      const applicantUser = await prisma.user.findFirst({
        where: {
          OR: [{ googleUid: reg.googleUid }, { email: reg.googleEmail }],
        },
      });

      const referrerUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: reg.referralAccountId },
            { profile: { userId: reg.referralAccountId } },
            { email: 'mscodx@gmail.com' },
          ],
        },
      });

      if (applicantUser && referrerUser && applicantUser.id !== referrerUser.id) {
        await prisma.follow.upsert({
          where: {
            followerId_followingId: {
              followerId: applicantUser.id,
              followingId: referrerUser.id,
            },
          },
          update: {},
          create: {
            followerId: applicantUser.id,
            followingId: referrerUser.id,
          },
        });
      }
    } catch (e) {
      console.warn('Auto-follow referral approval error:', e);
    }

    try {
      await sendRegistrationApprovedEmail({
        toEmail: reg.googleEmail,
        fullName: reg.fullName,
        className: reg.className,
      });
    } catch (e) {
      console.warn('Non-blocking approval email error:', e);
    }

    res.json({
      success: true,
      message: 'Pendaftaran rekan alumni berhasil disetujui.',
      registration: updatedReg,
    });
  },

  /**
   * POST /api/v1/alumni-registration/app-reject/:id
   */
  async appRejectRegistration(req: Request, res: Response): Promise<void> {
    const id = getParam(req.params.id);
    const updatedReg = await prisma.alumniRegistration.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: req.user?.id || 'referral_reject',
      },
    });

    res.json({
      success: true,
      message: 'Pendaftaran rekan alumni telah ditolak.',
      registration: updatedReg,
    });
  },

  /**
   * POST /api/v1/alumni-registration/resend-referral-email
   */
  async resendReferralEmail(req: Request, res: Response): Promise<void> {
    const { googleUid, registrationId, googleEmail } = req.body;

    const reg = await prisma.alumniRegistration.findFirst({
      where: {
        OR: [
          ...(googleUid ? [{ googleUid }] : []),
          ...(registrationId ? [{ id: registrationId }] : []),
          ...(googleEmail ? [{ googleEmail }] : []),
        ],
      },
    });

    if (!reg) {
      res.status(404).json({ success: false, message: 'Data pendaftaran tidak ditemukan.' });
      return;
    }

    if (reg.status === 'approved') {
      res.status(400).json({ success: false, message: 'Pendaftaran Anda sudah disetujui sebelumnya.' });
      return;
    }

    let referralEmail = 'mscodx@gmail.com';
    let referralName = reg.referralName || 'Steven';

    if (reg.referralAccountId) {
      const referralUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: reg.referralAccountId },
            { profile: { userId: reg.referralAccountId } },
          ],
        },
        include: { profile: true },
      });

      if (referralUser?.email) {
        referralEmail = referralUser.email;
      }
      if (referralUser?.profile?.fullName) {
        referralName = referralUser.profile.fullName;
      }
    }

    sendReferralRequestEmail({
      referralEmail,
      referralName,
      applicantName: reg.fullName,
      applicantNickname: reg.nickname,
      applicantClass: reg.className,
      applicantWhatsapp: reg.whatsapp,
      applicantEmail: reg.googleEmail,
      applicantSelfieUrl: reg.selfieBase64 || reg.selfieUrl,
      registrationId: reg.id,
      submittedAt: reg.submittedAt,
    }).catch((err) => {
      console.warn('Background resend referral email warning:', err?.message || err);
    });

    res.json({
      success: true,
      emailSent: true,
      message: `Email notifikasi referral berhasil dikirim ulang ke ${referralName} (${referralEmail}).`,
    });
  },

  /**
   * GET /api/v1/alumni-registration/verify-email-action?token=...&action=approve|reject
   * Direct one-click approval / rejection from referral email
   */
  async verifyEmailAction(req: Request, res: Response): Promise<void> {
    const { token, action } = req.query;
    const jwtSecret = process.env.JWT_SECRET || 'RUANG59_SUPER_SECURE_JWT_SECRET_KEY_99_ALUMNI_AUTHENTICATION_2026';

    if (!token || typeof token !== 'string') {
      res.status(400).send(
        renderResponseHtml({
          title: 'Tautan Tidak Valid',
          message: 'Tautan verifikasi email tidak valid atau parameter tidak lengkap.',
          isSuccess: false,
        })
      );
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      const { registrationId, referralEmail } = decoded;

      const reg = await prisma.alumniRegistration.findUnique({
        where: { id: registrationId },
      });

      if (!reg) {
        res.status(404).send(
          renderResponseHtml({
            title: 'Data Tidak Ditemukan',
            message: 'Data permohonan alumni tidak ditemukan di sistem database.',
            isSuccess: false,
          })
        );
        return;
      }

      if (reg.status === 'approved') {
        res.send(
          renderResponseHtml({
            title: 'Pendaftaran Sudah Disetujui',
            message: `Pendaftaran rekan alumni <strong>${reg.fullName}</strong> (${reg.className}) sudah disetujui sebelumnya. Akun tersebut kini sudah aktif di Forsil 99.`,
            isSuccess: true,
            badgeText: 'SUDAH AKTIF ✅',
          })
        );
        return;
      }

      if (action === 'approve') {
        const updatedReg = await prisma.alumniRegistration.update({
          where: { id: registrationId },
          data: {
            status: 'approved',
            reviewedAt: new Date(),
            reviewedBy: `email_action:${referralEmail || 'referral'}`,
          },
        });

        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { googleUid: reg.googleUid },
              { id: reg.googleUid },
              { email: reg.googleEmail },
              { phoneNumber: reg.whatsapp },
            ],
          },
        });

        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              verificationStatus: 'approved',
              isActive: true,
              profile: {
                update: {
                  verifiedAt: new Date(),
                },
              },
            },
          });
        } else {
          await prisma.user.create({
            data: {
              googleUid: reg.googleUid,
              email: reg.googleEmail,
              phoneNumber: reg.whatsapp,
              roles: ['alumni'],
              verificationStatus: 'approved',
              isActive: true,
              profile: {
                create: {
                  fullName: reg.fullName,
                  nickname: reg.nickname,
                  className: reg.className,
                  profilePhotoUrl: reg.selfieBase64 || reg.selfieUrl || null,
                  graduationYear: 1999,
                  schoolCode: 'SMAN59JKT',
                  searchKeywords: [reg.fullName.toLowerCase(), reg.className.toLowerCase()],
                  verifiedAt: new Date(),
                },
              },
            },
          });
        }

        // Auto-Follow: Newly approved applicant automatically follows the referrer
        try {
          const applicantUser = await prisma.user.findFirst({
            where: {
              OR: [{ googleUid: reg.googleUid }, { email: reg.googleEmail }],
            },
          });

          const referrerUser = await prisma.user.findFirst({
            where: {
              OR: [
                { id: reg.referralAccountId },
                { profile: { userId: reg.referralAccountId } },
                { email: referralEmail || 'mscodx@gmail.com' },
              ],
            },
          });

          if (applicantUser && referrerUser && applicantUser.id !== referrerUser.id) {
            await prisma.follow.upsert({
              where: {
                followerId_followingId: {
                  followerId: applicantUser.id,
                  followingId: referrerUser.id,
                },
              },
              update: {},
              create: {
                followerId: applicantUser.id,
                followingId: referrerUser.id,
              },
            });
          }
        } catch (e) {
          console.warn('Auto-follow referral email approval error:', e);
        }

        try {
          await sendRegistrationApprovedEmail({
            toEmail: reg.googleEmail,
            fullName: reg.fullName,
            className: reg.className,
          });
        } catch (e) {
          console.warn('Non-blocking approval email error:', e);
        }

        res.send(
          renderResponseHtml({
            title: 'Persetujuan Berhasil! 🎉',
            message: `Terima kasih! Rekan alumni <strong>${reg.fullName}</strong> (Kelas ${reg.className}) telah berhasil Anda setujui untuk bergabung ke <strong>Forsil 99 SMAN 59 Jakarta</strong>.<br/><br/>Email notifikasi sukses telah dikirimkan ke <strong>${reg.googleEmail}</strong>.`,
            isSuccess: true,
            badgeText: 'BERHASIL DISETUJUI ✅',
          })
        );
      } else {
        await prisma.alumniRegistration.update({
          where: { id: registrationId },
          data: {
            status: 'rejected',
            reviewedAt: new Date(),
            reviewedBy: `email_action:${referralEmail || 'referral'}`,
          },
        });

        res.send(
          renderResponseHtml({
            title: 'Pendaftaran Ditolak',
            message: `Pendaftaran atas nama <strong>${reg.fullName}</strong> telah ditolak. Terima kasih atas partisipasi Anda dalam menjaga validitas alumni Forsil 99.`,
            isSuccess: false,
            badgeText: 'PENDAFTARAN DITOLAK ❌',
          })
        );
      }
    } catch (err: any) {
      res.status(400).send(
        renderResponseHtml({
          title: 'Tautan Kedaluwarsa',
          message: 'Tautan konfirmasi email ini sudah kedaluwarsa atau token tidak valid.',
          isSuccess: false,
        })
      );
    }
  },
};

function renderResponseHtml(opts: {
  title: string;
  message: string;
  isSuccess: boolean;
  badgeText?: string;
}): string {
  const { title, message, isSuccess, badgeText } = opts;
  const themeColor = isSuccess ? '#16A34A' : '#DC2626';
  const badgeBg = isSuccess ? '#DCFCE7' : '#FEE2E2';
  const badgeColor = isSuccess ? '#166534' : '#991B1B';

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - Forsil 99 SMAN 59 Jakarta</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0F172A; margin: 0; padding: 20px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { max-width: 520px; width: 100%; background: #1E293B; border-radius: 20px; padding: 36px 28px; text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .badge { display: inline-block; padding: 6px 16px; border-radius: 999px; font-size: 13px; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; margin-bottom: 20px; }
        .icon-circle { width: 80px; height: 80px; border-radius: 40px; background: ${isSuccess ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)'}; border: 2px solid ${themeColor}; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 38px; }
        h1 { color: #FFFFFF; font-size: 24px; font-weight: 800; margin: 0 0 12px; }
        p { color: #CBD5E1; font-size: 15px; line-height: 1.6; margin: 0 0 28px; }
        .btn-app { display: inline-block; background: #2563EB; color: #FFFFFF; text-decoration: none; font-weight: 700; padding: 14px 28px; border-radius: 12px; font-size: 15px; box-shadow: 0 4px 14px rgba(37,99,235,0.4); }
        .footer { font-size: 12px; color: #64748B; margin-top: 28px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 18px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon-circle">${isSuccess ? '🎉' : '🛡️'}</div>
        ${badgeText ? `<div class="badge">${badgeText}</div>` : ''}
        <h1>${title}</h1>
        <p>${message}</p>
        <div class="footer">
          Forum Silaturahmi Alumni SMAN 59 Jakarta (Forsil 99)
        </div>
      </div>
    </body>
    </html>
  `;
}

