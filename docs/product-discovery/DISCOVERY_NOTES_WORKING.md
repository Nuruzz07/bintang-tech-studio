# Bintang Tech — Catatan Discovery (Working)

> **Status:** catatan discovery sumber/riwayat. Keputusan baseline v1.0 disetujui owner pada 13 Oktober 2026 dan dicatat normatif di `PRD.md`; approval eksplisit tersebut mengesahkan seluruh rekomendasi produk dari baseline v0.4. Label rekomendasi/belum disetujui yang tersisa pada butir di bawah adalah status historis sebelum keputusan itu, bukan status saat ini. Keputusan historis, hipotesis pasar, dan bukti implementasi tetap dipisahkan.
> **Owner produk:** Nuruzz
> **Tanggal catatan:** 11 Oktober 2026; catatan approval: 13 Oktober 2026
> **Sumber:** percakapan discovery dengan Nuruzz. Catatan merangkum jawaban dan pilihan yang tercatat, bukan transkrip kata-per-kata.

## Cara membaca status

- **Dikonfirmasi oleh Nuruzz** — dinyatakan langsung atau dipilih melalui opsi dalam percakapan.
- **Arah / hipotesis** — ide yang disampaikan sebagai bayangan atau sesuatu untuk dibahas; bukan keputusan operasional final.
- **Rekomendasi asisten, belum disetujui** — usulan untuk membantu melengkapi rancangan. Jangan memperlakukannya sebagai requirement yang telah disepakati.
- **Belum diputuskan** — masih butuh diskusi, validasi, atau data.

## 1. Konteks dan tujuan produk

### Arah yang disampaikan Nuruzz

- **Dikonfirmasi:** Bintang Tech ditujukan kepada seller produk digital dari luar Bintang Store, sambil tetap dapat mengakomodasi kebutuhan Bintang Store dan berbagi ekosistem dengannya.
- **Dikonfirmasi:** ada tiga pihak yang berbeda: owner platform (Nuruzz), seller/tenant, dan pembeli akhir milik seller.
- **Dikonfirmasi sebagai tujuan/aspirasi:** seller mudah mengelola produk, pesanan, dan automasi; pembeli lebih mudah membeli, memperoleh barang/petunjuk, menghubungi seller, serta mengajukan keluhan bila ada masalah.
- **Arah / hipotesis:** hasil yang diharapkan adalah seller merasa nyaman memakai platform, pembeli lebih nyaman, penjualan terbantu, dan komplain berkurang. Ini sasaran, bukan jaminan.
- **Konteks pengalaman:** Bintang Store memiliki lini digital dan kopi; pengalaman operasionalnya menjadi sumber gagasan Bintang Tech. Pengalaman pembeli Nuruzz termasuk sulit menghubungi admin, menunggu undangan email/produk manual, serta membutuhkan bantuan pascapembelian. Sebagian masalah ini adalah pengalaman pribadi, bukan bukti frekuensi pasar.
- **Arah / hipotesis:** sasaran jangka dekat Nuruzz adalah meningkatkan pemasukan; nilai Rp5 juta/bulan pernah disebut sebagai tujuan pribadi dalam percakapan sebelumnya, bukan KPI produk yang sudah disahkan.

## 2. Produk, fulfillment, dan katalog

- **Dikonfirmasi sebagai cakupan visi:** platform perlu mendukung beberapa jenis barang/produk digital dan cara pemenuhan otomatis, invite, maupun manual. Pemilihan ini menggambarkan visi yang diinginkan; tahap implementasi belum ditentukan.
- **Dikonfirmasi pada diskusi dashboard terbaru:** seller harus dapat menambah produk jenis:
  - akun atau akses premium;
  - kode voucher/lisensi;
  - file digital, misalnya PDF atau template;
  - produk invite melalui email/akun pembeli.
- **Dikonfirmasi:** formulir tambah produk berubah sesuai jenis produk; tampilkan field yang relevan saja.
- **Dikonfirmasi:** per produk, seller dapat menentukan cara pemenuhan yang sesuai (otomatis, invite, atau manual).
- **Dikonfirmasi dari diskusi sebelumnya:** kebutuhan data pembeli dapat memakai formulir standar atau disesuaikan seller untuk produk tertentu.
- **Dikonfirmasi:** data katalog dan pesanan berasal dari satu sumber; seller dapat memilih produk yang ditampilkan pada kanal tertentu.
- **Belum diputuskan:** nama field wajib per tipe produk, pilihan/varian, mata uang/harga, pajak, stok, masa akses, media produk, dan kebijakan edit setelah produk memiliki order.
- **Belum diputuskan:** mekanisme spesifik penyimpanan/pengiriman kredensial akun, format inventory voucher, dan batas ukuran/jenis file.

## 3. Kanal dan pembayaran

- **Dikonfirmasi sebagai visi kanal pembeli:** storefront/website, Telegram, dan WhatsApp.
- **Dikonfirmasi sebagai visi Telegram:** ada bot Telegram dan Telegram Web App; keduanya bukan permukaan yang sama.
- **Dikonfirmasi:** seller mengelola melalui dashboard web dan Telegram. WhatsApp terutama disebut sebagai kanal yang masih banyak digunakan pembeli.
- **Dikonfirmasi:** seller menghubungkan payment gateway miliknya sendiri; dana transaksi tidak dikumpulkan pada satu akun platform.
- **Dikonfirmasi dari percakapan sebelumnya:** checkout web berada di website dan status order dapat dilihat/tracking di web; Telegram Web App dimaksudkan sebagai pengalaman belanja di Telegram; alur WhatsApp tetap banyak berlangsung di chat dengan QRIS/link gateway seller.
- **Belum diputuskan:** provider pembayaran yang didukung, verifikasi webhook/rekonsiliasi per provider, refund otomatis versus manual, metode cadangan, biaya transaksi, dan urutan implementasi per kanal.
- **Dikonfirmasi pada keputusan dashboard:** status payment gateway ditaruh terpisah dalam pengaturan pembayaran, bukan digabung dalam ringkasan status kanal di beranda.

## 4. Perjalanan pembeli, dukungan, dan pesanan

- **Dikonfirmasi sebagai arah alur:** untuk fulfillment otomatis, produk dikirim sesudah pembayaran dikonfirmasi/terverifikasi.
- **Dikonfirmasi:** invite dan order manual dikerjakan seller; sistem mencatat status dan pembeli dapat melihat progres melalui tracking tanpa diwajibkan memiliki akun.
- **Dikonfirmasi:** kegagalan fulfillment otomatis memicu beberapa retry otomatis; jika tetap gagal, kasus diteruskan untuk tindakan seller. Pembeli diberi kabar saat sedang diproses.
- **Dikonfirmasi:** dukungan dimulai oleh bot; jika belum menyelesaikan kebutuhan pembeli, percakapan dieskalasikan ke seller. Pembeli dapat memulai bantuan melalui tombol atau pesan biasa.
- **Arah yang dipilih:** seller memilih jenis/form data pembeli—form bawaan atau form khusus—sesuai kebutuhan.
- **Belum diputuskan:** jumlah/interval retry, daftar status order kanonis, SLA/ETA, aturan pembatalan/refund, bukti pembayaran yang diterima, kebijakan sengketa, dan persyaratan audit.

## 5. Dashboard seller — keputusan terperinci

### Beranda / antrean order

- **Dikonfirmasi:** bagian paling menonjol adalah antrean order yang perlu tindakan—misalnya order baru, tertunda, atau gagal—bukan sekadar deretan statistik.
- **Dikonfirmasi:** antrean menggunakan tab per status; urutkan order berdasarkan urgensi di dalam setiap tab.
- **Dikonfirmasi:** order selesai berada di riwayat terpisah, bukan bercampur ke antrean aktif.
- **Dikonfirmasi:** tiap order menunjukkan masalah/status dan langkah berikut yang perlu dilakukan.
- **Dikonfirmasi:** tindakan menyesuaikan kasus/order; bukan satu tombol generik yang sama untuk seluruh order.
- **Dikonfirmasi:** status toko dan kanal yang terhubung juga tampak di beranda sebagai informasi pendamping.
- **Dikonfirmasi:** jika kanal putus/perlu disetel ulang, seller dapat memulai perbaikan dari beranda.
- **Dikonfirmasi:** kartu/ringkasan kanal di beranda cukup menunjukkan status ringkas. Penyebab dan petunjuk perbaikan tampil setelah seller membuka kanal.
- **Belum diputuskan:** apakah indikator kanal juga menunjukkan health check timestamp, dampak terhadap produk/order, dan tindakan recovery yang aman.

### Detail order

- **Dikonfirmasi:** status terkini dan langkah berikutnya adalah informasi utama.
- **Dikonfirmasi:** tidak perlu linimasa riwayat perubahan status pada tampilan ini (sesuai pilihan Nuruzz dalam diskusi; audit trail untuk keperluan internal belum diputuskan).
- **Dikonfirmasi:** tampilkan status pembayaran, ringkasan nominal, dan metode pembayaran.
- **Dikonfirmasi:** bila fulfillment otomatis tetap gagal setelah retry, seller memilih tindakan sesuai penyebab—contohnya coba lagi, proses manual/invite, atau batalkan/refund.
- **Dikonfirmasi:** cara memberi kabar kepada pembeli bergantung pada kasus; seller dapat memilih pembaruan otomatis atau mengirim pesan langsung.
- **Belum diputuskan:** rincian/data pembeli yang selalu tampil, pesan dan attachment, konfirmasi sebelum refund/pembatalan, serta catatan internal seller.

## 6. Onboarding dan model bisnis

- **Dikonfirmasi sebagai arah onboarding:** panduan berurutan untuk menyiapkan toko → pembayaran → kanal → produk.
- **Dikonfirmasi sebagai model pendapatan yang ingin dieksplorasi:** langganan bulanan berjenjang.
- **Dikonfirmasi sebagai arah penawaran sebelumnya:** masa trial gratis 7 hari.
- **Hipotesis harga:** kisaran Rp50 ribu, Rp100 ribu, dan Rp150 ribu per bulan pernah dibahas untuk riset/pembandingan; bukan keputusan tarif.
- **Belum diputuskan:** biaya pendaftaran/setup, isi dan batas tiap paket, harga final, biaya penggunaan/overage/transaksi, biaya pesan/kanal, panjang trial, serta mekanisme konversi trial ke berbayar.
- **Belum diputuskan:** paket langganan ditentukan berdasarkan jumlah produk/order/channel, fitur automasi, staff, atau kombinasi lainnya.

## 7. Rekomendasi asisten — bukan keputusan Nuruzz

Item berikut pernah disarankan untuk melengkapi rancangan, tetapi belum dipilih/dikonfirmasi oleh Nuruzz. Pertahankan label ini saat mengutip atau mengubah PRD:

- Form produk umum berisi nama, deskripsi, harga, kategori, gambar, fulfillment, ketersediaan, panduan pembeli, dan kanal; varian paket/durasi dengan harga/ketersediaan berbeda.
- Status produk draf/aktif/dijeda dan pratinjau sebelum tayang.
- Order menyimpan salinan rincian saat checkout sehingga perubahan produk tidak mengubah order historis.
- Persediaan voucher dikelola sebagai kumpulan kode; file digital dikirim setelah pembayaran; invite meminta data; pemenuhan manual masuk antrean seller.
- Jangan simpan kata sandi akun seller sebagai teks biasa; perlu desain penyimpanan dan delivery credential yang aman.
- Riwayat bantuan dapat ditautkan ke order; metrik/analitik penjualan berada di halaman terpisah dari antrean kerja.
- Urutan implementasi yang diusulkan: alur inti order/dashboard web, lalu Telegram, lalu WhatsApp. Ini bukan persetujuan mengurangi visi kanal.
- Uji coba terbatas dengan beberapa seller eksternal yang mewakili pola fulfillment berbeda; Bintang Store hanya ikut jika Nuruzz memilihnya, bukan otomatis dimigrasikan/dipakai untuk produksi.
- Biaya pendaftaran nol pada awal, tiga paket berdasarkan manfaat/batas konkret, dan pengukuran kinerja lewat waktu penyelesaian, keberhasilan otomatis, order tertahan, waktu respons keluhan, aktivasi, retensi, serta biaya unit. Semua masih usulan; target angka perlu data.

## 8. Pertanyaan terbuka terpenting

1. Field/form spesifik untuk setiap jenis produk dan cara aman mengelola akun, kode, file, serta undangan.
2. Model persediaan, varian, penjadwalan harga, pembatasan produk, dan aturan perubahan produk.
3. Daftar status order beserta definisi, peralihan, SLA/ETA, retry, pembatalan, refund, dan audit trail.
4. Fitur percakapan seller-pembeli, penanganan komplain, notifikasi, dan batas kemampuan bot.
5. Provider/integrasi pembayaran serta biaya dan mekanisme verifikasi/refund.
6. Urutan peluncuran/pilot dan workflow terkecil yang diuji dengan seller eksternal—tanpa mengurangi visi produk tanpa persetujuan Nuruzz.
7. Harga dan isi paket berdasarkan biaya penyedia serta nilai untuk seller.
8. Metrik keberhasilan dan batas biaya operasional.
9. Hak akses staf seller, keamanan tenant/data pembeli, retensi data, dan kebijakan privasi.

## 9. Catatan proses

- Jangan menyamakan visi lengkap dengan tahap peluncuran pertama. Kalau mengusulkan urutan MVP/pilot, nyatakan itu sebagai usulan dan minta persetujuan sebelum mempersempit cakupan.
- Jangan mengubah hipotesis dan rekomendasi menjadi requirement confirmed.
- Dokumen ini adalah catatan discovery untuk melanjutkan percakapan, bukan bukti implementasi, verifikasi fitur live, maupun PRD yang telah disetujui.

## 10. Rekomendasi lanjutan asisten — default kerja, belum disetujui

Bagian ini melengkapi area discovery yang belum punya keputusan. Isinya adalah default rekomendasi untuk dibahas atau diuji; **bukan jawaban yang telah diberikan Nuruzz dan bukan requirement confirmed**.

### Bantuan pembeli dan komplain

- Pembeli memulai bantuan dari kanal tempat transaksi/order dibuat atau dari halaman tracking order, tanpa harus membuat akun baru jika channel tidak mensyaratkannya.
- Bot hanya menjawab dari data yang diberikan seller dan informasi order yang terverifikasi, seperti cara menggunakan produk, petunjuk aktivasi, status pesanan, serta kebijakan toko. Jika jawaban tidak ditemukan atau ragu, bot menyatakan keterbatasannya dan meneruskan ke seller, bukan mengarang.
- Eskalasi langsung ke seller untuk komplain, permintaan refund/pembatalan, pembayaran bermasalah, akses akun yang gagal, fulfillment gagal setelah retry, permintaan eksplisit untuk berbicara dengan seller, atau masalah yang bot belum berhasil selesaikan.
- Sediakan satu inbox kerja seller dengan pesan disandingkan ke order bila tersedia. Catat kanal asal dan pertahankan konteks serta percakapan terdahulu ketika kasus berpindah dari bot ke seller. Jangan menjanjikan balasan pada kanal yang tidak didukung; tampilkan instruksi kontak alternatif yang jelas.
- Status kerja percakapan yang disarankan: menunggu seller, menunggu pembeli, dan selesai. Hindari status “selesai” bila masalah belum dikonfirmasi selesai; sediakan cara membuka kasus kembali.
- Seller dapat memilih mengirim pembaruan status otomatis atau pesan langsung sesuai jenis kasus, sejalan dengan pilihan Nuruzz. Pembatalan/refund dan tindakan finansial lain tetap memerlukan keputusan/konfirmasi seller; bot tidak mengeksekusi sendiri.
- Tampilkan jam operasional/ekspektasi balasan hanya jika seller mengaturnya. Tanpa pengaturan dan data historis, jangan menampilkan SLA atau perkiraan yang dibuat-buat.

### Produk: form dinamis dan field per jenis (rekomendasi, belum disetujui)

**Catatan:** seluruh skema tabel dan perilaku field di bagian ini adalah rekomendasi, bukan keputusan Nuruzz.

Prinsip utama yang disarankan: bedakan **jenis produk** dari **cara fulfillment**. Seller memilih jenis barang yang dijual, lalu memilih cara pemenuhannya yang didukung platform; jangan menganggap setiap jenis hanya punya satu cara fulfillment. Tampilkan pertanyaan lanjutan hanya saat memang dibutuhkan oleh kombinasi pilihan tersebut.

**Informasi umum yang direkomendasikan:**

- Nama produk dan deskripsi yang dilihat pembeli.
- Harga dan mata uang; jika ada opsi/paket/durasi, tiap opsi punya harga serta ketersediaan sendiri.
- Jenis produk dan cara fulfillment yang dipilih.
- Produk/channel tempat listing muncul dan informasi yang wajib dimasukkan pembeli.
- Instruksi atau panduan setelah pembelian, serta ketentuan penggunaan/aktivasi yang seller berikan.
- Ketersediaan, batas stok jika berlaku, dan status jual (draf/aktif/dijeda/arsip).
- Sebelum publish, tunjukkan ringkasan apa yang akan dilihat pembeli, informasi yang diminta, serta cara barang dikirim.

**Field tambahan menurut jenis barang:**

| Jenis barang                   | Field seller yang direkomendasikan                                                                                             | Data pembeli / pengiriman yang disarankan                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Akun atau akses premium        | Cara memberi akses; paket/durasi; batas penggunaan; petunjuk login/aktivasi; inventori akun bila memang didukung               | Minta data paling sedikit. Jangan meminta kata sandi pribadi pembeli. Credential seller tidak boleh masuk kolom teks biasa atau log; perlu storage rahasia terenkripsi dan kontrol akses. Jika mekanisme rahasia itu belum tersedia, arahkan ke proses manual yang aman, jangan pura-pura otomatis. |
| Kode voucher/lisensi           | Jenis kode; unggah/import kode; instruksi redeem; masa berlaku/ketentuan bila ada; stok tersedia                               | Umumnya tidak perlu data tambahan selain kontak/order yang memang diperlukan. Alokasikan kode unik hanya setelah pembayaran valid, dan cegah satu kode dipakai untuk dua order.                                                                                                                     |
| File digital                   | Upload file; nama/versi; format dan ukuran yang diizinkan; deskripsi; panduan download/pakai                                   | Unduh lewat tautan yang aman; jangan membuat link publik permanen bila file hanya untuk pembeli. Bila ada batas unduh/kedaluwarsa, jelaskan sebelum checkout.                                                                                                                                       |
| Produk invite                  | Layanan/jenis akses; paket/durasi; petunjuk dan kebutuhan khusus; ETA hanya bila seller menetapkannya                          | Field email atau identifier tujuan invite yang sesuai layanan, tervalidasi formatnya. Tampilkan jelas alamat mana yang akan menerima invite sebelum pembayaran. Jangan meminta kata sandi akun pembeli.                                                                                             |
| Pesanan yang dikerjakan manual | Instruksi seller, daftar informasi yang benar-benar diperlukan, kondisi mulai/selesai, dan ETA opsional yang ditentukan seller | Form standar atau kustom seperti yang dipilih seller; beri tahu pembeli kenapa data diperlukan dan bahwa proses memerlukan tindakan seller.                                                                                                                                                         |

**Perilaku form dan validasi yang direkomendasikan:**

- Label field selalu terlihat; seller bisa menandai wajib/opsional untuk field khusus dengan batas format yang jelas. Hindari meminta data sensitif yang tidak diperlukan.
- Tampilkan contoh format/help text sebelum submit. Validasi email/identifier/kode serta field wajib di tempat yang relevan, dengan error dan cara memperbaikinya.
- Simpan produk sebagai draf secara bertahap agar isian panjang tidak hilang; sebelum aktivasi, validasi konfigurasi fulfillment, stok/ketersediaan, instruksi buyer, dan kanal.
- Preview checkout dan halaman informasi setelah beli menggunakan data contoh yang jelas diberi label, bukan statistik/testimoni atau transaksi fiktif yang tampak nyata.
- Periksa hak seller untuk menjual produk dan ketentuan layanan pihak ketiga yang bersangkutan; tandai ini sebagai prasyarat operasional untuk diteliti, bukan klaim bahwa setiap jenis akun pasti diizinkan provider.

### Produk: ketersediaan, harga, dan perubahan setelah tayang

- Tetapkan status yang berbeda untuk **draf**, **aktif**, **habis/nonaktif sementara**, dan **diarsipkan**. Rekomendasi: pengarsipan hanya menghilangkan produk dari penjualan baru, bukan menghapus order atau bukti transaksi lama.
- Untuk voucher/kode yang persediaannya nol, hentikan pembelian otomatis; jangan menerima pembayaran untuk kode yang tidak tersedia kecuali produk memang dikonfigurasi sebagai backorder/preorder dengan janji waktu yang nyata.
- Untuk file digital dan invite tanpa stok terbatas, seller dapat menjeda penjualan sendiri, misalnya saat maintenance atau kapasitas invite penuh. Tampilkan status produk yang jujur kepada pembeli.
- Sebelum perubahan harga, tipe fulfillment, kanal yang ditampilkan, atau data yang wajib diberikan pembeli disimpan, tampilkan perubahan dengan jelas. Pesanan lama mempertahankan snapshot rincian checkout dan harga yang disetujui pembeli.
- Rekomendasi: hapus permanen dibatasi bila produk sudah memiliki order, laporan, atau fulfillment yang merujuk padanya; sediakan arsip sebagai pilihan aman. Tindakan hapus/arsip membutuhkan konfirmasi yang menyebut dampaknya.
- Belum diputuskan: apakah sistem mendukung bundle, langganan/recurring seller product, pre-order/backorder, diskon/kupon, stok tanpa batas, produk tersembunyi, serta penjadwalan publikasi.

### Izin staf dan keamanan operasional

- Rekomendasi awal: peran pemilik/admin seller dan staf dengan izin minimum yang dapat dipilih berdasarkan tugas, misalnya order/fulfillment, support, katalog, serta laporan pembayaran.
- Batasi setiap akun seller hanya pada tenant/toko dan data yang berhak ia kelola. Seller tidak boleh membaca data seller lain; staf tidak otomatis mendapat akses penuh atau melihat rahasia pembayaran.
- Tampilkan konfirmasi sebelum aksi berisiko atau sulit dibatalkan, seperti refund, pembatalan order yang sudah dibayar, pengiriman ulang kode yang sensitif, serta perubahan akses staf.
- Catat pelaku dan waktu untuk aksi operasional penting agar sengketa bisa ditelusuri. Keputusan Nuruzz untuk tidak menampilkan linimasa pada halaman order tidak otomatis berarti audit internal ditiadakan.
- Tentukan kebijakan minimisasi data pembeli, durasi penyimpanan, export/penghapusan, perlindungan credential, dan proses pencabutan akses. Ini perlu tinjauan teknis dan kebijakan privasi sebelum peluncuran; jangan membuat klaim keamanan/compliance tanpa bukti.

### Pilot dan urutan implementasi yang direkomendasikan

- Pertahankan visi produk yang dipilih Nuruzz: produk digital dengan fulfillment otomatis, invite, dan manual; kanal website, Telegram (bot/Web App), dan WhatsApp. Urutan di bawah adalah usulan pelaksanaan, bukan pengurangan scope dan bukan persetujuan Nuruzz.
- Bangun serta uji satu sumber katalog/order dan state machine order lebih dulu, agar status dari dashboard, tracking, bot, dan kanal lain tidak saling bertentangan.
- Uji alur lengkap dengan data uji/staging untuk seluruh jenis fulfillment; verifikasi pembayaran, kegagalan/retry, notifikasi, eskalasi, serta pembatalan/refund sebelum melibatkan pembeli sungguhan.
- Untuk pilot terbatas, rekomendasi segmen adalah seller eksternal produk digital dengan katalog kecil dan kesiapan bekerja sama memberi umpan balik; sertakan kasus kode/file otomatis serta setidaknya satu alur invite/manual supaya penanganan manusia ikut tervalidasi. Pilihan segmen dan jumlah seller belum diputuskan.
- Validasi tiap kanal dengan seller yang benar-benar menggunakannya. Bintang Store dapat menjadi pengguna uji internal hanya atas pilihan Nuruzz dan tidak otomatis dimigrasikan atau digunakan dalam produksi.
- Luluskan setiap kanal dan workflow pada uji terpisah, lalu jalankan pengujian end-to-end lintas-kanal. Jangan menjanjikan tanggal atau ketersediaan produksi sebelum dependensi gateway, Telegram, WhatsApp, kebijakan provider, monitoring, dan pemulihan kegagalan diverifikasi.

### Kriteria penerimaan awal yang direkomendasikan

1. **Order otomatis:** ketika pembayaran tervalidasi, satu order hanya memicu satu fulfillment efektif; buyer menerima hasil/petunjuk dan tracking menunjukkan status yang konsisten.
2. **Order invite/manual:** seller melihat data yang diperlukan dan langkah tindakan; buyer melihat bahwa order sedang diproses dan hanya melihat ETA jika seller memberikannya.
3. **Gagal otomatis:** setelah batas retry yang dapat dikonfigurasi tercapai, order masuk antrean seller beserta alasan dan opsi yang sah untuk kasus itu; retry tidak menghasilkan pengiriman ganda.
4. **Notifikasi:** seller memilih pembaruan otomatis atau pesan langsung sesuai kasus; isi/status yang dikirim tidak menyatakan produk terkirim, order dibatalkan, atau refund sukses sebelum peristiwa tersebut benar-benar terkonfirmasi.
5. **Bantuan:** bot menggunakan sumber seller/order yang tepat; bila tidak yakin atau kasus tergolong sensitif, pembeli dapat dialihkan ke seller dengan konteks dan riwayat relevan tetap tersedia.
6. **Isolasi seller:** akun dari tenant lain tidak dapat membaca atau memodifikasi order, produk, pesan, maupun konfigurasi seller yang diuji.
7. **Kondisi kegagalan:** sistem menampilkan loading, keadaan kosong, dan error dengan penyebab/langkah berikut yang berguna; aksi seller yang gagal tidak diam-diam tampak berhasil.
8. **Kanal:** produk hanya muncul pada kanal yang dipilih seller; status, harga, ketersediaan, serta hasil checkout konsisten dengan sumber katalog yang sama.

### Ukuran keberhasilan yang direkomendasikan

Kumpulkan baseline selama pilot; tetapkan angka target setelah jumlah dan pola transaksi cukup, bukan sebelum ada data.

- Waktu seller dari onboarding sampai toko dapat menerima order uji; waktu sampai produk pertama tayang.
- Persentase pembayaran yang tervalidasi dan order yang selesai tanpa intervensi dibanding yang membutuhkan tindakan seller, dipisah menurut fulfillment dan kanal.
- Waktu dari pembayaran valid sampai produk terkirim/diundang/dikerjakan; jumlah retry, duplikasi, order tertahan, serta fulfillment gagal.
- Waktu respons dan waktu penyelesaian kasus bantuan/komplain; tingkat eskalasi bot ke seller dan kasus yang dibuka kembali.
- Aktivasi seller, penggunaan berulang, retensi, dan alasan berhenti setelah trial.
- Biaya per order selesai menurut gateway, pesan/kanal, penyimpanan, dan komputasi. Evaluasi biaya dari pemakaian nyata sebelum menetapkan batas paket atau menjanjikan harga.

### Harga dan penawaran: rekomendasi sementara

- Kisaran Rp50 ribu/Rp100 ribu/Rp150 ribu per bulan tetap hipotesis pembanding, bukan tarif. Jangan memilih tarif sebelum biaya variabel/provider, batas paket, dan nilai tiap tier dihitung serta diuji ke seller.
- Rekomendasi untuk uji awal adalah onboarding tanpa biaya pendaftaran wajib supaya hambatan adopsi rendah. Ini usulan yang belum disetujui dan dapat dievaluasi ulang bila onboarding membutuhkan layanan manusia yang besar.
- Pisahkan dengan jelas langganan platform, biaya payment gateway yang dibayar ke provider seller, biaya pesan/provider, dan kemungkinan biaya transaksi/overage. Hindari biaya tersembunyi atau mengesankan platform menahan dana bila transaksi sebenarnya langsung ke gateway seller.
- Pertahankan trial 7 hari sebagai keputusan arah yang pernah dipilih; validasi apakah durasinya cukup agar seller sempat menghubungkan kanal, menayangkan produk, dan menguji order.

## 11. Status discovery

- Sudah terkumpul cukup bahan untuk **draf PRD kerja** dengan label status dan daftar acceptance criteria awal.
- Belum cukup untuk PRD final yang mengikat: keputusan rekomendasi perlu disetujui/divalidasi; definisi operasional pembayaran, order, support, izin, privasi, biaya provider, pilot, serta harga masih terbuka.
- Sebelum menulis PRD final, tinjau bersama Nuruzz terutama urutan peluncuran, workflow pilot yang tidak mengecilkan visi, dan recommendation defaults di bagian 10.
- Tetap perlakukan catatan ini sebagai discovery product, bukan status implementasi M01–M15 atau verifikasi kesiapan produksi.

## 12. Catatan proses

- Jangan menyamakan visi lengkap dengan tahap peluncuran pertama. Kalau mengusulkan urutan MVP/pilot, nyatakan itu sebagai usulan dan minta persetujuan sebelum mempersempit cakupan.
- Jangan mengubah hipotesis dan rekomendasi menjadi requirement confirmed.
- Jangan terus menanyakan pilihan kecil tanpa jeda; berikan checkpoint ringkas setelah satu area discovery cukup jelas.
- Dokumen ini adalah catatan discovery untuk melanjutkan percakapan, bukan bukti implementasi, verifikasi fitur live, maupun PRD yang telah disetujui.
