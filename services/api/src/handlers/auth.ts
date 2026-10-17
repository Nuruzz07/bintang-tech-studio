/**
 * Bintang Tech Studio — Authentication Gateway Handlers
 * Powered by Supabase Auth (Email OTP & Google OAuth)
 */

import { ParsedRequest } from '../router.js';
import { ApiDependencies, ApiResponse } from '../types.js';
import { BadRequestError, UnauthorizedError } from '../errors.js';

interface SupabaseAuthConfig {
  supabaseUrl: string;
  anonKey: string;
}

function getSupabaseConfig(): SupabaseAuthConfig {
  const env = typeof process !== 'undefined' ? process.env : {};
  return {
    supabaseUrl: (
      env?.['SUPABASE_STAGING_URL'] || 'https://vaaixneyotrilqfkulqw.supabase.co'
    ).replace(/\/+$/, ''),
    anonKey: env?.['SUPABASE_STAGING_ANON_KEY'] || '',
  };
}

export async function handleAuthSignUp(
  req: ParsedRequest,
  _deps: ApiDependencies,
): Promise<{ status: number; body: ApiResponse<Record<string, unknown>> }> {
  const body = await req.getBody<{
    email?: string;
    password?: string;
    fullName?: string;
    storeName?: string;
  }>();

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const fullName = (body.fullName || '').trim();

  if (!email || !email.includes('@')) {
    throw new BadRequestError('Format alamat email tidak valid');
  }
  if (!password || password.length < 6) {
    throw new BadRequestError('Password minimal 6 karakter');
  }

  const { supabaseUrl, anonKey } = getSupabaseConfig();
  if (!anonKey) {
    throw new BadRequestError('Supabase Anon Key belum terkonfigurasi di server');
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          full_name: fullName || 'Seller Bintang',
          store_name: body.storeName || 'Toko Digital',
        },
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (data['msg'] as string) ||
        (data['message'] as string) ||
        (data['error_description'] as string) ||
        'Gagal mendaftar akun';

      // If user already registered, automatically resend confirmation OTP if not yet confirmed
      if (
        msg.toLowerCase().includes('already registered') ||
        msg.toLowerCase().includes('already exists')
      ) {
        try {
          const resendRes = await fetch(`${supabaseUrl}/auth/v1/resend`, {
            method: 'POST',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, type: 'signup' }),
          });

          if (resendRes.ok) {
            return {
              status: 200,
              body: {
                data: {
                  success: true,
                  email,
                  isExistingUnconfirmed: true,
                  message:
                    'Email ini sudah pernah didaftarkan. Kode verifikasi (OTP) baru telah dikirimkan ke email kamu untuk menyelesaikan aktivasi.',
                },
              },
            };
          }
        } catch {
          // fallback to error below
        }

        throw new BadRequestError(
          'Email ini sudah terdaftar dan akun Anda sudah aktif. Silakan masuk menggunakan tab Masuk (Login) atau Lanjutkan dengan Google.',
        );
      }

      throw new BadRequestError(msg);
    }

    // Check if user was already confirmed (Supabase returns empty identities array when user already exists & is confirmed)
    const identities = data['identities'] as Array<unknown> | undefined;
    if (Array.isArray(identities) && identities.length === 0) {
      throw new BadRequestError(
        'Email ini sudah terdaftar dan akun Anda sudah aktif. Silakan masuk menggunakan tab Masuk (Login) atau Lanjutkan dengan Google.',
      );
    }

    return {
      status: 201,
      body: {
        data: {
          success: true,
          email,
          userId: data['id'],
          confirmationSentAt: data['confirmation_sent_at'],
          message:
            'Kode OTP verifikasi telah dikirim ke alamat email kamu. Silakan masukkan kode untuk mengaktifkan akun.',
        },
      },
    };
  } catch (err: unknown) {
    if (err instanceof BadRequestError) throw err;
    throw new BadRequestError(
      `Gagal menghubungi server autentikasi: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function handleAuthVerifyOtp(
  req: ParsedRequest,
  deps: ApiDependencies,
): Promise<{ status: number; body: ApiResponse<Record<string, unknown>> }> {
  const body = await req.getBody<{
    email?: string;
    token?: string;
    type?: string;
  }>();

  const email = (body.email || '').trim().toLowerCase();
  const token = (body.token || '').trim();
  const type = body.type || 'signup';

  if (!email || !token) {
    throw new BadRequestError('Email dan token OTP wajib diisi');
  }

  const { supabaseUrl, anonKey } = getSupabaseConfig();
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        email,
        token,
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (data['msg'] as string) ||
        (data['message'] as string) ||
        (data['error_description'] as string) ||
        'Kode OTP tidak valid atau telah kedaluwarsa';
      throw new BadRequestError(msg);
    }

    const userObj = data['user'] as Record<string, unknown> | undefined;
    const userId = userObj?.['id'] as string | undefined;
    let storeInfo: Record<string, unknown> | null = null;

    if (deps.storeRepo && userId) {
      try {
        const existingStores = await deps.storeRepo.findByOwnerUserId(userId);
        const existingStore = existingStores[0];
        if (existingStore) {
          const s = existingStore;
          storeInfo = {
            id: s.id,
            name: s.name,
            slug: s.slug,
            status: s.status,
            currency: s.currency,
          };
        } else {
          const userMeta = (userObj?.['user_metadata'] || {}) as Record<string, unknown>;
          const storeName =
            (userMeta['store_name'] as string) ||
            (userMeta['full_name'] ? `${userMeta['full_name']} Store` : 'Toko Digital');
          const slugBase =
            storeName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || 'store';
          const slug = `${slugBase}-${userId.slice(0, 6)}`;
          const newStore = await deps.storeRepo.create({
            ownerUserId: userId,
            name: storeName,
            slug,
            templateVersionId: null,
            status: 'ACTIVE',
            currency: 'IDR',
            settings: {
              storeName,
              tagline: 'Produk digital, langsung beres.',
              telegramBotUsername: '@BintangDigitalDemoBot',
            },
          });
          storeInfo = {
            id: newStore.id,
            name: newStore.name,
            slug: newStore.slug,
            status: newStore.status,
            currency: newStore.currency,
          };
        }
      } catch (storeErr) {
        deps.logger.warn('Failed to resolve or provision tenant store upon OTP verification', {
          userId,
          error: storeErr instanceof Error ? storeErr.message : String(storeErr),
        });
      }
    }

    return {
      status: 200,
      body: {
        data: {
          success: true,
          accessToken: data['access_token'],
          refreshToken: data['refresh_token'],
          user: data['user'],
          store: storeInfo,
          message: 'Akun berhasil diverifikasi dan aktif! Selamat datang di Bintang Tech Studio.',
        },
      },
    };
  } catch (err: unknown) {
    if (err instanceof BadRequestError) throw err;
    throw new BadRequestError(
      `Gagal memverifikasi OTP: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function handleAuthLogin(
  req: ParsedRequest,
  deps: ApiDependencies,
): Promise<{ status: number; body: ApiResponse<Record<string, unknown>> }> {
  const body = await req.getBody<{
    email?: string;
    password?: string;
  }>();

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) {
    throw new BadRequestError('Email dan password wajib diisi');
  }

  const { supabaseUrl, anonKey } = getSupabaseConfig();
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (data['error_description'] as string) ||
        (data['msg'] as string) ||
        (data['message'] as string) ||
        'Email atau password salah';
      throw new UnauthorizedError(msg);
    }

    const userObj = data['user'] as Record<string, unknown> | undefined;
    const userId = userObj?.['id'] as string | undefined;
    let storeInfo: Record<string, unknown> | null = null;

    if (deps.storeRepo && userId) {
      try {
        const existingStores = await deps.storeRepo.findByOwnerUserId(userId);
        const existingStore = existingStores[0];
        if (existingStore) {
          const s = existingStore;
          storeInfo = {
            id: s.id,
            name: s.name,
            slug: s.slug,
            status: s.status,
            currency: s.currency,
          };
        } else {
          const userMeta = (userObj?.['user_metadata'] || {}) as Record<string, unknown>;
          const storeName =
            (userMeta['store_name'] as string) ||
            (userMeta['full_name'] ? `${userMeta['full_name']} Store` : 'Toko Digital');
          const slugBase =
            storeName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || 'store';
          const slug = `${slugBase}-${userId.slice(0, 6)}`;
          const newStore = await deps.storeRepo.create({
            ownerUserId: userId,
            name: storeName,
            slug,
            templateVersionId: null,
            status: 'ACTIVE',
            currency: 'IDR',
            settings: {
              storeName,
              tagline: 'Produk digital, langsung beres.',
              telegramBotUsername: '@BintangDigitalDemoBot',
            },
          });
          storeInfo = {
            id: newStore.id,
            name: newStore.name,
            slug: newStore.slug,
            status: newStore.status,
            currency: newStore.currency,
          };
        }
      } catch (storeErr) {
        deps.logger.warn('Failed to resolve or provision tenant store upon login', {
          userId,
          error: storeErr instanceof Error ? storeErr.message : String(storeErr),
        });
      }
    }

    return {
      status: 200,
      body: {
        data: {
          success: true,
          accessToken: data['access_token'],
          refreshToken: data['refresh_token'],
          user: data['user'],
          store: storeInfo,
        },
      },
    };
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError || err instanceof BadRequestError) throw err;
    throw new UnauthorizedError(`Gagal login: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function handleAuthResendOtp(
  req: ParsedRequest,
  _deps: ApiDependencies,
): Promise<{ status: number; body: ApiResponse<Record<string, unknown>> }> {
  const body = await req.getBody<{ email?: string; type?: string }>();
  const email = (body.email || '').trim().toLowerCase();
  const type = body.type || 'signup';

  if (!email || !email.includes('@')) {
    throw new BadRequestError('Format alamat email tidak valid');
  }

  const { supabaseUrl, anonKey } = getSupabaseConfig();
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/resend`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, type }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const msg =
        (data['msg'] as string) ||
        (data['message'] as string) ||
        (data['error_description'] as string) ||
        'Gagal mengirim ulang kode OTP';
      throw new BadRequestError(msg);
    }

    return {
      status: 200,
      body: {
        data: {
          success: true,
          email,
          message: 'Kode OTP baru telah dikirimkan ke email kamu!',
        },
      },
    };
  } catch (err: unknown) {
    if (err instanceof BadRequestError) throw err;
    throw new BadRequestError(
      `Gagal mengirim ulang OTP: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
