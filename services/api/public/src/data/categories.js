// Bintang Store — Categories Configuration
// Standard categories for digital commerce

export const CATEGORIES_DATA = [
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
];

export const CATEGORY_NAMES = ['Semua', ...CATEGORIES_DATA.map((c) => c.name)];
