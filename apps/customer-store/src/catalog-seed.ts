/**
 * Bintang Tech Studio — Template 01 Catalog Seed & Migration Utility.
 * Baseline: Milestone M10 Customer Store Migration.
 *
 * Migrates Template 01's proven 8 categories and 36 commercial digital products
 * into the authoritative M05 CatalogService and M06 InventoryService.
 * Operation is deterministic and idempotent (safe to run repeatedly).
 */

import {
  StoreContext,
  AuthenticatedStoreContext,
  createAuthenticatedStoreContext,
} from '@bintang/tenancy';
import { CatalogService } from '@bintang/commerce';
import { InventoryService } from '@bintang/inventory';
import { CustomerPromotionalVoucherView } from './types.js';

export interface SeedCatalogResult {
  readonly storeId: string;
  readonly categoriesCreated: number;
  readonly categoriesReused: number;
  readonly productsCreated: number;
  readonly productsReused: number;
  readonly inventoryItemsInitialized: number;
}

export const TEMPLATE_01_CATEGORIES = [
  {
    id: 'cat_streaming',
    name: 'Streaming',
    slug: 'streaming',
    icon: 'video',
    description: 'Akun & langganan premium streaming film dan musik.',
    badge: 'Populer',
  },
  {
    id: 'cat_ai',
    name: 'AI & Productivity',
    slug: 'ai-productivity',
    icon: 'sparkles',
    description: 'Tools kecerdasan buatan dan produktivitas kerja modern.',
    badge: 'Trending',
  },
  {
    id: 'cat_design',
    name: 'Design',
    slug: 'design',
    icon: 'palette',
    description: 'Software desain grafis, aset premium, dan UI kit.',
    badge: 'Kreatif',
  },
  {
    id: 'cat_gaming',
    name: 'Gaming',
    slug: 'gaming',
    icon: 'gamepad',
    description: 'Voucher game, in-game currency, dan gift card.',
    badge: 'Instant',
  },
  {
    id: 'cat_software',
    name: 'Software',
    slug: 'software',
    icon: 'cpu',
    description: 'Lisensi sistem operasi, utility, dan developer tools.',
    badge: 'Original',
  },
  {
    id: 'cat_cloud',
    name: 'Cloud & Storage',
    slug: 'cloud-storage',
    icon: 'cloud',
    description: 'Penyimpanan awan kapasitas besar dan backup data.',
    badge: 'Aman',
  },
  {
    id: 'cat_education',
    name: 'Education',
    slug: 'education',
    icon: 'book',
    description: 'Akun belajar bahasa, riset, dan literatur akademik.',
    badge: 'Pelajar',
  },
  {
    id: 'cat_tools',
    name: 'Digital Tools',
    slug: 'digital-tools',
    icon: 'wrench',
    description: 'Aplikasi video editor, finance, dan dashboard template.',
    badge: 'Praktis',
  },
] as const;

export const TEMPLATE_01_PRODUCTS = [
  // 1. Streaming (5)
  {
    id: 'prod_spotify_prem',
    name: 'Spotify Premium',
    categorySlug: 'streaming',
    price: 19000,
    originalPrice: 55000,
    duration: '1 Bulan (Private)',
    shortDescription: 'Akun Spotify Premium bebas iklan, unduh offline & audio 320kbps.',
    description:
      'Nikmati jutaan lagu dan podcast tanpa iklan. Kualitas audio Very High 320kbps. Akun anti-banned dengan perpanjangan mudah.',
    stock: 24,
    badge: 'BEST SELLER',
    rating: 4.9,
    soldCount: 1420,
    monogram: 'SP',
    benefits: ['Bebas iklan 100%', 'Unduh lagu offline', 'Audio 320 kbps', 'Garansi 30 hari'],
    importantInfo:
      'Login menggunakan akun yang diberikan. Boleh ganti password profil Anda sendiri.',
    credentialSecret: 'SPOTIFY:user=bintang.spot.892@gmail.com|pass=SPOT-PREM-PASS-2026',
  },
  {
    id: 'prod_yt_prem',
    name: 'YouTube Premium',
    categorySlug: 'streaming',
    price: 18000,
    originalPrice: 49000,
    duration: '1 Bulan (Email Sendiri)',
    shortDescription: 'Bebas iklan YouTube & YouTube Music, putar di latar belakang.',
    description:
      'Nonton video tanpa jeda iklan. Termasuk YouTube Music Premium. Background Play aktif.',
    stock: 30,
    badge: 'POPULAR',
    rating: 4.9,
    soldCount: 980,
    monogram: 'YT',
    benefits: [
      'Tanpa iklan di semua perangkat',
      'Background Play ponsel',
      'YouTube Music Premium',
      'Aktivasi email pribadi',
    ],
    importantInfo:
      'Email belum pernah bergabung dengan grup Google Family lain dalam 12 bulan terakhir.',
    credentialSecret: 'INVITE_LINK:https://families.google.com/join/bintang-yt-fam-991',
  },
  {
    id: 'prod_netflix_prem',
    name: 'Netflix 4K UHD',
    categorySlug: 'streaming',
    price: 28000,
    originalPrice: 65000,
    duration: '1 Bulan (1 Profil 1 User)',
    shortDescription: 'Streaming film & serial kualitas 4K UHD + HDR, profil pribadi ber-PIN.',
    description:
      'Akses penuh Netflix Premium 4K UHD Ultra HD. 1 Profil khusus dilengkapi PIN privat.',
    stock: 18,
    badge: '4K UHD',
    rating: 4.8,
    soldCount: 2150,
    monogram: 'NF',
    benefits: [
      'Resolusi 4K UHD + HDR',
      'PIN profil khusus',
      'Bebas ganti nama & avatar',
      'Garansi full durasi',
    ],
    importantInfo: '1 profil hanya untuk 1 perangkat aktif bersamaan.',
    credentialSecret: 'NETFLIX:email=nf.bintang.771@gmail.com|pass=Net-Flix-Bintang-2026|pin=4821',
  },
  {
    id: 'prod_disney_hotstar',
    name: 'Disney+ Hotstar',
    categorySlug: 'streaming',
    price: 24000,
    originalPrice: 65000,
    duration: '1 Bulan (Akun Pribadi)',
    shortDescription: 'Marvel, Disney, Pixar, Star Wars & film lokal terlengkap.',
    description:
      'Tonton film blockbuster Disney, Pixar, Marvel Studios, Star Wars, dan National Geographic.',
    stock: 15,
    badge: 'HEMAT',
    rating: 4.8,
    soldCount: 640,
    monogram: 'DS',
    benefits: [
      'Kualitas Full HD / 4K',
      'Semua film Marvel & Disney',
      'Audio Dolby Atmos',
      'Garansi pergantian akun',
    ],
    importantInfo: 'Login via nomor HP dan kode OTP yang kami bantu verifikasi.',
    credentialSecret: 'DISNEY:phone=+6281239847123|access_code=DISNEY-HOTSTAR-VIP-881',
  },
  {
    id: 'prod_vidio_plat',
    name: 'Vidio Platinum',
    categorySlug: 'streaming',
    price: 15000,
    originalPrice: 39000,
    duration: '30 Hari (All Device)',
    shortDescription:
      'Nonton tayangan olahraga, sinetron, serial original Vidio & film box office.',
    description:
      'Langganan Vidio Platinum untuk menyaksikan BRI Liga 1, tayangan olahraga unggulan, dan drama Asia.',
    stock: 40,
    badge: 'SPORTS',
    rating: 4.7,
    soldCount: 520,
    monogram: 'VD',
    benefits: [
      'BRI Liga 1 lengkap',
      'Vidio Original Series',
      'Bebas iklan video',
      'Bisa nonton di Smart TV',
    ],
    importantInfo: 'Paket Platinum (tidak termasuk Premier League / Formula 1 tertentu).',
    credentialSecret: 'VIDIO:user=vidio.plat.bintang@gmail.com|pass=VidioPlat2026',
  },

  // 2. AI & Productivity (6)
  {
    id: 'prod_chatgpt_plus',
    name: 'ChatGPT Plus (GPT-4o)',
    categorySlug: 'ai-productivity',
    price: 45000,
    originalPrice: 350000,
    duration: '1 Bulan (Shared 3 User)',
    shortDescription:
      'Akses GPT-4o, canvas, data analysis, DALL-E 3 image generator & web browsing.',
    description:
      'Gunakan kecerdasan model GPT-4o terbaru tanpa antre. Kuota respons lebih cepat dan akses fitur beta.',
    stock: 12,
    badge: 'TOP AI',
    rating: 5.0,
    soldCount: 3100,
    monogram: 'CG',
    benefits: [
      'Model GPT-4o & GPT-4 Turbo',
      'Canvas interaktif',
      'DALL-E 3 generator',
      'Analisis spreadsheet',
    ],
    importantInfo: 'Shared maksimal 3 pengguna. Jangan utak-atik nomor ponsel/password utama.',
    credentialSecret: 'CHATGPT:email=ai.gpt4o.slot3@bintang.tech|pass=GPT4o-Studio-Pro-2026',
  },
  {
    id: 'prod_gemini_adv',
    name: 'Gemini Advanced 1.5 Pro',
    categorySlug: 'ai-productivity',
    price: 39000,
    originalPrice: 300000,
    duration: '1 Bulan (Private Akun)',
    shortDescription:
      'Model 1.5 Pro konteks 1 juta token, integrasi Google Workspace & 2TB Google One.',
    description:
      'Model Gemini tercanggih dengan context window 1M token. Mampu membaca buku dan ratusan baris kode.',
    stock: 16,
    badge: 'GOOGLE AI',
    rating: 4.9,
    soldCount: 890,
    monogram: 'GA',
    benefits: [
      '1 Juta token context window',
      'Integrasi Gmail/Docs/Drive',
      '2TB Google One storage',
      'Akun privat email baru',
    ],
    importantInfo: 'Disediakan akun Google baru yang sudah aktif paket Google One AI Premium.',
    credentialSecret: 'GOOGLE_ONE:user=gemini.adv.user11@gmail.com|pass=Gemini-Adv-2026-Pass',
  },
  {
    id: 'prod_claude_pro',
    name: 'Claude Pro (Sonnet 3.5)',
    categorySlug: 'ai-productivity',
    price: 49000,
    originalPrice: 350000,
    duration: '1 Bulan (Shared Anti-Limit)',
    shortDescription: 'Akses Claude 3.5 Sonnet terbaik untuk coding, copywriting & analisis logis.',
    description:
      'Model penalaran nomor 1 untuk software engineer dan researcher. Dilengkapi fitur Artifacts interaktif.',
    stock: 10,
    badge: 'CODER CHOICE',
    rating: 5.0,
    soldCount: 1750,
    monogram: 'CP',
    benefits: [
      'Model Claude 3.5 Sonnet',
      'Fitur interaktif Artifacts',
      'Kemampuan coding superior',
      'Slot privat per chat',
    ],
    importantInfo: 'Gunakan percakapan masing-masing. Jangan hapus chat pengguna lain.',
    credentialSecret: 'CLAUDE:user=claude.sonnet35@bintang.tech|pass=Anthropic-Sonnet-2026',
  },
  {
    id: 'prod_midjourney_std',
    name: 'Midjourney Standard',
    categorySlug: 'ai-productivity',
    price: 55000,
    originalPrice: 480000,
    duration: '1 Bulan (Shared Stealth Mode)',
    shortDescription: 'Generator gambar AI paling fotorealistik di dunia via Discord bot.',
    description:
      'Buat karya seni, mockup visual, dan rendering fotorealistik kelas industri dengan prompt teks.',
    stock: 8,
    badge: 'CREATIVE AI',
    rating: 4.9,
    soldCount: 1120,
    monogram: 'MJ',
    benefits: [
      '15 Jam Fast GPU Time/bulan',
      'Generasi Relax tanpa batas',
      'Akses Discord server khusus',
      'Download resolusi penuh',
    ],
    importantInfo: 'Gunakan channel private thread di server Discord yang kami tentukan.',
    credentialSecret: 'DISCORD_MJ:token=mjt_discord_auth_bintang_std_2026|channel_id=12903810293',
  },
  {
    id: 'prod_perplexity_pro',
    name: 'Perplexity AI Pro',
    categorySlug: 'ai-productivity',
    price: 35000,
    originalPrice: 300000,
    duration: '1 Bulan (Akun Baru)',
    shortDescription: 'Mesin pencari AI dengan sitasi sumber akademik, Claude 3.5 & GPT-4o engine.',
    description:
      'Riset jurnal, coding, dan pencarian referensi mendalam dengan kutipan sitasi ilmiah akurat.',
    stock: 20,
    badge: 'RESEARCH',
    rating: 4.8,
    soldCount: 670,
    monogram: 'PX',
    benefits: [
      '300+ Pro Searches per hari',
      'Pilihan engine Claude & GPT-4o',
      'Unggah dokumen & PDF riset',
      'Koleksi sitasi sumber',
    ],
    importantInfo: 'Akun private siap pakai. Email & password dapat diubah pembeli.',
    credentialSecret: 'PERPLEXITY:user=pplx.bintang.pro@gmail.com|pass=PPLX-Pro-Bintang-2026',
  },
  {
    id: 'prod_notion_ai',
    name: 'Notion Plus + AI',
    categorySlug: 'ai-productivity',
    price: 29000,
    originalPrice: 180000,
    duration: '1 Tahun (Unlimited AI)',
    shortDescription:
      'Ruang kerja digital all-in-one untuk catatan, database, proyek & asisten AI.',
    description:
      'Workspace kolaborasi dengan fitur AI terintegrasi untuk menyusun ringkasan dokumen dan roadmap.',
    stock: 25,
    badge: 'WORKSPACE',
    rating: 4.9,
    soldCount: 840,
    monogram: 'NT',
    benefits: [
      'Notion Plus plan 1 tahun',
      'Fitur Notion AI Unlimited',
      'Database & blocks tanpa batas',
      'Invite workspace pribadi',
    ],
    importantInfo: 'Aktivasi via tautan undangan workspace yang sudah memiliki lisensi aktif.',
    credentialSecret: 'NOTION_INVITE:https://notion.so/invite/bintang-plus-workspace-2026',
  },

  // 3. Design (5)
  {
    id: 'prod_canva_pro',
    name: 'Canva Pro 1 Tahun',
    categorySlug: 'design',
    price: 15000,
    originalPrice: 95000,
    duration: '1 Tahun (Invite Tim Edu)',
    shortDescription: '100+ juta template premium, Magic Studio AI & background remover 1-klik.',
    description:
      'Akses penuh Canva Pro: font premium, elemen grafis, resize instan, dan tools Magic AI.',
    stock: 80,
    badge: 'PALING LARIS',
    rating: 5.0,
    soldCount: 8900,
    monogram: 'CV',
    benefits: [
      '100+ Juta foto & elemen',
      'Hapus latar belakang 1-klik',
      'Magic Studio AI Tools',
      'Aktivasi email sendiri',
    ],
    importantInfo: 'Bisa email baru atau email lama yang sudah terdaftar Canva.',
    credentialSecret:
      'CANVA_INVITE:https://www.canva.com/brand/join?token=canva_bintang_pro_edu_team_2026',
  },
  {
    id: 'prod_adobe_cc',
    name: 'Adobe CC All Apps',
    categorySlug: 'design',
    price: 85000,
    originalPrice: 850000,
    duration: '1 Bulan (Email Sendiri)',
    shortDescription: 'Photoshop, Illustrator, Premiere Pro, After Effects + 100GB Cloud.',
    description:
      'Paket terlengkap semua aplikasi Adobe Desktop & iPad dengan fitur Generative Fill AI resmi.',
    stock: 14,
    badge: 'RESMI',
    rating: 4.9,
    soldCount: 760,
    monogram: 'AD',
    benefits: [
      '20+ Aplikasi Adobe resmi',
      'Generative Fill Firefly AI',
      '100GB Adobe Creative Cloud',
      'Langsung di aplikasi asli',
    ],
    importantInfo:
      'Kirimkan email Adobe Anda via catatan transaksi untuk di-invite ke lisensi tim.',
    credentialSecret: 'ADOBE_LICENSE:team_invite=bintang-creative-enterprise|slot_id=AD-CC-2026-99',
  },
  {
    id: 'prod_freepik_prem',
    name: 'Freepik Premium',
    categorySlug: 'design',
    price: 25000,
    originalPrice: 220000,
    duration: '1 Bulan (100 Aset/Hari)',
    shortDescription:
      'Unduh jutaan vektor, file PSD, foto stok resolusi tinggi bebas lisensi komersial.',
    description:
      'Akses katalog aset desain terbesar dunia untuk desainer grafis dan digital agency.',
    stock: 19,
    badge: 'VEKTOR',
    rating: 4.8,
    soldCount: 430,
    monogram: 'FP',
    benefits: [
      'Koleksi Vektor & PSD premium',
      'Lisensi komersial bebas royalti',
      'Kuota 100 download/hari',
      'Garansi full 30 hari',
    ],
    importantInfo: 'Akun privat login web resmi Freepik.',
    credentialSecret: 'FREEPIK:user=fp.bintang.prem@gmail.com|pass=FreepikBintang2026',
  },
  {
    id: 'prod_envato_elements',
    name: 'Envato Elements',
    categorySlug: 'design',
    price: 35000,
    originalPrice: 450000,
    duration: '1 Bulan (Unlimited Download)',
    shortDescription: 'Font, audio effect, video footage, template web WordPress & 3D render.',
    description:
      'Sumber daya multimedia tak terbatas untuk video editor, desainer web, dan kreator konten.',
    stock: 11,
    badge: 'UNLIMITED',
    rating: 4.9,
    soldCount: 920,
    monogram: 'EE',
    benefits: [
      'Unduh font & audio tak terbatas',
      'Video template Premiere/AE',
      'Template WordPress & HTML',
      'Akun stabil anti-logout',
    ],
    importantInfo: 'Akun shared via ekstensi browser atau direct login resmi.',
    credentialSecret: 'ENVATO:user=envato.bintang.vip@gmail.com|pass=EnvatoElements2026',
  },
  {
    id: 'prod_mega_asset_pack',
    name: 'Mega Asset Pack 500+ UI & 3D',
    categorySlug: 'design',
    price: 39000,
    originalPrice: 250000,
    duration: 'Akses Selamanya (Drive VIP)',
    shortDescription: '500+ Figma UI Kit, 3D icon pack, mockup presentasi & motion asset pack.',
    description:
      'Koleksi aset desain profesional siap pakai untuk mempercepat pembuatan prototipe antarmuka aplikasi.',
    stock: 999,
    badge: 'LIFETIME',
    rating: 4.9,
    soldCount: 1650,
    monogram: 'AP',
    benefits: [
      '500+ Komponen Figma auto-layout',
      'Ikon 3D format PNG/BLENDER',
      'Mockup device resolusi tinggi',
      'Akses Google Drive selamanya',
    ],
    importantInfo:
      'Tautan Google Drive VIP langsung dikirim seketika saat pembayaran diverifikasi.',
    credentialSecret:
      'VIP_DRIVE_LINK:https://drive.google.com/drive/folders/1bintang-mega-asset-pack-2026-vip',
  },

  // 4. Gaming (5)
  {
    id: 'prod_steam_100k',
    name: 'Steam Wallet IDR 100k',
    categorySlug: 'gaming',
    price: 105000,
    originalPrice: 105000,
    duration: 'Kode Digital (15 Digit)',
    shortDescription:
      'Kode voucher resmi Steam Wallet Indonesia untuk beli game dan item Dota/CS2.',
    description: 'Isi saldo Steam Wallet Anda langsung dengan kode voucher resmi 15 digit.',
    stock: 35,
    badge: 'INSTANT KODE',
    rating: 5.0,
    soldCount: 4200,
    monogram: 'SW',
    benefits: [
      'Saldo IDR 100.000 bersih',
      'Kode resmi Valve terverifikasi',
      'Bisa beli game diskon Steam',
      'Tanpa potongan kartu kredit',
    ],
    importantInfo: 'Redeem di aplikasi Steam client menu Games > Redeem a Steam Wallet Code.',
    credentialSecret: 'STEAM_CODE:STM-9921-XAKQ-4819',
  },
  {
    id: 'prod_mlbb_284',
    name: 'Mobile Legends 284 Diamond',
    categorySlug: 'gaming',
    price: 72000,
    originalPrice: 85000,
    duration: 'Instant Top-Up (ID & Server)',
    shortDescription: '284 Diamonds Mobile Legends resmi Moonton untuk gacha skin impian Anda.',
    description:
      'Top-up kilat Diamond Mobile Legends Bang Bang. Cukup sertakan User ID dan Zone ID.',
    stock: 50,
    badge: 'TOP-UP KILAT',
    rating: 4.9,
    soldCount: 3800,
    monogram: 'ML',
    benefits: [
      '284 Diamond masuk instan',
      'Aman 100% anti-minus Moonton',
      'Hitung event top-up resmi',
      'Layanan 24 jam bot otomatis',
    ],
    importantInfo: 'Tuliskan User ID & Zone ID di kolom catatan pesanan (contoh: 12345678 (2021)).',
    credentialSecret: 'TOPUP_RECEIPT:MLBB-284D-TXID-99214810-SUCCESS',
  },
  {
    id: 'prod_val_1000',
    name: 'Valorant 1000 Points',
    categorySlug: 'gaming',
    price: 125000,
    originalPrice: 140000,
    duration: 'Kode Redeem Riot Client',
    shortDescription:
      '1000 Valorant Points untuk beli skin senjata Kuronami, Reaver & Battle Pass.',
    description:
      'Voucher resmi Riot Games Valorant Indonesia untuk membuka skin bundle dan skin tier atas.',
    stock: 22,
    badge: 'RIOT CODE',
    rating: 4.9,
    soldCount: 1540,
    monogram: 'VP',
    benefits: [
      '1000 Valorant Points',
      'Bisa beli Battle Pass aktif',
      'Kode digital instan',
      'Server Indonesia / Asia Pasifik',
    ],
    importantInfo: 'Redeem di dalam in-game store menu Prepaid Cards & Codes.',
    credentialSecret: 'RIOT_CODE:RA-ID-1000-881924194',
  },
  {
    id: 'prod_genshin_welkin',
    name: 'Genshin Welkin Moon',
    categorySlug: 'gaming',
    price: 75000,
    originalPrice: 89000,
    duration: 'UID & Region Server',
    shortDescription:
      'Blessing of the Welkin Moon: 300 Genesis Crystals + 90 Primogems setiap hari.',
    description:
      'Investasi terbaik di Genshin Impact. Dapatkan total 3000 Primogems selama 30 hari.',
    stock: 28,
    badge: 'PRIMOGEMS',
    rating: 5.0,
    soldCount: 2900,
    monogram: 'GI',
    benefits: [
      '300 Genesis Crystals instan',
      '90 Primogems/hari x 30 hari',
      'Bisa ditumpuk hingga 180 hari',
      'Hanya butuh UID & Server',
    ],
    importantInfo: 'Sertakan UID dan Server (Asia / America / Europe) di catatan.',
    credentialSecret: 'GENSHIN_RECEIPT:WELKIN-UID-PROCESSED-CONFIRMED',
  },
  {
    id: 'prod_roblox_800',
    name: 'Roblox 800 Robux',
    categorySlug: 'gaming',
    price: 130000,
    originalPrice: 160000,
    duration: 'Digital Gift Card',
    shortDescription:
      '800 Robux resmi via kartu hadiah digital untuk beli avatar & item game Roblox.',
    description:
      'Kode voucher digital resmi Roblox untuk membeli item avatar, aksesoris, dan pass game favorit.',
    stock: 20,
    badge: 'ROBUX RESMI',
    rating: 4.8,
    soldCount: 950,
    monogram: 'RB',
    benefits: [
      '800 Robux bersih',
      'Item virtual eksklusif gratis',
      'Redeem di roblox.com/redeem',
      'Aman tanpa login akun pembeli',
    ],
    importantInfo: 'Kode digital 16 digit dapat langsung dimasukkan di website Roblox resmi.',
    credentialSecret: 'ROBLOX_PIN:RBX-8821-4910-8812',
  },

  // 5. Software (5)
  {
    id: 'prod_win11_pro',
    name: 'Windows 11 Pro Retail',
    categorySlug: 'software',
    price: 45000,
    originalPrice: 2500000,
    duration: 'Lifetime (1 PC Online Bind)',
    shortDescription: 'Lisensi resmi Retail Key Windows 11 Pro 64-bit aktivasi online permanen.',
    description:
      'Aktifkan Windows 11 Pro Anda secara legal dan permanen. Bebas watermark, update keamanan lancar.',
    stock: 45,
    badge: 'RETAIL ORI',
    rating: 5.0,
    soldCount: 6200,
    monogram: 'W1',
    benefits: [
      'Lisensi tipe RETAIL resmi',
      'Aktivasi langsung via Settings',
      'Update resmi Microsoft lancar',
      'Garansi aktivasi sukses 100%',
    ],
    importantInfo: 'Bukan versi KMS atau crack. Masukkan product key 25 digit langsung di Windows.',
    credentialSecret: 'WIN11_KEY:W11PR-9921A-KDJQ1-88294-BINTG',
  },
  {
    id: 'prod_m365_pro',
    name: 'Microsoft 365 Pro Plus',
    categorySlug: 'software',
    price: 39000,
    originalPrice: 1200000,
    duration: '5 Perangkat + 5TB Cloud',
    shortDescription: 'Word, Excel, PowerPoint, Outlook versi desktop terbaru + 5TB OneDrive.',
    description:
      'Aplikasi perkantoran standar dunia untuk 5 perangkat (PC/Mac/Android/iOS) dilengkapi 5TB storage.',
    stock: 35,
    badge: 'OFFICE ORI',
    rating: 4.9,
    soldCount: 3400,
    monogram: 'M3',
    benefits: [
      'Aplikasi Office Desktop resmi',
      'Bisa login di 5 device',
      'Penyimpanan 5TB OneDrive',
      'Bebas ganti password saat login',
    ],
    importantInfo:
      'Disediakan akun Microsoft Enterprise baru. Ganti password profil saat login pertama kali.',
    credentialSecret: 'OFFICE365:user=nur.office.bintang@msft365pro.org|pass=Office-Bintang-2026',
  },
  {
    id: 'prod_idm_lifetime',
    name: 'IDM Lifetime License',
    categorySlug: 'software',
    price: 29000,
    originalPrice: 350000,
    duration: 'Lifetime (Serial Asli)',
    shortDescription:
      'Internet Download Manager serial key resmi aktivasi seumur hidup tanpa trial expired.',
    description:
      'Tingkatkan kecepatan download hingga 5x lipat dengan IDM original. Fitur resume download otomatis.',
    stock: 50,
    badge: 'SERIAL ORI',
    rating: 4.9,
    soldCount: 1800,
    monogram: 'ID',
    benefits: [
      'Download 5x lebih cepat',
      'Bebas notifikasi popup palsu',
      'Resume download file rusak',
      'Lisensi serial key permanen',
    ],
    importantInfo: 'Gunakan installer resmi dari internetdownloadmanager.com.',
    credentialSecret: 'IDM_KEY:IDM-8829-1092-4819-BINT',
  },
  {
    id: 'prod_nordvpn_1y',
    name: 'NordVPN 1 Tahun',
    categorySlug: 'software',
    price: 49000,
    originalPrice: 950000,
    duration: '1 Tahun (Shared Akun)',
    shortDescription: 'Koneksi ultra-cepat 6000+ server di 111 negara, enkripsi AES-256 militer.',
    description:
      'Buka blokir situs, amankan data di Wi-Fi publik, dan nikmati streaming luar negeri tanpa buffering.',
    stock: 15,
    badge: 'KEAMANAN',
    rating: 4.8,
    soldCount: 880,
    monogram: 'NV',
    benefits: [
      '6000+ Server dunia',
      'Enkripsi kelas militer',
      'Fitur Threat Protection malware',
      'Garansi akun aktif 1 tahun',
    ],
    importantInfo: 'Shared akun untuk 1 perangkat aktif Anda.',
    credentialSecret: 'NORDVPN:user=nord.bintang.sec@gmail.com|pass=NordSecBintang2026',
  },
  {
    id: 'prod_jetbrains_all',
    name: 'JetBrains All Products Pack',
    categorySlug: 'software',
    price: 65000,
    originalPrice: 3500000,
    duration: '1 Tahun (Akun Pelajar)',
    shortDescription: 'IntelliJ IDEA, PyCharm, WebStorm, PhpStorm, GoLand, DataGrip & CLion.',
    description:
      'IDE terlengkap bagi software engineer profesional untuk pengembangan Java, Python, TypeScript, dan PHP.',
    stock: 10,
    badge: 'DEV TOOLS',
    rating: 5.0,
    soldCount: 720,
    monogram: 'JB',
    benefits: [
      'Semua 16 IDE JetBrains',
      'Plugin & AI Assistant aktif',
      'Lisensi legal resmi 1 tahun',
      'Bisa aktivasi di akun JetBrains Anda',
    ],
    importantInfo: 'Disediakan akun email institusi atau invite lisensi developer.',
    credentialSecret:
      'JETBRAINS:user=dev.bintang.student@alumni.univ.edu|pass=JetBrains-AllPack-2026',
  },

  // 6. Cloud & Storage (4)
  {
    id: 'prod_gdrive_1tb',
    name: 'Google Drive 1TB Custom',
    categorySlug: 'cloud-storage',
    price: 49000,
    originalPrice: 350000,
    duration: '1 Tahun (Akun GSuite Baru)',
    shortDescription:
      'Penyimpanan Google Drive 1000GB aman, shared folder & backup foto Google Photos.',
    description:
      'Ruang penyimpanan awan berkapasitas besar untuk backup foto, video 4K, dan arsip dokumen kerja Anda.',
    stock: 20,
    badge: '1TB CLOUD',
    rating: 4.9,
    soldCount: 1100,
    monogram: 'GD',
    benefits: [
      'Kapasitas 1000GB bersih',
      'Google Photos kualitas original',
      'Bebas akses Google Workspace',
      'Garansi perpanjangan mudah',
    ],
    importantInfo: 'Akun Google baru dengan username kustom pilihan Anda.',
    credentialSecret: 'GDRIVE:email=backup.bintang.user@gworkspace.pro|pass=GDrive1TBPass2026',
  },
  {
    id: 'prod_onedrive_5tb',
    name: 'OneDrive 5TB Storage',
    categorySlug: 'cloud-storage',
    price: 29000,
    originalPrice: 250000,
    duration: 'Lifetime (Domain Custom)',
    shortDescription: 'Penyimpanan awan Microsoft OneDrive 5.000GB sinkronisasi instan Windows 11.',
    description:
      'Kapasitas 5TB langsung di explorer Windows Anda. Mudah berbagi file besar via tautan publik.',
    stock: 30,
    badge: '5TB JUMBO',
    rating: 4.7,
    soldCount: 890,
    monogram: 'OD',
    benefits: [
      '5.000GB Cloud Storage',
      'Sinkronisasi instan di Windows',
      'Bisa buka file via web & HP',
      'Garansi ganti akun jika kendala',
    ],
    importantInfo:
      'Akun Microsoft domain institusi. Disarankan tidak menyimpan data sensitif perbankan.',
    credentialSecret: 'ONEDRIVE5TB:user=cloud.bintang.5tb@onedrivepro.me|pass=ODrive5TBPass2026',
  },
  {
    id: 'prod_icloud_200gb',
    name: 'iCloud+ 200GB Family',
    categorySlug: 'cloud-storage',
    price: 35000,
    originalPrice: 45000,
    duration: '1 Bulan (Apple Family)',
    shortDescription: 'Backup iPhone, iPad & Mac aman. Fitur Private Relay & Hide My Email aktif.',
    description:
      'Perluas ruang penyimpanan cadangan perangkat Apple Anda tanpa langganan kartu kredit bulanan.',
    stock: 12,
    badge: 'APPLE RESMI',
    rating: 4.9,
    soldCount: 650,
    monogram: 'IC',
    benefits: [
      'Penyimpanan 200GB terbagi',
      'Backup iCloud Foto aman',
      'Fitur iCloud Private Relay',
      'Aktivasi via Apple ID pribadi',
    ],
    importantInfo: 'Apple ID Anda belum pernah tergabung dalam grup Family Sharing lain.',
    credentialSecret:
      'ICLOUD_INVITE:https://apple.com/family-sharing/invite?code=icloud-bintang-fam-2026',
  },
  {
    id: 'prod_mega_2tb',
    name: 'Mega.nz Pro I 2TB',
    categorySlug: 'cloud-storage',
    price: 55000,
    originalPrice: 180000,
    duration: '1 Bulan (Akun Private)',
    shortDescription: 'Penyimpanan awan terenkripsi zero-knowledge end-to-end, kuota transfer 2TB.',
    description:
      'Layanan cloud paling privat dengan enkripsi client-side. Kecepatan download maksimum tanpa limit.',
    stock: 10,
    badge: 'ENKRIPSI',
    rating: 4.8,
    soldCount: 420,
    monogram: 'MG',
    benefits: [
      '2000GB Storage aman',
      '2TB Transfer download bulanan',
      'Enkripsi zero-knowledge',
      'Bebas ganti email & password',
    ],
    importantInfo: 'Akun privat email baru. Simpan Recovery Key yang diberikan secara aman.',
    credentialSecret:
      'MEGA:user=mega.pro.bintang@gmail.com|pass=MegaPro2TBPass2026|recovery_key=MG-KEY-99124',
  },

  // 7. Education (3)
  {
    id: 'prod_duolingo_super',
    name: 'Duolingo Super Unlimited',
    categorySlug: 'education',
    price: 22000,
    originalPrice: 99000,
    duration: '1 Tahun (Family Plan)',
    shortDescription:
      'Belajar bahasa Inggris, Jepang & Korea tanpa batas nyawa (Unlimited Hearts).',
    description:
      'Tingkatkan kemampuan bahasa asing tanpa stres. Bebas gangguan iklan dan ulasan materi latihan.',
    stock: 40,
    badge: 'BAHASA',
    rating: 5.0,
    soldCount: 2100,
    monogram: 'DL',
    benefits: [
      'Nyawa latihan tak terbatas',
      'Bebas iklan visual & audio',
      'Latihan kesalahan fokus',
      'Aktivasi ke akun Duolingo Anda',
    ],
    importantInfo: 'Kirimkan username Duolingo Anda atau klik tautan invite yang kami kirimkan.',
    credentialSecret: 'DUOLINGO_INVITE:https://invite.duolingo.com/family/bintang-super-2026-slot1',
  },
  {
    id: 'prod_grammarly_prem',
    name: 'Grammarly Premium',
    categorySlug: 'education',
    price: 29000,
    originalPrice: 450000,
    duration: '1 Bulan (Akun Private)',
    shortDescription:
      'Koreksi tata bahasa Inggris mutakhir, nada bicara (tone), dan deteksi plagiarisme.',
    description:
      'Sempurnakan esai akademik, email profesional, dan artikel ilmiah dengan saran kosakata tingkat lanjut.',
    stock: 18,
    badge: 'AKADEMIK',
    rating: 4.9,
    soldCount: 1350,
    monogram: 'GR',
    benefits: [
      'Koreksi tata bahasa lanjutan',
      'Penyesuaian nada bicara formal',
      'Plagiarism checker terintegrasi',
      'Ekstensi browser & MS Word',
    ],
    importantInfo: 'Akun private siap pakai. Bebas ubah password profil.',
    credentialSecret: 'GRAMMARLY:user=grammarly.prem.bintang@gmail.com|pass=GrammarlyPrem2026',
  },
  {
    id: 'prod_turnitin_check',
    name: 'Turnitin No-Repository',
    categorySlug: 'education',
    price: 35000,
    originalPrice: 250000,
    duration: '1 Bulan (Slot Pengecekan)',
    shortDescription: 'Cek plagiarisme skripsi & jurnal aman tanpa tersimpan di database kampus.',
    description:
      'Pengecekan kemiripan dokumen mahasiswa dengan setting No-Repository resmi Turnitin Instructor.',
    stock: 25,
    badge: 'BEBAS REPO',
    rating: 5.0,
    soldCount: 3100,
    monogram: 'TN',
    benefits: [
      'Setting No-Repository 100%',
      'File TIDAK AKAN tersimpan di server',
      'Laporan PDF persentase lengkap',
      'Aman untuk pra-sidang skripsi',
    ],
    importantInfo:
      'Unggah file dokumen Anda via link dashboard pemeriksa khusus yang kami sediakan.',
    credentialSecret:
      'TURNITIN_ACCESS:portal_url=https://turnitin.bintang.tech/student|access_token=TN-NOREPO-2026-VIP',
  },

  // 8. Digital Tools (3)
  {
    id: 'prod_capcut_pro',
    name: 'CapCut Pro PC & Mobile',
    categorySlug: 'digital-tools',
    price: 29000,
    originalPrice: 129000,
    duration: '1 Bulan (Akun Shared)',
    shortDescription: 'Semua efek video pro, auto-caption akurat, teks animasi & export 4K 60fps.',
    description:
      'Aplikasi video editor andalan kreator TikTok, Reels, dan YouTube Shorts dengan efek pro dan AI captions.',
    stock: 22,
    badge: 'KREATOR VT',
    rating: 4.9,
    soldCount: 2800,
    monogram: 'CC',
    benefits: [
      'Semua efek & transisi Pro',
      'Auto-caption teks bahasa Indo',
      'Export 4K tanpa watermark',
      'Dapat dipakai di PC dan HP',
    ],
    importantInfo: 'Login via akun TikTok/Google yang sudah kami berikan akses CapCut Pro.',
    credentialSecret: 'CAPCUT:user=capcut.pro.bintang@gmail.com|pass=CapCutProBintang2026',
  },
  {
    id: 'prod_tradingview_plus',
    name: 'TradingView Plus Pro',
    categorySlug: 'digital-tools',
    price: 59000,
    originalPrice: 450000,
    duration: '1 Bulan (Akun Baru)',
    shortDescription:
      '5 Indikator per chart, 2 chart per tab, interval waktu kustom & alert instan.',
    description:
      'Platform analisis teknikal saham, kripto, dan forex terkemuka dunia tanpa iklan dengan multi-chart layout.',
    stock: 10,
    badge: 'TRADER',
    rating: 4.8,
    soldCount: 540,
    monogram: 'TV',
    benefits: [
      '5 Indikator teknikal bersamaan',
      'Multi-chart 2 grafik seimbang',
      'Bebas iklan mengganggu',
      'Alert harga instan SMS/Email',
    ],
    importantInfo: 'Akun TradingView private baru siap pakai.',
    credentialSecret: 'TRADINGVIEW:user=tv.trader.bintang@gmail.com|pass=TradingViewPro2026',
  },
  {
    id: 'prod_creator_starter',
    name: 'Mega Creator Starter Kit',
    categorySlug: 'digital-tools',
    price: 49000,
    originalPrice: 500000,
    duration: 'Direct Link VIP (Cloud 50GB)',
    shortDescription:
      '10.000+ Sound effect viral, preset Lightroom, font kreator & template reels.',
    description:
      'Kumpulan amunisi video editing lengkap: SFX viral, BGM bebas royalti, LUT warna film, dan hook text template.',
    stock: 999,
    badge: '50GB ASET',
    rating: 5.0,
    soldCount: 3900,
    monogram: 'MK',
    benefits: [
      '10.000+ Sound effect viral',
      '500+ Preset Lightroom Desktop/Mobile',
      '300+ Font kreator pilihan',
      'Download direct link super cepat',
    ],
    importantInfo: 'Akses Google Drive VIP permanen. Bebas download kapan saja.',
    credentialSecret:
      'CREATOR_KIT_LINK:https://drive.google.com/drive/folders/1bintang-creator-kit-2026-vip',
  },
] as const;

export const TEMPLATE_01_PROMOTIONAL_VOUCHERS: readonly CustomerPromotionalVoucherView[] = [
  {
    code: 'BINTANG10',
    name: 'Promo Bintang 10%',
    description: 'Diskon 10% untuk semua produk digital tanpa batas kategori.',
    badge: 'Diskon 10%',
    discountText: 'Hemat 10% (Maks Rp 25.000)',
    status: 'ACTIVE',
  },
  {
    code: 'STARTER5',
    name: 'Potongan Pelanggan Baru',
    description: 'Potongan Rp5.000 untuk transaksi minimal Rp25.000.',
    badge: 'Hemat Rp5.000',
    discountText: 'Potongan Rp 5.000',
    status: 'ACTIVE',
  },
  {
    code: 'PROMOHEMAT',
    name: 'Flash Promo Toko',
    description: 'Diskon spesial 15% untuk transaksi minimal Rp50.000.',
    badge: 'Diskon 15%',
    discountText: 'Hemat 15% (Maks Rp 30.000)',
    status: 'ACTIVE',
  },
  {
    code: 'DIGITALVIP',
    name: 'Spesial Pelanggan Setia',
    description: 'Diskon 20% untuk pembelian grosir atau bundle minimal Rp100.000.',
    badge: 'Diskon 20%',
    discountText: 'Hemat 20% (Maks Rp 50.000)',
    status: 'ACTIVE',
  },
  {
    code: 'EXPIRED2025',
    name: 'Promo Tahun Lalu (Kedaluwarsa)',
    description: 'Voucher promo tahun lalu.',
    badge: 'Kedaluwarsa',
    discountText: 'Hemat 25%',
    status: 'EXPIRED',
  },
];

/**
 * Seeds the 8 categories and 36 products into CatalogService and InventoryService.
 * Reuses existing categories/products by slug to maintain idempotency.
 */
export async function seedTemplate01Catalog(
  storeContext: StoreContext,
  catalogService: CatalogService,
  inventoryService?: InventoryService,
): Promise<SeedCatalogResult> {
  const storeId = storeContext.storeId;

  const adminContext: AuthenticatedStoreContext =
    'role' in storeContext && (storeContext as AuthenticatedStoreContext).role === 'STORE_ADMIN'
      ? (storeContext as AuthenticatedStoreContext)
      : createAuthenticatedStoreContext({
          storeId,
          userId: `system:catalog-seed:${storeId}`,
          membershipId: `sys_mem_${storeId}`,
          role: 'STORE_ADMIN',
        });

  // 1. Seed Categories
  const existingCategories = await catalogService.listCategories(adminContext, {
    includeArchived: true,
  });
  const categoryBySlug = new Map<string, string>(); // slug -> categoryId
  let categoriesCreated = 0;
  let categoriesReused = 0;

  for (const cat of existingCategories) {
    categoryBySlug.set(cat.slug, cat.id);
  }

  for (let i = 0; i < TEMPLATE_01_CATEGORIES.length; i++) {
    const catData = TEMPLATE_01_CATEGORIES[i]!;
    if (categoryBySlug.has(catData.slug)) {
      categoriesReused++;
      continue;
    }

    const created = await catalogService.createCategory(adminContext, {
      name: catData.name,
      slug: catData.slug,
      description: catData.description,
      sortOrder: i + 1,
      metadata: {
        icon: catData.icon,
        badge: catData.badge,
        template01Id: catData.id,
      },
    });

    categoryBySlug.set(catData.slug, created.id);
    categoriesCreated++;
  }

  // 2. Seed Products
  const existingProducts = await catalogService.listProducts(adminContext, {
    includeArchived: true,
  });
  const productBySlug = new Map<string, string>(); // slug -> productId
  let productsCreated = 0;
  let productsReused = 0;
  let inventoryItemsInitialized = 0;

  for (const p of existingProducts) {
    productBySlug.set(p.slug, p.id);
  }

  for (const prodData of TEMPLATE_01_PRODUCTS) {
    const slug = prodData.id.replace(/^prod_/, '').replace(/_/g, '-');
    const categoryId = categoryBySlug.get(prodData.categorySlug) ?? null;

    let productId: string;

    if (productBySlug.has(slug)) {
      productId = productBySlug.get(slug)!;
      productsReused++;
    } else {
      const created = await catalogService.createProduct(adminContext, {
        name: prodData.name,
        slug,
        categoryId,
        description: prodData.description,
        productType: 'DIGITAL',
        price: prodData.price.toFixed(2),
        compareAtPrice: prodData.originalPrice.toFixed(2),
        stockMode: 'TRACKED',
        status: 'ACTIVE',
        metadata: {
          duration: prodData.duration,
          shortDescription: prodData.shortDescription,
          stock: prodData.stock,
          badge: prodData.badge,
          rating: prodData.rating,
          soldCount: prodData.soldCount,
          monogram: prodData.monogram,
          benefits: prodData.benefits,
          importantInfo: prodData.importantInfo,
          template01Id: prodData.id,
        },
      });

      productId = created.id;
      productBySlug.set(slug, productId);
      productsCreated++;
    }

    // Initialize inventory if service is available
    if (inventoryService) {
      try {
        await inventoryService.initializeInventory(adminContext, productId, prodData.stock);
        inventoryItemsInitialized++;

        // Add digital credential item if secret is provided
        if (prodData.credentialSecret) {
          await inventoryService.createInventoryItem(adminContext, {
            productId,
            secretReference: prodData.credentialSecret,
            itemType: 'CREDENTIAL',
          });
        }
      } catch {
        // Already initialized or duplicate inventory entry
      }
    }
  }

  return {
    storeId,
    categoriesCreated,
    categoriesReused,
    productsCreated,
    productsReused,
    inventoryItemsInitialized,
  };
}
