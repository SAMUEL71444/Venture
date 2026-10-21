# Audit Backend Laravel — Digital.in

> Laporan hasil pemeriksaan **baca-saja** terhadap folder `backend/` (Laravel) untuk persiapan integrasi dengan frontend Next.js di `http://localhost:3000`.
> Tidak ada file backend yang diubah, dibuat, atau dihapus saat pemeriksaan ini.
> Tanggal pemeriksaan: 21 Oktober 2026.

## Ringkasan

- Backend **lengkap secara kode**: 86 route API, semua controller@method ada dan berisi (tidak ada stub/kosong). 41 model, semuanya punya migration.
- Auth: **Sanctum API token (Bearer) + refresh token kustom yang berotasi** — bukan cookie/SPA, bukan Passport, bukan JWT.
- **Belum bisa jalan / belum bisa diakses frontend** karena 5 hal: `vendor/` & `.env` belum ada, database PostgreSQL tidak tersedia di mesin lokal, Redis tidak tersedia, CORS hanya mengizinkan `localhost:5173`, dan OTP WhatsApp tanpa fallback lokal (registrasi terblokir).
- **Alur auth backend berbeda dengan frontend yang sudah dibuat** (backend: OTP WhatsApp ke nomor HP *sebelum* daftar; frontend: daftar dengan email lalu OTP email). Perlu keputusan sebelum integrasi.

---

## Lokasi & lingkungan

| Item | Nilai |
|---|---|
| Folder backend | `digital.in/backend` (belum ter-commit di git) |
| Folder frontend | `digital.in/` (Next.js 14, App Router, JavaScript, tanpa Tailwind) |
| PHP lokal | 8.2.12 (XAMPP, `D:\xamppc\php\php.ini`) |
| Composer | 2.8.3 |
| Ekstensi PHP aktif yang relevan | curl, fileinfo, mbstring, openssl, pdo_mysql, **pdo_sqlite**, zip |
| Ekstensi PHP yang **tidak** aktif | **pdo_pgsql / pgsql**, intl, redis |
| Docker / PostgreSQL / Redis di mesin | **tidak terpasang** |

---

## 1. Versi & dependensi (`backend/composer.json` + `composer.lock`)

| Paket | Versi terkunci |
|---|---|
| laravel/framework | v12.69.3 (`^12.0`) |
| PHP minimum | `^8.2` |
| laravel/sanctum | v4.3.3 |
| fruitcake/php-cors | v1.4.0 (CORS bawaan Laravel) |
| laravel/tinker | v2.11.1 |
| predis/predis | v3.7.0 |
| laravel/sail (dev) | v1.68.0 |
| pestphp/pest (dev) | v3.8.7 |
| laravel/passport, tymon/jwt-auth, fruitcake/laravel-cors, laravel/breeze, laravel/fortify | **tidak ada** |

`composer.lock` ada, tetapi **folder `vendor/` belum ada** (`composer install` belum dijalankan).

---

## 2. Struktur file penting

| File | Status |
|---|---|
| `backend/config/cors.php` | ada |
| `backend/config/sanctum.php` | ada |
| `backend/routes/api.php` | ada |
| `backend/routes/web.php` | ada (hanya `GET /` → view welcome) |
| `backend/routes/channels.php` | ada (channel `conversation.{id}`) |
| `backend/bootstrap/app.php` | ada (gaya Laravel 11+) |
| `backend/app/Http/Kernel.php` | tidak ada (wajar untuk Laravel 11+) |
| `backend/.env` | **tidak ada** |
| `backend/.env.example` | ada |

Struktur kode modular: `app/Modules/<modul>/{Http/Controllers,Services,State,Jobs,...}` untuk modul admin, application, audit, auth, cancellation, certificate, chat, contract, ledger, matching, notification, payment, payout, profile, project, review, scheduler. Kode bersama di `app/Shared/` (ApiResponse, AuditLogger, exception bisnis, dll.).

---

## 3. Konfigurasi

### `config/cors.php`
```php
'paths' => ['api/*', 'sanctum/csrf-cookie'],
'allowed_methods' => ['*'],
'allowed_origins' => /* dari env CORS_ALLOWED_ORIGINS, default 'http://localhost:5173' */,
'allowed_headers' => ['*'],
'exposed_headers' => [],
'max_age' => 0,
'supports_credentials' => false,
```

### Nilai dari `.env.example` (`.env` belum ada)
Hanya key non-rahasia:

| Key | Nilai |
|---|---|
| APP_URL | `http://localhost:8000` |
| SESSION_DRIVER | `file` |
| SESSION_DOMAIN | `null` |
| SANCTUM_STATEFUL_DOMAINS | `localhost:5173,127.0.0.1:5173` |
| DB_CONNECTION | `pgsql` (host 127.0.0.1, port 5432, database `digitalin`) |
| CORS_ALLOWED_ORIGINS | `http://localhost:5173` |
| CACHE_STORE | `redis` |
| QUEUE_CONNECTION | `redis` |
| SANCTUM_ACCESS_TOKEN_TTL | `15` (menit) |
| REFRESH_TOKEN_TTL_DAYS | `30` |
| OTP_TTL_MINUTES / OTP_RESEND_COOLDOWN_SECONDS / OTP_MAX_ATTEMPTS | `5` / `60` / `5` |

`.env.example` juga memuat key untuk WhatsApp (Meta Cloud API), payment gateway (mock/Midtrans/Xendit), disbursement, mail, dan AWS — nilainya tidak dicantumkan di sini.

### `config/sanctum.php`
- `guard` = `['web']`, `expiration` = env `SANCTUM_ACCESS_TOKEN_TTL` (15).
- `stateful` dari env `SANCTUM_STATEFUL_DOMAINS` — **tidak berpengaruh**, karena `statefulApi()` tidak dipasang (lihat di bawah).

### Middleware grup `api` (`bootstrap/app.php` baris 28–33)
- `statefulApi()` **tidak dipanggil**; `EnsureFrontendRequestsAreStateful` **tidak terpasang**.
- Hanya alias:
  - `role` → `App\Http\Middleware\EnsureUserHasRole` (cek `$user->role` ada di daftar)
  - `account.access` → `App\Http\Middleware\EnsureUserAccountCanAccessApi` (blok `SUSPENDED`; `PENDING_VERIFICATION` hanya boleh path tertentu)
- `withBroadcasting(... ['prefix' => 'api', 'middleware' => ['auth:sanctum']])` → menambah route `POST /api/broadcasting/auth`.
- Renderer exception kustom untuk `api/*` (`bootstrap/app.php` baris 34–80) mengubah semua error menjadi format `{ error: { code, message, details } }`.

---

## 4. Autentikasi

**Metode: Sanctum API token (Bearer) + refresh token kustom berotasi.**

Bukti:
- `app/Models/User.php:11,16` — `use Laravel\Sanctum\HasApiTokens;` dan `use HasApiTokens, HasFactory, HasUuids, Notifiable;`
- `app/Modules/auth/Services/RefreshTokenService.php:17` — `$user->createToken(...)`; respons berisi `token_type: "Bearer"`, `access_token`, `access_token_expires_at`, `refresh_token`, `refresh_token_expires_at` (baris 30–34). Refresh token disimpan sebagai hash SHA-256 (baris 25), dirotasi lewat `rotate()` (baris 40), dicabut lewat `revoke()` (baris 95).
- `routes/api.php:49` — route terproteksi memakai `auth:sanctum` + `account.access`; tanpa `statefulApi()` → tidak ada cookie/session.
- `config/auth.php` hanya punya guard `web` (session) — dipakai Sanctum untuk mencoba session dulu, lalu jatuh ke bearer token.
- `JWT_SECRET` ada di `.env.example` tetapi paket JWT tidak terinstall (sisa, tidak dipakai).

### Alur auth di backend
1. `POST /api/v1/auth/otp/send` `{ phone }` — phone format E.164 (`^\+[1-9][0-9]{7,14}$`, mis. `+6281234567890`). Kirim OTP 6 digit via **WhatsApp (Meta Cloud API)**. Menolak jika nomor sudah terdaftar. Cooldown 60 dtk, rate limit 1/menit per phone+IP dan 10/jam per IP.
2. `POST /api/v1/auth/otp/verify` `{ phone, code }` → mengembalikan `verification_token` (dipakai saat register). Saat salah: `attempts_remaining`.
3. `POST /api/v1/auth/register/umkm` `{ business_name, phone, verification_token, password (min 8), business_type?, address?, city?, instagram_url? }` (juga ada `/register/student` dan `/register/mentor`). Akun baru berstatus `PENDING_VERIFICATION`.
4. `POST /api/v1/auth/login` `{ identifier, password }` — `identifier` = email **atau** nomor HP. **Tidak ada parameter role**; role berasal dari akun. Gagal (user tidak ada / password salah / SUSPENDED) → 401 `UNAUTHENTICATED` dengan pesan yang sama (tidak membocorkan email terdaftar). Rate limit 5/menit per identifier+IP. Respons: `{ user, tokens }`.
5. `POST /api/v1/auth/refresh` `{ refresh_token }` → token baru (rotasi).
6. `POST /api/v1/auth/logout` (Bearer) `{ refresh_token }` → mencabut refresh token.

Role di backend: `STUDENT`, `UMKM`, `MENTOR`, `ADMIN`.
Status akun: `PENDING_VERIFICATION` (menunggu verifikasi dokumen/admin — **bukan** OTP), `ACTIVE`, `SUSPENDED`, dll.

### Format respons (`app/Shared/Http/ApiResponse.php`)
- Sukses: `{ "data": ..., "meta": {...} }`
- Gagal: `{ "error": { "code": "...", "message": "...", "details": ... } }`
- Kode error dari renderer: `VALIDATION_FAILED` (422, `details` = error per field), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `BUSINESS_RULE_VIOLATION` (422), `INVALID_STATE_TRANSITION` (409), `METHOD_NOT_ALLOWED` (405), `HTTP_ERROR` (status lain, termasuk **429**), `INTERNAL_SERVER_ERROR` (500).
- Middleware `account.access` mengembalikan `ACCOUNT_SUSPENDED`, `ACCOUNT_PENDING_VERIFICATION`, `ACCOUNT_UNAVAILABLE` (403).

---

## 5. Route & controller

`php artisan route:list --path=api` **tidak dapat dijalankan** (butuh `vendor/`). Tabel di bawah disusun dengan membaca `routes/api.php` dan memverifikasi setiap controller@method di file sumbernya.

Hasil verifikasi: **86/86 route — controller ada, method ada, dan berisi kode.** Tidak ada method kosong/stub. Enam rate limiter bernama (`otp-send`, `otp-verify`, `register`, `login`, `refresh`, `campus-email`) semuanya didefinisikan di `app/Providers/AppServiceProvider.php` (baris 64–87).

Semua URL berprefiks `/api/v1/`. Singkatan middleware: **A** = `auth:sanctum, account.access`.

| # | Method | URL | Controller@method | Middleware |
|---|---|---|---|---|
| 1 | GET | health | closure | — |
| 2 | POST | auth/otp/send | AuthController@sendOtp | throttle:otp-send |
| 3 | POST | auth/otp/verify | AuthController@verifyOtp | throttle:otp-verify |
| 4 | POST | auth/register/umkm | AuthController@registerUmkm | throttle:register |
| 5 | POST | auth/register/student | AuthController@registerStudent | throttle:register |
| 6 | POST | auth/register/mentor | AuthController@registerMentor | throttle:register |
| 7 | POST | auth/login | AuthController@login | throttle:login |
| 8 | POST | auth/refresh | AuthController@refresh | throttle:refresh |
| 9 | POST | auth/logout | AuthController@logout | auth:sanctum |
| 10 | GET | auth/email/verify/{profile}/{hash} | VerificationController@verifyCampusEmail | signed |
| 11 | GET | universities | ProfileController@universities | — |
| 12 | GET | categories | ProfileController@categories | — |
| 13 | GET | templates | ProjectController@templates | — |
| 14 | POST | webhooks/payment-gateway | PaymentWebhookController (invokable) | — |
| 15 | POST | webhooks/disbursement | PayoutController@webhook | — |
| 16 | GET | certificates/{code}/verify | CertificateController@verify | throttle:60,1 |
| 17 | GET | me/profile | ProfileController@me | A |
| 18 | PUT | me/profile | ProfileController@update | A |
| 19 | POST | students/me/campus-email/verification | VerificationController@sendCampusEmailVerification | A, role:STUDENT, throttle:campus-email |
| 20 | POST | students/me/verification | VerificationController@uploadKtm | A, role:STUDENT |
| 21 | PUT | students/me/skills | ProfileController@updateSkills | A, role:STUDENT |
| 22 | POST | students/me/portfolio | ProfileController@createPortfolio | A, role:STUDENT |
| 23 | GET | students | ProfileController@students | A, role:UMKM |
| 24 | GET | students/{student} | ProfileController@student | A |
| 25 | PUT | mentors/me/availability | ProfileController@mentorAvailability | A, role:MENTOR |
| 26 | POST | projects | ProjectController@store | A, role:UMKM |
| 27 | PUT | projects/{project} | ProjectController@update | A, role:UMKM |
| 28 | POST | projects/{project}/publish | ProjectController@publish | A, role:UMKM |
| 29 | POST | projects/{project}/cancel | ProjectController@cancel | A, role:UMKM |
| 30 | POST | projects/{project}/invitations | InvitationController@invite | A, role:UMKM |
| 31 | GET | projects/{project}/applications | ApplicationController@index | A, role:UMKM |
| 32 | GET | projects/{project}/recommendations | ProjectController@recommendations | A, role:UMKM |
| 33 | POST | applications/{application}/accept | ApplicationController@accept | A, role:UMKM |
| 34 | POST | applications/{application}/reject | ApplicationController@reject | A, role:UMKM |
| 35 | POST | contracts/{contract}/payments | PaymentController@store | A, role:UMKM |
| 36 | POST | projects/{project}/premium | ProjectController@premium | A, role:UMKM |
| 37 | POST | projects/{project}/applications | ApplicationController@store | A, role:STUDENT |
| 38 | POST | invitations/{invitation}/accept | InvitationController@accept | A, role:STUDENT |
| 39 | POST | invitations/{invitation}/decline | InvitationController@decline | A, role:STUDENT |
| 40 | POST | applications/{application}/withdraw | ApplicationController@withdraw | A, role:STUDENT |
| 41 | POST | contracts/{contract}/start | ContractController@start | A, role:STUDENT |
| 42 | POST | milestones/{milestone}/submissions | MilestoneReviewController@submit | A, role:STUDENT |
| 43 | GET | mentor/review-queue | MilestoneReviewController@reviewQueue | A, role:MENTOR |
| 44 | POST | submissions/{submission}/mentor-review | MilestoneReviewController@mentorReview | A, role:MENTOR |
| 45 | POST | submissions/{submission}/client-review | MilestoneReviewController@clientReview | A, role:UMKM |
| 46 | GET | wallet | WalletController@show | A, role:STUDENT,MENTOR |
| 47 | GET | wallet/withdrawals/preview | PayoutController@preview | A, role:STUDENT,MENTOR |
| 48 | GET | wallet/withdrawals | PayoutController@index | A, role:STUDENT,MENTOR |
| 49 | POST | wallet/withdrawals | PayoutController@store | A, role:STUDENT,MENTOR |
| 50 | GET | bank-accounts | PayoutController@bankAccounts | A, role:STUDENT,MENTOR |
| 51 | POST | bank-accounts | PayoutController@addBankAccount | A, role:STUDENT,MENTOR |
| 52 | GET | students/me/certificates | CertificateController@mine | A, role:STUDENT |
| 53 | POST | contracts/{contract}/cancellations | CancellationController@store | A, role:UMKM,STUDENT |
| 54 | POST | cancellations/{cancellation}/responses | CancellationController@respond | A, role:UMKM,STUDENT |
| 55 | POST | cancellations/{cancellation}/withdraw | CancellationController@withdraw | A, role:UMKM,STUDENT |
| 56 | POST | contracts/{contract}/ratings | CertificateController@rate | A, role:UMKM,STUDENT |
| 57 | GET | conversations | ConversationController@index | A, role:UMKM,STUDENT |
| 58 | GET | conversations/{conversation}/messages | ConversationController@messages | A, role:UMKM,STUDENT |
| 59 | POST | conversations/{conversation}/messages | ConversationController@store | A, role:UMKM,STUDENT |
| 60 | POST | milestones/{milestone}/disputes | MilestoneReviewController@dispute | A, role:UMKM,STUDENT |
| 61 | GET | submissions/{submission}/files/{file} | MilestoneReviewController@downloadFile | A |
| 62 | GET | admin/verifications | VerificationController@index | A, role:ADMIN |
| 63 | GET | admin/students/{student}/ktm | VerificationController@downloadKtm | A, role:ADMIN |
| 64 | GET | admin/alerts | AdminAlertController@index | A, role:ADMIN |
| 65 | GET | admin/alerts/{alert} | AdminAlertController@show | A, role:ADMIN |
| 66 | POST | admin/alerts/{alert}/follow-ups | AdminAlertController@followUp | A, role:ADMIN |
| 67 | GET | admin/cancellations/{cancellation} | AdminDecisionController@showCancellation | A, role:ADMIN |
| 68 | POST | admin/cancellations/{cancellation}/approve | AdminDecisionController@approveCancellation | A, role:ADMIN |
| 69 | POST | admin/cancellations/{cancellation}/reject | AdminDecisionController@rejectCancellation | A, role:ADMIN |
| 70 | POST | admin/contracts/{contract}/terminate | AdminDecisionController@terminateContract | A, role:ADMIN |
| 71 | POST | admin/milestones/{milestone}/force-approve | AdminDecisionController@forceApprove | A, role:ADMIN |
| 72 | POST | admin/milestones/{milestone}/return-to-student | AdminDecisionController@returnToStudent | A, role:ADMIN |
| 73 | POST | admin/milestones/{milestone}/reassign-mentor | AdminDecisionController@reassignMentor | A, role:ADMIN |
| 74 | POST | admin/milestones/{milestone}/extra-chance | AdminDecisionController@extraChance | A, role:ADMIN |
| 75 | POST | admin/milestones/{milestone}/forward-to-client | AdminDecisionController@forwardToClient | A, role:ADMIN |
| 76 | POST | admin/users/{user}/suspend | AdminDecisionController@suspendUser | A, role:ADMIN |
| 77 | GET | admin/settings | AdminSettingsController@index | A, role:ADMIN |
| 78 | PUT | admin/settings | AdminSettingsController@update | A, role:ADMIN |
| 79 | GET | admin/reports/finance | AdminSettingsController@finance | A, role:ADMIN |
| 80 | POST | admin/verifications/{id}/{decision} | VerificationController@decide | A, role:ADMIN (`id` UUID, `decision` ∈ approve/reject) |
| 81 | GET | projects | ProjectController@index | A |
| 82 | GET | projects/{project} | ProjectController@show | A |
| 83 | GET | notifications | NotificationController@index | A |
| 84 | POST | notifications/{notification}/read | NotificationController@markRead | A |
| 85 | GET | contracts | ContractController@index | A |
| 86 | GET | contracts/{contract} | ContractController@show | A |
| + | POST | `/api/broadcasting/auth` (tanpa `v1`) | otorisasi channel broadcast | auth:sanctum |

Route di luar `/api`: `GET /` (welcome), `GET /up` (health check Laravel).

---

## 6. Database

### Migration (16 file → 53 tabel)

| File migration | Tabel dibuat | Tabel diubah |
|---|---|---|
| 0001_01_01_000000_create_users_table | users, password_reset_tokens, sessions | — |
| 0001_01_01_000001_create_cache_table | cache, cache_locks | — |
| 0001_01_01_000002_create_jobs_table | jobs, job_batches, failed_jobs | — |
| 2026_10_09_143704_create_personal_access_tokens_table | personal_access_tokens | — |
| 2026_10_09_150000_create_platform_settings_table | platform_settings | — |
| 2026_10_09_160000_create_identity_profile_tables | otp_codes, refresh_tokens, umkm_profiles, universities, student_profiles, mentor_profiles, service_categories, student_skills, mentor_expertises, portfolio_items, audit_logs | refresh_tokens |
| 2026_10_09_170000_create_project_phase_tables | projects, project_attachments, applications, contracts, milestones, mentor_assignments, submissions, submission_files, submission_reviews | — |
| 2026_10_09_180000_create_payment_escrow_ledger_tables | payments, payment_webhook_logs, escrows, wallets, ledger_transactions, ledger_entries | — |
| 2026_10_17_100000_add_started_at_to_milestones_table | — | milestones |
| 2026_10_17_100100_create_admin_alerts_table | admin_alerts | — |
| 2026_10_17_110000_complete_project_phase_tables | project_templates, invitations | projects, applications |
| 2026_10_17_120000_complete_finance_tables | milestone_settlements | payments, ledger_entries, wallets |
| 2026_10_17_130000_create_scheduler_and_notification_tables | notifications, alert_follow_ups, scheduler_action_logs | — |
| 2026_10_17_140000_create_cancellation_tables | cancellation_requests, cancellation_allocations, refunds | milestones |
| 2026_10_17_150000_create_phase_seven_tables | bank_accounts, payouts, certificates, ratings, conversations, messages, premium_listings | — |
| 2026_10_17_160000_harden_financial_constraints | — | ledger_transactions, portfolio_items, platform_settings |

Catatan kompatibilitas: migration memakai `jsonb` dan **partial unique index** via `DB::statement("CREATE UNIQUE INDEX ... WHERE ...")` (contracts, wallets, cancellation_requests). Ini didukung **PostgreSQL dan SQLite**, **tidak didukung MySQL/MariaDB**. Test backend (`phpunit.xml`) berjalan di **SQLite in-memory**.

### Model (`app/Models`, 41 model) — semua punya migration
AdminAlert, AlertFollowUp, Application, AuditLog, BankAccount, CancellationAllocation, CancellationRequest, Certificate, Contract, Conversation, Escrow, Invitation, LedgerEntry, LedgerTransaction, MentorAssignment, MentorProfile, Message, Milestone, MilestoneSettlement, OtpCode, Payment, PaymentWebhookLog, Payout, PlatformSetting, PortfolioItem, PremiumListing, Project, ProjectTemplate, Rating, RefreshToken, Refund, ServiceCategory, StudentProfile, Submission, SubmissionFile, SubmissionReview, UmkmProfile, University, User, UserNotification (`$table = 'notifications'`), Wallet.

### Tabel tanpa model
| Tabel | Keterangan |
|---|---|
| student_skills | pivot, dipakai di `StudentProfile` — wajar |
| mentor_expertises | pivot, dipakai di `MentorProfile` — wajar |
| scheduler_action_logs | diakses query builder di `Modules/scheduler/Services/SchedulerChecks.php` — wajar |
| **project_attachments** | **tidak direferensikan di kode mana pun** (tabel dibuat tapi belum dipakai) |

Tabel bawaan framework/Sanctum (wajar tanpa model): password_reset_tokens, sessions, cache, cache_locks, jobs, job_batches, failed_jobs, personal_access_tokens.

---

## 7. Masalah yang menghambat koneksi ke Next.js (`http://localhost:3000`)

### Menghambat backend berjalan
1. **`vendor/` dan `.env` belum ada** → aplikasi tidak bisa boot.
2. **Database tidak tersedia.** `DB_CONNECTION=pgsql`, tetapi PHP XAMPP tidak memuat `pdo_pgsql` dan PostgreSQL/Docker tidak terpasang → error *could not find driver*. MySQL XAMPP **tidak bisa** dipakai (partial index). Opsi: **SQLite** (`pdo_sqlite` aktif; dipakai test) atau pasang PostgreSQL 16 + aktifkan `extension=pdo_pgsql` dan `extension=pgsql` di `php.ini`.
3. **Redis tidak tersedia**, sementara `CACHE_STORE=redis` dan `QUEUE_CONNECTION=redis`. Rate limiter (login/register/OTP) memakai cache → **login error 500**. Untuk lokal: `CACHE_STORE=file` dan `QUEUE_CONNECTION=sync` (atau pasang Redis).

### Menghambat frontend mengakses backend
4. **CORS** hanya mengizinkan `http://localhost:5173` (Vite) → request browser dari `localhost:3000` diblokir. Perlu `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`.
5. **OTP WhatsApp tanpa fallback lokal.** `MetaWhatsAppOtpSender` melempar exception jika kredensial Meta kosong; `OtpService::send()` menangkapnya dan mengembalikan **503 "OTP delivery is temporarily unavailable."** Karena register wajib `verification_token` dari OTP, **akun baru tidak bisa dibuat di lokal**. Akun admin bisa dibuat via `php artisan auth:create-admin`.

### Bukan penghambat, tetapi perlu diketahui
- `supports_credentials: false` dan `SANCTUM_STATEFUL_DOMAINS` **tidak masalah** untuk mode Bearer token (baru relevan jika pindah ke Sanctum SPA cookie).
- `APP_URL=http://localhost:8000` cocok dengan `php artisan serve`. Server artisan mendengar di `127.0.0.1`; fetch **server-side** dari Next.js ke `localhost` bisa mencoba IPv6 (`::1`) dan gagal → gunakan `http://127.0.0.1:8000` untuk panggilan server-side.
- **Info lockout login hilang.** 429 dari throttle dirender ulang oleh `bootstrap/app.php` sebagai kode generik `HTTP_ERROR` dan **header `Retry-After` dibuang**; `exposed_headers` CORS juga kosong → frontend tidak bisa tahu berapa detik menunggu.
- **Tidak ada endpoint lupa/reset password**, padahal frontend punya halaman `/forgot-password`.

---

## Perbedaan kontrak backend vs frontend (perlu keputusan sebelum integrasi)

Frontend Next.js saat ini memakai **backend sementara (mock) di browser**. Semua panggilan auth sudah dipusatkan di satu file adapter: **`digital.in/lib/auth/api.js`** (fungsi `login`, `register`, `getVerificationStatus`, `resendOtp`, `verifyOtp`; flag `USE_MOCK`). Halaman tidak memanggil backend langsung, jadi integrasi cukup mengganti isi fungsi di file itu (+ menyesuaikan alur jika diputuskan berubah). Aturan validasi frontend ada di `digital.in/lib/auth/validation.js`.

| Aspek | Backend Laravel | Frontend saat ini |
|---|---|---|
| Identitas utama daftar | Nomor HP (E.164, `+62…`) | Email |
| OTP | WhatsApp, **sebelum** register (`otp/send` → `otp/verify` → `verification_token`) | Email, **setelah** register (halaman `/verify-email`) |
| Field daftar | `business_name`/data student, `phone`, `verification_token`, `password` (min 8) | nama, email, password (min 8 + huruf besar + kecil + angka), konfirmasi, setuju S&K |
| Login | `{ identifier (email/HP), password }`, tanpa role | email + password + **pemilih role** (UMKM / Mahasiswa / Verify & Trust) |
| Role | `UMKM`, `STUDENT`, `ADMIN`, `MENTOR` | `umkm`, `mahasiswa`, `trust` (tidak ada mentor) |
| Pemetaan role | `UMKM`↔`umkm`, `STUDENT`↔`mahasiswa`, `ADMIN`↔`trust` | — |
| "Belum terverifikasi" | `PENDING_VERIFICATION` = verifikasi dokumen/admin; tetap bisa login | akun belum verifikasi OTP email → tidak bisa login |
| Token | access 15 menit + refresh 30 hari (`/auth/refresh`), logout kirim `refresh_token` | belum ada (role disimpan di localStorage) |
| Lockout login | 5 percobaan/menit → 429 tanpa `Retry-After` yang terbaca | 5x gagal → kunci 30 dtk + countdown |
| Lupa password | tidak ada endpoint | halaman `/forgot-password` (stub) |

### Keputusan yang masih terbuka
1. **OTP lokal:** pakai kredensial Meta WhatsApp asli, atau tambahkan sender OTP khusus lokal (mis. kode dicatat ke log) — opsi kedua mengubah kode backend.
2. **Alur daftar:** frontend mengikuti backend (HP + OTP WhatsApp sebelum daftar), atau backend disesuaikan ke alur email.
3. **Rate limit 429:** ubah renderer exception agar meneruskan `Retry-After` (+ tambah ke `exposed_headers` CORS) dan memberi kode `TOO_MANY_REQUESTS`.
4. **Pemilih role di login:** pertahankan (cocokkan dengan role akun) atau hapus karena backend menentukan role dari akun.

---

## Perintah setup manual (belum dijalankan)

Dari `D:\Semester5\VentureCreation\digitalin-nextjs\digital.in\backend`:

```bash
composer install
copy .env.example .env
php artisan key:generate
```

Ubah `.env`:
```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CACHE_STORE=file
QUEUE_CONNECTION=sync
```

Database — pilih satu:
- **SQLite (tercepat):** `DB_CONNECTION=sqlite`, beri komentar baris `DB_HOST`…`DB_PASSWORD`, lalu buat file:
  ```bash
  type nul > database\database.sqlite
  ```
- **PostgreSQL:** pasang PostgreSQL 16, aktifkan `extension=pdo_pgsql` dan `extension=pgsql` di `D:\xamppc\php\php.ini`, buat database `digitalin`, isi `DB_USERNAME`/`DB_PASSWORD`.

Lalu:
```bash
php artisan migrate --seed            # seeder: PlatformSettingsSeeder
php artisan route:list --path=api     # konfirmasi tabel route di atas
php artisan auth:create-admin         # akun ADMIN untuk peran Verify & Trust
php artisan test                      # opsional, SQLite in-memory
php artisan serve --host=127.0.0.1 --port=8000
```

Perintah artisan kustom lain yang tersedia: `payments:expire-overdue`, `payments:mock-pay {payment} --status=PAID|FAILED|EXPIRED`, `payouts:mock-complete {payout} --status=SUCCESS|FAILED`, `scheduler:sweep`.
