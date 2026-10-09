import { describe, it, expect, vi } from 'vitest';
import { PostgrestClient } from '../src/client.js';
import { SupabaseStoreRepository } from '../src/repositories/store-repository.js';
import { SupabaseProfileRepository } from '../src/repositories/profile-repository.js';
import { SupabaseStoreMemberRepository } from '../src/repositories/store-member-repository.js';

describe('Tenancy Repositories', () => {
  it('SupabaseStoreRepository: findById, findBySlug, create, update', async () => {
    const mockStoreRow = {
      id: 'store-123',
      owner_user_id: 'user-owner',
      name: 'Bintang Pilot Store',
      slug: 'bintang-pilot',
      template_version_id: null,
      status: 'ACTIVE',
      currency: 'IDR',
      settings: { theme: 'dark' },
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify([mockStoreRow]), { status: 201 });
      }
      if (init?.method === 'PATCH') {
        return new Response(JSON.stringify([{ ...mockStoreRow, name: 'Updated Bintang Store' }]), {
          status: 200,
        });
      }
      return new Response(JSON.stringify([mockStoreRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseStoreRepository(client);

    const store = await repo.findById('store-123');
    expect(store).not.toBeNull();
    expect(store?.id).toBe('store-123');
    expect(store?.ownerUserId).toBe('user-owner');
    expect(store?.name).toBe('Bintang Pilot Store');

    const created = await repo.create({
      ownerUserId: 'user-owner',
      name: 'Bintang Pilot Store',
      slug: 'bintang-pilot',
      templateVersionId: null,
      status: 'ACTIVE',
      currency: 'IDR',
      settings: { theme: 'dark' },
    });
    expect(created.slug).toBe('bintang-pilot');

    const updated = await repo.update('store-123', { name: 'Updated Bintang Store' });
    expect(updated.name).toBe('Updated Bintang Store');
  });

  it('SupabaseProfileRepository: findById, create', async () => {
    const mockProfileRow = {
      id: 'user-owner',
      full_name: 'Bintang Owner',
      avatar_url: null,
      platform_role: 'PLATFORM_OWNER',
      status: 'ACTIVE',
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([mockProfileRow]), { status: 200 }));

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseProfileRepository(client);
    const profile = await repo.findById('user-owner');
    expect(profile).not.toBeNull();
    expect(profile?.platformRole).toBe('PLATFORM_OWNER');
    expect(profile?.fullName).toBe('Bintang Owner');
  });

  it('SupabaseStoreMemberRepository: findByStoreAndUser, delete', async () => {
    const mockMemberRow = {
      id: 'member-1',
      store_id: 'store-123',
      user_id: 'user-staff',
      role: 'STORE_STAFF',
      status: 'ACTIVE',
      created_at: '2026-10-08T00:00:00Z',
      updated_at: '2026-10-08T00:00:00Z',
    };

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return new Response(JSON.stringify([mockMemberRow]), { status: 200 });
      }
      return new Response(JSON.stringify([mockMemberRow]), { status: 200 });
    });

    const client = new PostgrestClient({
      supabaseUrl: 'https://nowyzlyruzlokiejvtne.supabase.co',
      supabaseKey: 'test-key',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const repo = new SupabaseStoreMemberRepository(client);
    const member = await repo.findByStoreAndUser('store-123', 'user-staff');
    expect(member).not.toBeNull();
    expect(member?.role).toBe('STORE_STAFF');

    const deleted = await repo.delete('member-1');
    expect(deleted).toBe(true);
  });
});
