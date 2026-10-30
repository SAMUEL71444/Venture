# Deploy Digital.in

Arsitektur: **Neon** (PostgreSQL) → **Supabase Storage** (file KTM & hasil kerja, S3-compatible) → **Render** (backend Laravel, Docker) → **Vercel** (frontend Next.js).
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

1. Buat project baru, region **AWS Asia Pacific (Singapore)** (paling dekat dengan Render Singapore), PostgreSQL 17. Branch default project ini bernama **`production`**; branch inilah yang dipakai Render.
2. Buka **Connection Details** untuk branch `production`, matikan *Connection pooling* (pakai koneksi **langsung**, bukan host `-pooler`; migrasi lebih aman lewat koneksi langsung).
3. Salin connection string dan pastikan diakhiri `?sslmode=require`. Ini menjadi `DB_URL` di Render.
4. Branch `test` boleh dipakai untuk uji coba manual. Test suite lengkap **tidak** dijalankan ke Neon (terlalu lambat lewat jaringan); test PostgreSQL berjalan otomatis di GitHub Actions (`.github/workflows/backend-ci.yml`, service `postgres:17`). Jangan pernah menjalankan test ke branch `production`.

Setiap branch Neon punya endpoint sendiri (`ep-…` di host). Endpoint inilah cara paling mudah membedakan `production` dan `test`.

Migrasi dijalankan otomatis oleh container saat start (`migrate --force`); tidak perlu menjalankannya manual.

## 2. Supabase Storage (file sensitif)

Supabase **hanya dipakai untuk Storage**. Database tetap di Neon; database Postgres bawaan project Supabase tidak dipakai sama sekali.

1. **New project** di [supabase.com](https://supabase.com), region **Southeast Asia (Singapore)**. Password database yang diminta saat membuat project tidak dipakai aplikasi, tapi tetap simpan di tempat aman.
2. **Storage → New bucket**:
   - nama `digitalin-private`;
   - **Public bucket: OFF**. File KTM & hasil kerja hanya dialirkan lewat API backend yang sudah dicek hak aksesnya, tidak pernah lewat URL publik;
   - opsional: *File size limit* 20 MB (batas unggahan hasil kerja di backend).
3. **Project Settings → Storage → S3 Connection**:
   - pastikan *S3 connection* aktif;
   - salin **Endpoint** dan **Region** persis seperti yang tertera;
   - klik **New access key**, lalu catat *Access key ID* dan *Secret access key*. Secret hanya ditampilkan sekali.
   - Access key S3 Supabase berlaku untuk **semua bucket** di project itu dan melewati RLS, jadi jangan simpan bucket publik lain di project yang sama.
4. CORS tidak perlu diatur (browser tidak mengakses Supabase Storage langsung).

Backend memakai disk Laravel `s3` (`backend/config/filesystems.php`: privat, path-style, tanpa URL publik). Aktifkan lewat `KTM_FILES_DISK=s3` dan `SUBMISSION_FILES_DISK=s3`.
Tanpa ini, file tersimpan di disk container Render yang **terhapus setiap deploy/restart**.

**Project gratis dijeda otomatis.** Project Supabase gratis di-*pause* setelah sekitar **1 minggu tanpa aktivitas**. Selama dijeda, unggah dan unduh KTM/hasil kerja gagal: backend mengembalikan error, tapi data di Neon tetap aman.
- Cara memulihkan: buka dashboard Supabase → pilih project → **Restore project**. Prosesnya beberapa menit, dan file di bucket tidak hilang.
- Project yang terlalu lama dijeda (saat ini 90 hari menurut kebijakan Supabase) tidak bisa dipulihkan dari dashboard. Cek dashboard secara berkala.
- Untuk pemakaian sungguhan, pertimbangkan paket berbayar agar tidak pernah dijeda.

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
| `APP_URL` | `https://<service>.onrender.com`. Dipakai sebagai host tautan di email (verifikasi email kampus), jadi harus URL publik backend. |
| `APP_BUSINESS_TIMEZONE` | `Asia/Jakarta` (opsional, ini default) |
| `LOG_CHANNEL` | `stderr` (log muncul di tab Logs Render) |
| `LOG_LEVEL` | `warning` (atau `info` saat awal uji coba) |
| `DB_CONNECTION` | `pgsql` |
| `DB_URL` 🔒 | connection string Neon branch `production` (`postgresql://…?sslmode=require`) |
| `DB_SSLMODE` | opsional. Urutan prioritas: `?sslmode=` di `DB_URL` → `DB_SSLMODE` → otomatis (`require` untuk host non-lokal, `prefer` untuk localhost) |
| `CACHE_STORE` | `database` |
| `SESSION_DRIVER` | `database` |
| `QUEUE_CONNECTION` | `sync` (tanpa worker terpisah; job berjalan langsung di request) |
| `BROADCAST_CONNECTION` | `null` (**jangan** `log`: isi pesan chat akan tertulis di log) |
| `TRUSTED_PROXIES` | `*` (Render berada di belakang load balancer; dipakai untuk IP klien di rate limit/audit dan deteksi https) |
| `CORS_ALLOWED_ORIGINS` | domain Vercel, persis tanpa `/` di akhir, mis. `https://digitalin.vercel.app`; pisahkan dengan koma bila lebih dari satu. Isi setelah langkah 4. |
| `FRONTEND_URL` | domain Vercel yang sama, mis. `https://digitalin.vercel.app`. Tautan verifikasi email kampus diarahkan ke `<FRONTEND_URL>/verify/campus-email?status=…`. Isi setelah langkah 4. |
| `KTM_FILES_DISK` | `s3` |
| `SUBMISSION_FILES_DISK` | `s3` |
| `AWS_ACCESS_KEY_ID` 🔒 | *Access key ID* Supabase dari langkah 2 |
| `AWS_SECRET_ACCESS_KEY` 🔒 | *Secret access key* Supabase dari langkah 2 |
| `AWS_DEFAULT_REGION` | *Region* dari halaman S3 Connection, salin persis |
| `AWS_BUCKET` | `digitalin-private` |
| `AWS_ENDPOINT` | *Endpoint* dari halaman S3 Connection, salin persis (bentuknya `https://<project-ref>.supabase.co/storage/v1/s3`) |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `true` (wajib untuk Supabase) |
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

**Cara B — dari komputer lokal** (instance Free). Jalankan artisan lokal yang terhubung ke Neon & Supabase Storage:
1. Aktifkan `extension=pdo_pgsql` dan `extension=pgsql` di `php.ini` lokal.
2. Buat file env **di luar folder repo**, mis. `C:\Users\<kamu>\digitalin-server.env`, berisi nilai yang **sama persis** dengan Render, minimal:
   - `APP_ENV`, `APP_KEY`, `DB_CONNECTION`, `DB_URL`;
   - `KTM_FILES_DISK`, `SUBMISSION_FILES_DISK`, `AWS_*` (Supabase Storage);
   - `PAYMENT_GATEWAY_DRIVER`, `PAYMENT_WEBHOOK_SECRET`, `DISBURSEMENT_DRIVER`, `DISBURSEMENT_WEBHOOK_SECRET`.
3. Di Git Bash, dari folder `backend`, jalankan dalam subshell agar variabel tidak tertinggal:
   ```bash
   ( set -a; . /c/Users/<kamu>/digitalin-server.env; set +a; php artisan <perintah> )
   ```
   Variabel yang di-export menang atas `backend/.env` lokal (dotenv Laravel tidak menimpa env yang sudah ada).

**Khusus laptop dengan PHP XAMPP — libpq lama tanpa SNI.** libpq bawaan XAMPP terlalu tua untuk mengirim nama endpoint Neon (SNI), sehingga `DB_URL` biasa gagal. Di file env laptop, ganti `DB_URL` dengan variabel terpisah dan sisipkan endpoint ID di password:
```
DB_URL=
DB_CONNECTION=pgsql
DB_HOST=<endpoint-id>.<region>.aws.neon.tech
DB_PORT=5432
DB_DATABASE=<nama-database>
DB_USERNAME=<user>
DB_PASSWORD=endpoint=<endpoint-id>;<password>
```
- `DB_URL=` sengaja dikosongkan agar `DB_URL` dari `backend/.env` tidak ikut terbaca.
- `sslmode` otomatis `require` karena host-nya bukan localhost.
- Trik ini **HANYA untuk laptop**. **Jangan** dipakai di env Render: image Docker memakai libpq baru, dan di sana tetap gunakan `DB_URL` biasa.

> ⚠️ **Cek branch tujuan sebelum menjalankan perintah apa pun dari laptop.** Sebelum menjalankan perintah ke branch `production`, pastikan `.env`/file env yang dimuat **tidak** sedang mengarah ke branch `test`, dan sebaliknya.
> - Cocokkan endpoint ID (`ep-…`) di `DB_HOST` dengan yang tertera di dashboard Neon.
> - Atau jalankan `php artisan db:show` (dibungkus subshell yang sama). Perintah ini menampilkan host & nama database tanpa password.
>
> `demo:clear`, `migrate`, dan `auth:create-admin` langsung mengubah database yang sedang dituju.

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
- File KTM & hasil kerja demo ikut tersimpan ke Supabase Storage.

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
- [ ] Bucket Supabase `digitalin-private` **privat** (Public bucket OFF). Access key S3 hanya ada di env Render/laptop dan tidak ada bucket publik lain di project yang sama (key S3 Supabase berlaku untuk semua bucket).
- [ ] Project Supabase tidak sedang dijeda (cek sebelum demo/presentasi).
- [ ] `PAYMENT_WEBHOOK_SECRET` & `DISBURSEMENT_WEBHOOK_SECRET` acak, panjang, dan berbeda satu sama lain.
- [ ] `TRUSTED_PROXIES=*` di Render. Tanpa ini, rate limit OTP menganggap semua pengguna berasal dari satu IP.
- [ ] `BROADCAST_CONNECTION` bukan `log`; `LOG_LEVEL` bukan `debug`.
- [ ] `NEXT_PUBLIC_AUTH_MOCK` tidak di-set di Vercel.
- [ ] Bila `APP_ENV=staging` dipakai untuk pilot: pengguna diberi tahu bahwa pembayaran masih **tiruan**.
- [ ] Akun admin memakai password kuat dan unik; akun uji coba lokal tidak ikut ke server.

---

## 7. Mode demo laptop (Cloudflare quick tunnel)

Alternatif tanpa Render/Vercel untuk presentasi singkat. Backend, frontend, dan database berjalan di laptop, dibuka ke publik lewat **satu** tunnel Cloudflare.

**Menjalankan** (dari root repo, port 8000 dan 3000 harus kosong):
```powershell
powershell -ExecutionPolicy Bypass -File .\demo-start.ps1
```
Skrip menjalankan, berurutan:
1. `php artisan serve` di `127.0.0.1:8000`;
2. `php artisan schedule:work` (tugas terjadwal backend), setelah backend siap, dengan env yang sama;
3. `npm run build` lalu `npm run start` di `127.0.0.1:3000`, build terpisah di `.next/demo`;
4. `cloudflared` quick tunnel ke port 3000.

Link `https://….trycloudflare.com` ditampilkan jelas dan disalin ke clipboard. Log tiap proses ada di `%TEMP%\digitalin-demo`.

**Menghentikan:**
- **Ctrl+C** di jendela skrip menghentikan semua proses demo beserta turunannya, termasuk `php -S` dari `artisan serve`, node dari npm, dan `schedule:run` dari `schedule:work`.
- Ctrl+C **tidak cukup** jika jendela PowerShell ditutup paksa (tombol X), proses PowerShell di-kill, atau laptop *sleep* saat skrip berhenti di tengah jalan. Di kasus itu pembersihan otomatis tidak dijamin berjalan, dan proses bisa tertinggal menahan port 8000/3000. Jalankan:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\demo-stop.ps1
  ```
  - `demo-stop.ps1` hanya mematikan proses yang PID dan waktu start-nya dicatat `demo-start.ps1` di `%TEMP%\digitalin-demo\pids.json`, plus turunannya. php/node lain di laptop tidak disentuh.
  - PID yang sudah dipakai ulang proses lain dilewati.
  - `demo-start.ps1` menolak jalan selama proses sesi sebelumnya masih hidup.

Cara kerjanya:
- Browser memanggil `/api/v1/...` di domain tunnel yang sama. Next.js meneruskannya ke Laravel (rewrite di `next.config.mjs`, hanya aktif dengan `DEMO_LOCAL_PROXY=true`), jadi CORS tidak perlu diatur.
- Env mode demo di-set oleh skrip untuk prosesnya saja; `backend/.env` tidak dibaca maupun diubah:
  - backend: `APP_DEBUG=false`, `TRUSTED_PROXIES=127.0.0.1`, `LINKS_USE_REQUEST_HOST=true`, `FRONTEND_URL=/`.
    - Tautan di email (verifikasi email kampus) memakai host tunnel yang sedang dipakai pengguna, diambil dari `X-Forwarded-Host`/`-Proto` yang dipercaya, bukan `APP_URL`. Karena itu tautan bisa dibuka dari perangkat lain.
    - `FRONTEND_URL=/` membuat redirect sesudahnya tetap di host yang sama.
    - Tanda tangan tautan relatif (path + query), jadi tidak bergantung pada host.
    - Tautan dari sesi tunnel sebelumnya tidak bisa dibuka lagi karena host tunnel-nya sudah mati;
  - frontend: `DEMO_LOCAL_PROXY=true`, `NEXT_PUBLIC_API_URL=/api/v1`, `NEXT_DIST_DIR=.next/demo`.
- IP asli pengunjung (untuk rate limit) sampai ke Laravel:
  - Cloudflare mengisi `X-Forwarded-For` dan `CF-Connecting-IP`.
  - Proxy Next.js meneruskan header itu apa adanya (hanya menambah `X-Forwarded-Host`).
  - Laravel mempercayai `127.0.0.1`, lalu mengambil IP paling kanan yang bukan proxy dari `X-Forwarded-For`. Nilai palsu yang dikirim pengunjung di sebelah kirinya diabaikan.
  - Server hanya mendengarkan di `127.0.0.1`, sehingga perangkat lain di jaringan tidak bisa melewati tunnel.

**Batasan:**
- Laptop harus menyala, terhubung internet, dan jendela skrip tetap terbuka.
- Link **berubah setiap sesi**. Quick tunnel tidak punya jaminan uptime dan tidak cocok untuk pengguna sungguhan.
- Siapa pun yang memegang link bisa membuka aplikasi. Pakai data demo (`demo:seed`), jangan data asli.
- Memakai `backend/.env` lokal apa adanya (database, mail, disk file). OTP hanya terkirim bila mail/WhatsApp lokal dikonfigurasi sungguhan; paling mudah login memakai akun demo.

**Wajib `APP_DEBUG=false`.** Skrip sudah memaksanya lewat env proses, karena dengan debug aktif, detail error dan konfigurasi tampil ke siapa pun yang membuka link. Jika `php artisan config:cache` pernah dijalankan, env proses diabaikan. Karena itu skrip menolak jalan sampai `php artisan config:clear` dijalankan.

`DEMO_LOCAL_PROXY` **tidak boleh** di-set di Vercel: build Vercel sengaja gagal jika variabel itu ada, atau jika `NEXT_PUBLIC_API_URL` bukan URL absolut.
