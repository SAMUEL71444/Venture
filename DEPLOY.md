# Deploy Digital.in

Arsitektur: **Neon** (PostgreSQL) → **Cloudflare R2** (file KTM & hasil kerja) → **Render** (backend Laravel, Docker) → **Vercel** (frontend Next.js).
Kerjakan berurutan; tiap langkah butuh nilai dari langkah sebelumnya. Dokumen ini **tidak berisi nilai rahasia** — isi sendiri di dashboard masing-masing layanan.

---

## 0. Keputusan sebelum mulai: `APP_ENV`

Saat ini backend **hanya punya driver pembayaran & pencairan tiruan (mock)**. Driver mock sengaja ditolak saat `APP_ENV=production` (lihat `AppServiceProvider::guardMock`), jadi:

| `APP_ENV` | Escrow / pembayaran | Data demo (`demo:seed`) | Cocok untuk |
|---|---|---|---|
| `production` | **Tidak berfungsi** (error 500 saat membuat pembayaran) | Tidak bisa | Setelah gateway pembayaran asli dipasang |
| `staging` | Berfungsi dengan **uang tiruan** | Bisa | Demo, pilot, presentasi |

Selain soal gateway, `staging` dan `production` berperilaku sama untuk keamanan: OTP **tidak** pernah ditulis ke log (hanya diizinkan saat `local`), sehingga mail & WhatsApp harus dikonfigurasi sungguhan.

---

## 1. Neon (PostgreSQL)

1. Buat project baru, region **AWS Asia Pacific (Singapore)** (paling dekat dengan Render Singapore).
2. Buka **Connection Details**, matikan *Connection pooling* (pakai koneksi **langsung**, bukan host `-pooler`; migrasi lebih aman lewat koneksi langsung).
3. Salin connection string dan pastikan diakhiri `?sslmode=require`. Ini menjadi `DB_URL` di Render.
4. (Disarankan) Buat **branch** terpisah, misalnya `test`, untuk menjalankan test suite terhadap PostgreSQL. Jangan pernah menjalankan test ke branch utama.

Migrasi dijalankan otomatis oleh container saat start (`migrate --force`); tidak perlu menjalankannya manual.

## 2. Cloudflare R2 (file sensitif)

1. **R2 → Create bucket**, misalnya `digitalin-files`. **Jangan** aktifkan *Public access* / r2.dev / custom domain. File KTM & hasil kerja hanya dialirkan lewat API yang sudah dicek hak aksesnya.
2. **R2 → Manage API Tokens → Create API token**: izin **Object Read & Write**, dibatasi ke bucket tadi saja.
3. Catat: *Access Key ID*, *Secret Access Key*, dan endpoint S3 `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
4. CORS bucket tidak perlu diatur (browser tidak mengakses R2 langsung).

Disk Laravel `r2` sudah tersedia di `backend/config/filesystems.php`. Aktifkan lewat `KTM_FILES_DISK=r2` dan `SUBMISSION_FILES_DISK=r2`.
Tanpa R2, file tersimpan di disk container Render yang **terhapus setiap deploy/restart**.

## 3. Render (backend)

### 3.1 Buat Web Service
- **New → Web Service** → hubungkan repo.
- **Root Directory**: `backend`
- **Runtime**: Docker (memakai `backend/Dockerfile`)
- **Region**: Singapore
- **Health Check Path**: `/api/v1/health`
- **Instance type**: *Free* bisa dipakai untuk demo, dengan catatan berikut:
  - Container tidur setelah ±15 menit tanpa trafik; request pertama setelahnya ±1 menit.
  - Fitur **Shell** dan **Cron Job** hanya tersedia di instance berbayar (*Starter* ke atas).

Isi image (sudah diatur, tidak perlu diubah):
- PHP 8.2 + Apache, ekstensi `pdo_pgsql`, `pgsql`, `bcmath`, `intl`, `zip`, `opcache`.
- `composer install --no-dev --optimize-autoloader`.
- `display_errors=Off`, `zend.exception_ignore_args=On`.
- Port mengikuti env `PORT` dari Render.

Saat start, `docker/start.sh` menjalankan berurutan:
1. Cek `APP_KEY`, lalu beri peringatan jika `APP_DEBUG=true` di luar `local`.
2. `config:cache` → `route:cache` → `migrate --force` → `universities:import` (idempoten).
3. Menyalakan Apache.

**Data demo tidak pernah dibuat otomatis.**

### 3.2 Environment variables (Render → Environment)

`PORT` diisi Render sendiri, **jangan** di-set. Nilai bertanda 🔒 rahasia; isi langsung di dashboard, jangan di-commit.

| Variabel | Nilai / keterangan |
|---|---|
| `APP_NAME` | `Digital.in` |
| `APP_ENV` | `staging` atau `production` (lihat bagian 0) |
| `APP_KEY` 🔒 | **Baru**, jangan memakai kunci lokal: jalankan `php artisan key:generate --show` di lokal lalu tempel hasilnya |
| `APP_DEBUG` | `false` |
| `APP_URL` | `https://<service>.onrender.com` |
| `APP_BUSINESS_TIMEZONE` | `Asia/Jakarta` (opsional, ini default) |
| `LOG_CHANNEL` | `stderr` (log muncul di tab Logs Render) |
| `LOG_LEVEL` | `warning` (atau `info` saat awal uji coba) |
| `DB_CONNECTION` | `pgsql` |
| `DB_URL` 🔒 | connection string Neon (`postgresql://…?sslmode=require`) |
| `CACHE_STORE` | `database` |
| `SESSION_DRIVER` | `database` |
| `QUEUE_CONNECTION` | `sync` (tanpa worker terpisah; job berjalan langsung di request) |
| `BROADCAST_CONNECTION` | `null` (**jangan** `log`: isi pesan chat akan tertulis di log) |
| `TRUSTED_PROXIES` | `*` (Render berada di belakang load balancer; dipakai untuk IP klien di rate limit/audit dan deteksi https) |
| `CORS_ALLOWED_ORIGINS` | domain Vercel, persis tanpa `/` di akhir, mis. `https://digitalin.vercel.app`; pisahkan dengan koma bila lebih dari satu. Isi setelah langkah 4. |
| `KTM_FILES_DISK` | `r2` |
| `SUBMISSION_FILES_DISK` | `r2` |
| `R2_ACCESS_KEY_ID` 🔒 | dari langkah 2 |
| `R2_SECRET_ACCESS_KEY` 🔒 | dari langkah 2 |
| `R2_BUCKET` | nama bucket |
| `R2_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_REGION` | `auto` |
| `MAIL_MAILER` | `smtp` (**jangan** `log`; di server OTP email akan ditolak) |
| `MAIL_SCHEME` | `smtps` untuk port 465, kosongkan untuk 587 |
| `MAIL_HOST`, `MAIL_PORT` | dari penyedia SMTP |
| `MAIL_USERNAME` 🔒, `MAIL_PASSWORD` 🔒 | kredensial SMTP |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | alamat pengirim yang sudah diverifikasi di penyedia SMTP |
| `WHATSAPP_ACCESS_TOKEN` 🔒 | token Meta WhatsApp Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | dari Meta |
| `WHATSAPP_OTP_TEMPLATE` | nama template OTP yang disetujui Meta |
| `WHATSAPP_TEMPLATE_LANGUAGE` | mis. `id` |
| `WHATSAPP_API_VERSION` | versi Graph API yang dipakai |
| `WHATSAPP_OTP_COPY_CODE_BUTTON` | `true` jika template memakai tombol salin kode |
| `META_WHATSAPP_API_BASE_URL` | opsional; biarkan default |
| `OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_COOLDOWN_SECONDS` | opsional (ada default) |
| `EMAIL_VERIFICATION_TTL_MINUTES`, `PASSWORD_RESET_TOKEN_TTL_MINUTES` | opsional (ada default) |
| `SANCTUM_ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS` | opsional (ada default) |
| `PAYMENT_GATEWAY_DRIVER` | `mock` (satu-satunya driver saat ini) |
| `PAYMENT_WEBHOOK_SECRET` 🔒 | string acak panjang, mis. hasil `openssl rand -hex 32` |
| `DISBURSEMENT_DRIVER` | `mock` |
| `DISBURSEMENT_WEBHOOK_SECRET` 🔒 | string acak panjang, berbeda dari secret pembayaran |

Jika WhatsApp belum siap, biarkan variabel `WHATSAPP_*` kosong. Kanal WhatsApp tetap tampil, tetapi pengiriman OTP lewat WhatsApp akan gagal dengan pesan "layanan tidak tersedia". Email tetap berfungsi.

Setelah deploy pertama, cek `https://<service>.onrender.com/api/v1/health`. Hasil yang benar: `{"data":{"status":"ok"},…}`.

### 3.3 Tugas terjadwal (opsional, berbayar)

Backend punya dua tugas terjadwal (`routes/console.php`). Tanpa Cron Job, keduanya tidak berjalan:
- pembayaran yang lewat tenggat tidak ditandai kedaluwarsa;
- pengecekan tenggat harian tidak berjalan.

Untuk mengaktifkannya, buat **Render Cron Job** dari repo & Dockerfile yang sama (Root Directory `backend`) dan pakai Environment Group yang sama dengan web service:

| Nama | Schedule (UTC) | Command |
|---|---|---|
| expire-payments | `0 * * * *` | `php artisan payments:expire-overdue` |
| scheduler-sweep | `0 18 * * *` (= 01:00 WIB) | `php artisan scheduler:sweep` |

## 4. Vercel (frontend)

1. **Add New → Project** → repo yang sama. **Root Directory**: root repo (aplikasi Next.js ada di root). Framework terdeteksi otomatis.
2. Environment variables (Production, dan Preview bila dipakai):

| Variabel | Nilai |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<service>.onrender.com/api/v1` (tanpa `/` di akhir) |
| `NEXT_PUBLIC_AUTH_MOCK` | **jangan di-set** (atau `false`). `true` = login tiruan di browser. |

   Jangan set `NEXT_DIST_DIR` (hanya untuk verifikasi lokal).

   Build di Vercel **sengaja gagal** jika `NEXT_PUBLIC_API_URL` kosong atau menunjuk ke localhost (`next.config.mjs`).
3. Deploy, lalu salin domain Vercel ke `CORS_ALLOWED_ORIGINS` di Render. Render me-restart service otomatis setelah env berubah; konfigurasi di-cache ulang saat start.

---

## 5. Menjalankan perintah artisan di server

**Cara A — Render Shell** (instance berbayar): Render → service → **Shell**. Perintah berjalan dengan env server.

**Cara B — dari komputer lokal** (instance Free). Jalankan artisan lokal yang terhubung ke Neon & R2:
1. Aktifkan `extension=pdo_pgsql` dan `extension=pgsql` di `php.ini` lokal.
2. Buat file env **di luar folder repo**, mis. `C:\Users\<kamu>\digitalin-server.env`, berisi nilai yang **sama persis** dengan Render, minimal:
   - `APP_ENV`, `APP_KEY`, `DB_CONNECTION`, `DB_URL`;
   - `KTM_FILES_DISK`, `SUBMISSION_FILES_DISK`, `R2_*`;
   - `PAYMENT_GATEWAY_DRIVER`, `PAYMENT_WEBHOOK_SECRET`, `DISBURSEMENT_DRIVER`, `DISBURSEMENT_WEBHOOK_SECRET`.
3. Di Git Bash, dari folder `backend`, jalankan dalam subshell agar variabel tidak tertinggal:
   ```bash
   ( set -a; . /c/Users/<kamu>/digitalin-server.env; set +a; php artisan <perintah> )
   ```
   Variabel yang di-export menang atas `backend/.env` lokal (dotenv Laravel tidak menimpa env yang sudah ada).

Contoh di bawah ditulis untuk Shell; dengan Cara B, bungkus perintahnya dalam subshell di atas.

### 5.1 Membuat admin pertama
Password dibaca dari variabel env, sehingga tidak muncul di riwayat shell maupun argumen proses:
```bash
read -rs ADMIN_PASSWORD && export ADMIN_PASSWORD   # ketik password, tidak tampil di layar
php artisan auth:create-admin --name="Nama Admin" --email=admin@domainmu.id --password-env=ADMIN_PASSWORD
unset ADMIN_PASSWORD
```
Tanpa opsi, perintah ini berjalan interaktif (bertanya nama, email, password).

### 5.2 Impor katalog universitas
Sudah otomatis setiap container start. Untuk menjalankan ulang manual (aman diulang; hanya menambah yang belum ada dan mengisi kolom kosong, tidak menimpa ubahan admin):
```bash
php artisan universities:import
```

### 5.3 Data demo
Syarat: `APP_ENV` **bukan** `production`, `PAYMENT_GATEWAY_DRIVER=mock`, `PAYMENT_WEBHOOK_SECRET` terisi, dan katalog universitas sudah ada.
```bash
php artisan demo:seed     # ±1 menit
```
- **Password semua akun demo dicetak SEKALI** di akhir output dan tidak disimpan di mana pun. Catat saat itu juga.
- Semua akun demo memakai email `@demo.digitalin.test`.
- Isi data demo: 1 admin, 2 mentor, 5 UMKM, 10 mahasiswa (6 terverifikasi, 3 menunggu verifikasi KTM, 1 ditolak), 8 proyek dalam berbagai status (berjalan, sengketa, selesai, dibatalkan), dana escrow, dan peringatan kualitas.
- File KTM & hasil kerja demo ikut tersimpan ke R2.

Menghapus **seluruh** data demo beserta filenya (data non-demo tidak disentuh):
```bash
php artisan demo:clear --force
```

---

## 6. Checklist keamanan sebelum dipakai pengguna sungguhan

- [ ] `APP_DEBUG=false`. Log start container tidak menampilkan peringatan `APP_DEBUG=true`.
- [ ] `APP_KEY` **baru** khusus server, bukan kunci dari laptop. Kunci tidak pernah di-commit.
- [ ] `CORS_ALLOWED_ORIGINS` hanya berisi domain Vercel resmi; tidak ada `*` atau localhost.
- [ ] Kredensial mail (dan WhatsApp) diisi; `MAIL_MAILER` bukan `log`. Uji OTP daftar & lupa password sampai ke inbox.
- [ ] `zend.exception_ignore_args=On` dan `display_errors=Off`. Sudah diatur di image; cek lewat Shell: `php -i | grep -E "exception_ignore_args|display_errors"`.
- [ ] **`php artisan demo:clear --force` sudah dijalankan** sebelum pengguna sungguhan mendaftar (atau data demo memang tidak pernah dibuat).
- [ ] Bucket R2 **private** (tanpa public access / r2.dev), dan token R2 dibatasi ke bucket itu.
- [ ] `PAYMENT_WEBHOOK_SECRET` & `DISBURSEMENT_WEBHOOK_SECRET` acak, panjang, dan berbeda satu sama lain.
- [ ] `TRUSTED_PROXIES=*` di Render. Tanpa ini, rate limit OTP menganggap semua pengguna berasal dari satu IP.
- [ ] `BROADCAST_CONNECTION` bukan `log`; `LOG_LEVEL` bukan `debug`.
- [ ] `NEXT_PUBLIC_AUTH_MOCK` tidak di-set di Vercel.
- [ ] Bila `APP_ENV=staging` dipakai untuk pilot: pengguna diberi tahu bahwa pembayaran masih **tiruan**.
- [ ] Akun admin memakai password kuat dan unik; akun uji coba lokal tidak ikut ke server.
