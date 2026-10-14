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
      throw new BadRequestError(msg);
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
  _deps: ApiDependencies,
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

    return {
      status: 200,
      body: {
        data: {
          success: true,
          accessToken: data['access_token'],
          refreshToken: data['refresh_token'],
          user: data['user'],
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
  _deps: ApiDependencies,
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

    return {
      status: 200,
      body: {
        data: {
          success: true,
          accessToken: data['access_token'],
          refreshToken: data['refresh_token'],
          user: data['user'],
        },
      },
    };
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError || err instanceof BadRequestError) throw err;
    throw new UnauthorizedError(`Gagal login: ${err instanceof Error ? err.message : String(err)}`);
  }
}
