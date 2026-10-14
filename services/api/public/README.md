# Bintang Store — Template 01: Digital Storefront

> **"Produk digital, langsung beres."**  
> Digital Commerce Storefront & Mini App untuk Seller Produk Digital.

---

## 📌 Ringkasan Proyek

Proyek ini mengimplementasikan **Bintang Store**, sebuah etalase e-commerce produk digital modern, cepat, dan terintegrasi mulus sebagai **Telegram Mini App**.

Sistem ini mentransformasikan alur jualan digital manual (chat satu per satu, cek mutasi rekening manual, kirim akun manual) menjadi pengalaman belanja instan:

1. **Browse & Search**: 36 produk digital realistis di 8 kategori.
2. **Detail & Garansi**: Rincian masa aktif, fitur, dan syarat garansi.
3. **Cart & Voucher**: Pengelolaan keranjang multi-item dengan validasi kode promo (`BINTANG10`, `STARTER5`, dll).
4. **Checkout**: Pengisian data pemesan dan pemilihan metode bayar (QRIS, E-Wallet, Virtual Account).
5. **Payment Adapter**: Arsitektur pembayaran modular (`DemoPaymentAdapter` & scaffold `TipzyPaymentAdapter`).
6. **Auto-Fulfillment**: Kredensial akun, kode voucher, serial lisensi, atau link Google Drive VIP langsung terbit otomatis dalam hitungan detik.
7. **Pesanan Saya**: Riwayat transaksi lengkap dengan timeline progres 4 tahap dan tombol akses kredensial.
8. **Akun Pelanggan**: Halaman profil, daftar voucher aktif, pusat bantuan/FAQ, dan ketentuan garansi.

---

## 📁 Struktur Folder & Arsitektur

```text
Bintang-Tech-Studio/portfolio/digital-minimal/
├── index.html                  # Single Page Application entrypoint
├── webapp.html                 # Direct shortcut to Bintang Store WebApp
├── telegram.html               # Direct shortcut to Telegram Bot Simulation
├── admin.html                  # Direct shortcut to Admin Dashboard
├── telegram-admin.html         # Direct shortcut to Telegram Admin Simulation
├── README.md                   # Dokumentasi teknis & panduan QA
├── assets/
│   ├── logo.svg                # Logo resmi Bintang Tech Studio (horizon, diamond, star)
│   ├── logo(1).svg             # Backup aset logo resmi
│   └── icons/                  # Aset SVG & ikon visual
└── src/
    ├── main.js                 # Router SPA & orchestrator tampilan
    ├── data/
    │   ├── products.js         # 36 Produk digital realistis (Streaming, AI, Design, Gaming, dll)
    │   ├── categories.js       # 8 Kategori produk digital lengkap dengan metadata
    │   ├── vouchers.js         # Konfigurasi & validasi voucher (BINTANG10, STARTER5, dll)
    │   ├── orders.js           # Dummy pesanan awal (#BS-10231, dll)
    │   ├── customers.js        # Data demo pelanggan
    │   └── settings.js         # Konfigurasi toko Bintang Store
    ├── services/
    │   └── payment/
    │       ├── payment-adapter.js  # Interface abstrak PaymentAdapter
    │       ├── demo-payment.js     # DemoPaymentAdapter (simulasi QRIS & auto-verifikasi)
    │       ├── tipzy-payment.js    # TipzyPaymentAdapter (siap integrasi Tipzy.id API)
    │       └── index.js            # Entrypoint & adapter selector singleton
    ├── state/
    │   └── store.js            # Reactive state management & localStorage persistence
    ├── components/
    │   ├── demo-navbar.js      # Bar switcher demo (hanya muncul di halaman showcase luar)
    │   ├── product-card.js     # Komponen kartu produk responsif dengan monogram tile
    │   ├── modal.js            # Accessible modal dialog controller
    │   └── qris-modal.js       # Kontroler pembayaran QRIS & auto-fulfillment
    ├── pages/
    │   ├── webapp.js           # Customer storefront Bintang Store (Home, Produk, Pesanan, Akun)
    │   ├── telegram-bot.js     # Simulasi chat Telegram mobile pembeli
    │   ├── landing.js          # Halaman showcase template portofolio
    │   ├── admin.js            # Admin dashboard: overview, products, inventory, orders
    │   └── telegram-admin.js   # Simulasi asisten Telegram pemilik toko
    ├── styles/
    │   ├── design-tokens.css   # Variabel warna Bintang (Ivory, Obsidian, Terracotta, Gold)
    │   └── main.css            # Styling custom, frame Telegram, animasi laser QRIS
    └── utils/
        ├── currency.js         # Formatter Rupiah (Rp15.000)
        ├── helpers.js          # Ikon Lucide lengkap, clipboard copy, toast, escapeHtml
        └── storage.js          # LocalStorage abstraction dengan safe in-memory fallback
```

---

## 🛍️ 8 Kategori & 36 Produk Digital

| Kategori              | Jumlah | Contoh Produk                                                                                                                   |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Streaming**         | 5      | Spotify Premium, YouTube Premium, Netflix 4K UHD, Disney+ Hotstar, Vidio Platinum                                               |
| **AI & Productivity** | 6      | ChatGPT Plus (GPT-4o), Gemini Advanced 1.5 Pro, Claude Pro (Sonnet 3.5), Midjourney Standard, Perplexity AI Pro, Notion Plus AI |
| **Design**            | 5      | Canva Pro 1 Tahun, Adobe Creative Cloud All Apps, Freepik Premium, Envato Elements, Mega Asset Pack 500+ UI & 3D                |
| **Gaming**            | 5      | Steam Wallet IDR 100k, Mobile Legends 284 Diamond, Valorant 1000 Points, Genshin Welkin Moon, Roblox 800 Robux                  |
| **Software**          | 5      | Windows 11 Pro Retail, Microsoft 365 Pro Plus, IDM Lifetime, NordVPN 1 Tahun, JetBrains All Products Pack                       |
| **Cloud & Storage**   | 4      | Google Drive 1TB Custom, OneDrive 5TB Storage, iCloud+ 200GB Family, Mega.nz Pro I 2TB                                          |
| **Education**         | 3      | Duolingo Super Unlimited, Grammarly Premium, Turnitin No-Repository Student Checker                                             |
| **Digital Tools**     | 3      | CapCut Pro PC & Mobile, TradingView Plus Pro, Mega Creator Starter Kit 2026                                                     |

---

## 💳 Arsitektur Payment Adapter

Payment logic telah dipisahkan menggunakan pola **Adapter Pattern**:

```text
PaymentAdapter (Interface)
├── DemoPaymentAdapter     -> Aktif saat ini untuk simulasi cepat & mandiri
└── TipzyPaymentAdapter    -> Terstruktur & siap disambungkan dengan API Key Tipzy.id
```

Ketika kredensial API Tipzy.id (`apiKey`, `merchantCode`) diberikan di kemudian hari, sistem cukup mengaktifkan `TipzyPaymentAdapter` tanpa perlu mengubah kode frontend storefront.

---

## 🏷️ Sistem Voucher & Promo

- `BINTANG10`: Diskon 10% untuk semua produk (Min. belanja Rp10.000, Max. diskon Rp25.000).
- `STARTER5`: Potongan Rp5.000 khusus transaksi pertama (Min. belanja Rp25.000, Single Use).
- `PROMOHEMAT`: Diskon 15% untuk transaksi flash sale (Min. belanja Rp50.000).
- `DIGITALVIP`: Diskon 20% untuk paket grosir / bundle (Min. belanja Rp100.000).

Mendukung pengecekan state: `valid`, `invalid`, `expired`, `min_spend_not_met`, dan `already_used`.

---

## 📱 Pengalaman Pengguna (Customer-Only)

Pada rute `#webapp` (Customer Storefront):

- Top Demo Bar dan label developer/prototipe disembunyikan sepenuhnya.
- Tampilan dimulai langsung dari Telegram Mini App Context Bar (`← Kembali ke Bot` | `Bintang Store · Mini App` | `•••`).
- Bottom navigation eksklusif 4 tab: **Home**, **Produk**, **Pesanan**, **Akun**.
- Responsif mobile-first diuji pada lebar layar **360px, 375px, 390px, 412px, hingga 430px**.

---

## 🚀 Cara Menjalankan Project

Jalankan lokal menggunakan web server statis:

```bash
# Menggunakan serve
npx serve -l 3000

# Atau menggunakan Python HTTP Server
python -m http.server 8000
```

Buka di browser:

- **Customer Storefront**: `http://localhost:3000/webapp.html` atau `http://localhost:3000/#webapp`
- **Telegram Bot Simulator**: `http://localhost:3000/telegram.html` atau `http://localhost:3000/#telegram`
- **Admin Dashboard**: `http://localhost:3000/admin.html` atau `http://localhost:3000/#admin`
