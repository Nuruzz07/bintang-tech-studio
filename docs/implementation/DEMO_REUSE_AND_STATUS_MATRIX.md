# Bintang Tech Studio : Demo Reuse and Status Matrix
## Baseline : Milestone M15 Hardening and Ecosystem Demo

Dokumen ini memetakan seluruh komponen arsitektur Bintang Tech Studio, membedakan implementasi domain/backend aktual dengan representasi visual demo, serta mendokumentasikan bagian yang digunakan kembali (*reused*) dan batasan (*limitations*).

---

### Matrix Komponen Ekosistem

| Komponen | Existing Source | Actual Status | Demo Reuse | Missing Pieces / Gap Produksi |
|---|---|---|---|---|
| **Identitas Brand & Logo** | `logo.svg`, `apps/customer-store/src/ui/icons.ts`, `tokens.ts` | `EXISTS_AND_TESTED` | Digunakan penuh pada seluruh header demo, landing page, dan simulator. | Tidak ada. Aset SVG resmi dipertahankan tanpa modifikasi. |
| **Katalog Produk & Seed** | `apps/customer-store/src/catalog-seed.ts`, `@bintang/commerce` | `EXISTS_AND_TESTED` | 36 produk komersial nyata di 8 kategori di-seed langsung ke `CatalogService` & `InventoryService`. | Asset gambar eksternal di-render dengan monogram fallback bergradien CSS resmi. |
| **Customer Telegram Mini App** | `apps/customer-store/src/ui/storefront-view.ts`, `packages/telegram/src/mini-app.ts` | `EXISTS_AND_TESTED` | Frame simulator Telegram WebApp dengan tab Home, Produk, Pesanan, dan Akun. | Tidak menggunakan koneksi Telegram bot token asli; berjalan di lingkungan browser lokal. |
| **Seller Dashboard** | `apps/seller-dashboard/src/ui/dashboard-views.ts`, `seller-dashboard-service.ts` | `EXISTS_AND_TESTED` | Antarmuka SaaS 13 modul (Overview, Produk, Inventaris, Pesanan, dsb.) dengan data pesanan sinkron. | Webhook outbox background worker tidak berjalan terdistribusi di background demo. |
| **Telegram Seller Bot Simulator** | `packages/telegram/src/command-router.ts`, `packages/telegram/src/adapter.ts` | `EXISTS_AND_TESTED` | Chat simulator visual dengan perintah `/start`, `/products`, `/orders`, notifikasi order masuk, dan tombol buka dashboard. | Real Telegram Bot API webhook sengaja dinonaktifkan untuk mencegah outbound network traffic. |
| **WhatsApp Customer Bot Simulator** | `packages/channels` (domain concept) | `MOCK_OR_SIMULATION` | Simulator obrolan WhatsApp dengan alur sambutan, katalog, detail produk, ringkasan keranjang, dan link checkout. | Tidak ada koneksi Meta Cloud API live; seluruh alur murni simulasi interaktif lokal. |
| **Customer Web Store (Opsional)** | `apps/customer-store/src/ui/storefront-view.ts` | `EXISTS_AND_TESTED` | Storefront tampilan web penuh responsif yang menunjukkan channel website add-on untuk seller. | Domain kustom DNS multi-tenant dinamis belum diuji pada server live. |
| **Platform Owner Console** | `apps/owner-console/src/ui/views.ts`, `owner-console-service.ts` | `EXISTS_AND_TESTED` | Control plane platform untuk mengelola tenant/toko, paket langganan (Starter/Pro/Business), add-on, dan audit log. | Metrik server live digantikan dengan telemetri in-memory demo. |
| **Platform Landing Page** | `services/api/src/handlers/demo.ts`, brand tokens | `PLANNED` | Landing page komersial menjelaskan model rental platform (Owner -> Seller -> Customer), paket starter Rp50rb/bln, dan tombol demo. | Harga Pro dan Business disajikan sebagai "Hubungi Kami" (belum difinalkan manajemen). |
| **Shared Order Engine** | `@bintang/orders`, `@bintang/commerce`, `@bintang/inventory`, `@bintang/tenancy` | `EXISTS_AND_TESTED` | State terpadu: order dibuat dari Customer Store / Mini App langsung terbaca di Seller Dashboard dan Seller Bot. | Transaksi payment gateway live digantikan dengan verifikasi simulasi instan. |
| **Idempotency & Database Locking** | `@bintang/database`, `packages/database/src/repositories/idempotency-repository.ts` | `EXISTS_AND_TESTED` | Serialisasi request checkout berbasis kunci idempotensi unik dan proteksi lease `PENDING`. | Migrasi database staging `20261010150000` belum dieksekusi menunggu persetujuan eksplisit. |
| **Bintang Store : F&B Jastip (Kopi Kenangan & Janji Jiwa)** | `KopKen-main/kopken.html`, `janjijiwa.html`, `menu.json`, `outlet.json` | `EXISTS_AND_TESTED` | Direpresentasikan pada `/demo/portfolio#kopken` lengkap dengan simulasi radar GPS 1.328 outlet, customizer racikan, dan modul SplitPay. | Dijalankan sebagai showcase interaktif terintegrasi pada Demo Hub tanpa merombak file statis asli. |
| **Bintang Store : Produk Digital** | `KopKen-main/digital-legacy.html`, `canva.html` | `EXISTS_AND_TESTED` | Ditransformasi menjadi 36 produk komersial `@bintang/customer-store` di Mini App `/demo/store` dan Web Store `/demo/web-store`. | Pengiriman serial key live digantikan dengan generator kredensial instan lokal. |
| **Unified Live Order Tracker** | `KopKen-main/tracking.html` | `EXISTS_AND_TESTED` | Disimulasikan pada `/demo/portfolio#tracker` dengan kartu QRIS interaktif, countdown timer 15 menit, dan 4 tahapan progres pesanan. | State pelacakan tersinkronisasi in-process dengan pesanan demo. |
| **Digital Minimal Reference Template** | `KopKen-main/Bintang-Tech-Studio/portfolio/digital-minimal` | `EXISTS_AND_TESTED` | Diadopsi sebagai pola arsitektur referensi MPA zero-build untuk tenant di `/demo/portfolio#template`. | Zero bundler runtime dipertahankan untuk performa rendering sub-300ms. |
| **Abang GTC WhatsApp Bot** | `C:\BOT_WEB\abang-gtc-source.zip` | `EXISTS_AND_TESTED` | Dipelihara secara terisolasi tanpa modifikasi; didokumentasikan di matriks sebagai bot eksternal khusus lookup nomor. | Beroperasi secara independen di luar siklus rilis monorepo Bintang Tech Studio. |

---

### Keterangan Status Komponen
- `EXISTS_AND_TESTED`: Kode telah diuji dengan test suite monorepo (119 file test lolos) atau diverifikasi pada arsip kode sumber riil.
- `MOCK_OR_SIMULATION`: Fungsionalitas disimulasikan secara lokal untuk keamanan dan integritas tanpa dependensi eksternal berbayar/live.
- `PLANNED`: Komponen baru yang dibangun pada rute demo terpadu di `services/api`.

