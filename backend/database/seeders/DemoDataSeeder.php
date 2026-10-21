<?php

namespace Database\Seeders;

use App\Models\Contract;
use App\Models\Conversation;
use App\Models\MentorProfile;
use App\Models\Milestone;
use App\Models\Payment;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\Submission;
use App\Models\UmkmProfile;
use App\Models\University;
use App\Models\User;
use App\Modules\admin\Services\AdminAlertService;
use App\Modules\auth\State\UserStateMachine;
use App\Modules\payment\Gateway\MockPaymentGateway;
use App\Modules\payment\Gateway\PaymentGateway;
use App\Support\Demo\DemoAccounts;
use App\Support\Demo\DemoApiClient;
use Illuminate\Database\Seeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Data demo (TIDAK dipanggil DatabaseSeeder — jalankan lewat `php artisan demo:seed`).
 *
 * Akun dibuat lewat model + state machine; semua alur bisnis (verifikasi KTM, proyek,
 * lamaran, kontrak, pembayaran escrow mock, milestone, review, sengketa, pembatalan,
 * pesan) lewat API aplikasi sendiri (DemoApiClient), jadi status & transisi valid.
 * Isi diambil dari mock frontend (lib/talents.mock.js, lib/projects.mock.js,
 * lib/users.mock.js, lib/reports.mock.js, lib/messages.mock.js).
 */
class DemoDataSeeder extends Seeder
{
    private string $password;

    private DemoApiClient $api;

    private User $admin;

    /** @var array<string, User> */
    private array $umkm = [];

    /** @var array<string, User> */
    private array $students = [];

    /** @var array<string, string> slug => id */
    private array $categories = [];

    private const CATEGORIES = [
        'social-media' => 'Social Media', 'branding' => 'Branding', 'marketplace' => 'Marketplace',
        'website' => 'Website', 'digital-bookkeeping' => 'Digital Bookkeeping', 'graphic-design' => 'Graphic Design',
        'data' => 'Data & Spreadsheet', 'video' => 'Video', 'ui-ux' => 'UI/UX', 'copywriting' => 'Copywriting',
    ];

    public function withPassword(string $password): self
    {
        $this->password = $password;

        return $this;
    }

    public function run(): void
    {
        if (! isset($this->password)) {
            throw new RuntimeException('Demo password belum diatur (jalankan lewat php artisan demo:seed).');
        }

        $this->api = app(DemoApiClient::class);

        try {
            $this->seedCategories();
            $this->seedAdminAndMentors();
            $this->seedUmkm();
            $this->seedStudents();
            $this->seedProjects();
        } finally {
            $this->api->revokeTokens();
        }
    }

    // --- akun --------------------------------------------------------------------

    private function seedCategories(): void
    {
        // Data referensi bersama (bukan milik akun demo) — tidak dihapus oleh demo:clear.
        foreach (self::CATEGORIES as $slug => $name) {
            $this->categories[$slug] = ServiceCategory::query()->firstOrCreate(['slug' => $slug], ['name' => $name, 'is_active' => true])->id;
        }
    }

    private function account(string $local, string $name, string $role, ?string $phone = null, string $status = 'PENDING_VERIFICATION'): User
    {
        return User::query()->create([
            'name' => $name,
            'email' => DemoAccounts::email($local),
            'phone' => $phone,
            'password_hash' => $this->password,
            'role' => $role,
            'status' => $status,
            'email_verified_at' => now(),
        ]);
    }

    private function seedAdminAndMentors(): void
    {
        $this->admin = $this->account('rizky.pratama', 'Rizky Pratama', 'ADMIN', null, 'ACTIVE');

        // Mentor dibutuhkan alur review milestone (mock frontend belum punya data mentor).
        foreach ([
            ['andi.wijaya', 'Andi Wijaya', 'Senior Brand & Content Designer', 'Studio Kreatif Nusantara'],
            ['lestari.handayani', 'Lestari Handayani', 'Konsultan Digital UMKM', 'Rumah UMKM Bandung'],
        ] as [$local, $name, $title, $institution]) {
            $mentor = $this->account($local, $name, 'MENTOR');
            $profile = MentorProfile::query()->create([
                'user_id' => $mentor->id, 'title' => $title, 'institution' => $institution,
                'bio' => "{$title} yang mendampingi mahasiswa mengerjakan proyek UMKM.",
                'verification_status' => 'PENDING', 'max_active_reviews' => 10, 'is_available' => true,
            ]);
            $profile->expertises()->attach(array_values($this->categories));
            $this->api->post($this->admin, "/admin/verifications/{$profile->id}/approve", ['type' => 'MENTOR']);
        }
    }

    private function seedUmkm(): void
    {
        $states = app(UserStateMachine::class);

        foreach ([
            'kopi' => ['kopi.anteng', 'Kopi Anteng', 'Kopi & Minuman', 'Jl. Braga No. 21', 'Bandung', '+6281211110001'],
            'batik' => ['batik.asri', 'Batik Asri Nusantara', 'Fesyen & Kerajinan', 'Jl. Slamet Riyadi No. 88', 'Surakarta', '+6281211110002'],
            'snack' => ['snack.kriuk', 'Snack Kriuk Ibu Tini', 'Makanan Ringan', 'Jl. Cibaduyut No. 5', 'Bandung', '+6281211110003'],
            'berkah' => ['berkah.furniture', 'Berkah Furniture', 'Furniture & Interior', 'Jl. Raya Tahunan No. 12', 'Jepara', '+6281211110004'],
            'seduh' => ['kedai.seduh', 'Kedai Seduh Nusantara', 'Kafe & Minuman', 'Jl. Kemang Raya No. 7', 'Jakarta Selatan', '+6281211110005'],
        ] as $key => [$local, $business, $type, $address, $city, $phone]) {
            // Sama seperti registrasi UMKM: nama akun = nama usaha, PENDING → ACTIVE.
            $user = $this->account($local, $business, 'UMKM', $phone);
            $user->phone_verified_at = now();
            $states->transition($user, 'ACTIVE');
            $user->save();
            UmkmProfile::query()->create([
                'user_id' => $user->id, 'business_name' => $business, 'business_type' => $type,
                'address' => $address, 'city' => $city, 'instagram_url' => 'https://instagram.com/'.Str::slug($business, ''),
            ]);
            $this->umkm[$key] = $user;
        }
    }

    private function seedStudents(): void
    {
        // [kunci, email, nama, singkatan kampus, jurusan, semester, skill => level, status akhir, portofolio]
        $rows = [
            ['nadia', 'nadia.putri', 'Nadia Putri', 'UI', 'Desain Komunikasi Visual', 5, ['social-media' => 'ADVANCED', 'graphic-design' => 'INTERMEDIATE', 'copywriting' => 'INTERMEDIATE'], 'VERIFIED', ['Kampanye Instagram Kedai Kopi Lokal', 'Feed bulanan + 4 reels untuk kedai kopi, engagement naik 2x.']],
            ['rangga', 'rangga.saputra', 'Rangga Saputra', 'ITB', 'Teknik Informatika', 7, ['website' => 'ADVANCED', 'ui-ux' => 'INTERMEDIATE'], 'PENDING', null],
            ['dewi', 'dewi.lestari', 'Dewi Lestari', 'UGM', 'Akuntansi', 6, ['digital-bookkeeping' => 'ADVANCED', 'data' => 'INTERMEDIATE'], 'VERIFIED', ['Pembukuan Digital Toko Kelontong', 'Migrasi catatan kas manual ke Google Sheets dengan laporan bulanan otomatis.']],
            ['farhan', 'farhan.maulana', 'Farhan Maulana', 'BINUS', 'Desain Komunikasi Visual', 7, ['branding' => 'ADVANCED', 'graphic-design' => 'ADVANCED'], 'VERIFIED', ['Identitas Merek Usaha Batik', 'Logo, palet warna, dan panduan merek ringkas untuk UMKM batik.']],
            ['kirana', 'kirana.ayu', 'Kirana Ayu', 'Tel-U', 'Ilmu Komunikasi', 5, ['social-media' => 'ADVANCED', 'copywriting' => 'INTERMEDIATE'], 'PENDING', null],
            ['bagas', 'bagas.wirawan', 'Bagas Wirawan', 'UNDIP', 'Manajemen', 6, ['marketplace' => 'ADVANCED'], 'PENDING', null],
            ['putri', 'putri.anggraini', 'Putri Anggraini', 'ITS', 'Sistem Informasi', 5, ['data' => 'ADVANCED', 'digital-bookkeeping' => 'INTERMEDIATE'], 'VERIFIED', ['Dashboard Penjualan Excel', 'Dashboard stok & penjualan mingguan untuk toko sembako.']],
            ['yoga', 'yoga.pratama', 'Yoga Pratama', 'UNUD', 'Ilmu Komunikasi', 6, ['video' => 'ADVANCED', 'social-media' => 'INTERMEDIATE'], 'VERIFIED', ['Seri Video TikTok Warung Makan', '8 video pendek promosi menu dengan total 120 ribu penonton.']],
            ['aulia', 'aulia.rahman', 'Aulia Rahman', 'UNHAS', 'Teknik Informatika', 7, ['ui-ux' => 'ADVANCED', 'website' => 'INTERMEDIATE'], 'VERIFIED', ['Redesain Aplikasi Pemesanan Katering', 'Riset pengguna dan prototipe Figma untuk aplikasi katering rumahan.']],
            ['maria', 'maria.wenda', 'Maria Wenda', 'UNCEN', 'Sastra Indonesia', 5, ['copywriting' => 'ADVANCED'], 'REJECTED', null],
        ];

        foreach ($rows as [$key, $local, $name, $campus, $major, $semester, $skills, $finalStatus, $portfolio]) {
            $user = $this->account($local, $name, 'STUDENT', null);
            $profile = StudentProfile::query()->create([
                'user_id' => $user->id,
                'university_id' => University::query()->where('short_name', $campus)->value('id')
                    ?? throw new RuntimeException("Universitas {$campus} belum diimpor (jalankan php artisan universities:import)."),
                'nim' => (string) random_int(10000000, 99999999), 'major' => $major, 'semester' => $semester,
                'bio' => "Mahasiswa {$major} yang senang membantu UMKM naik kelas lewat proyek nyata.",
            ]);
            $profile->skills()->attach(collect($skills)->mapWithKeys(fn ($level, $slug) => [$this->categories[$slug] => ['level' => $level]])->all());

            // Semua mahasiswa demo mengunggah KTM dummy lewat API (sama seperti di /verify).
            $this->api->upload($user, '/students/me/verification', [], [
                'ktm' => UploadedFile::fake()->createWithContent('ktm-'.Str::slug($name).'.pdf', "%PDF-1.4\n% KTM demo {$name}\n"),
            ]);

            if ($finalStatus === 'VERIFIED') {
                $this->api->post($this->admin, "/admin/verifications/{$profile->id}/approve", ['type' => 'STUDENT_KTM']);
                [$title, $description] = $portfolio;
                $this->api->post($user, '/students/me/portfolio', ['title' => $title, 'description' => $description]);
            } elseif ($finalStatus === 'REJECTED') {
                $this->api->post($this->admin, "/admin/verifications/{$profile->id}/reject", [
                    'type' => 'STUDENT_KTM', 'reason' => 'Foto KTM terpotong sehingga nama dan nomor induk tidak terbaca.',
                ]);
            }

            $this->students[$key] = $user->fresh();
        }
    }

    // --- proyek & kontrak -----------------------------------------------------------

    private function seedProjects(): void
    {
        ['kopi' => $kopi, 'batik' => $batik, 'snack' => $snack, 'berkah' => $berkah, 'seduh' => $seduh] = $this->umkm;
        $s = $this->students;

        // 1. Draft — "Laporan Keuangan Bulanan" (lib/projects.mock.js sp4).
        $this->project($snack, 'digital-bookkeeping', 'Laporan Keuangan Bulanan', 'Susun laporan kas masuk-keluar bulanan dalam format spreadsheet siap pakai.', 500000, 45, publish: false);

        // 2. Dipublikasikan + 2 lamaran menunggu — "Optimasi SEO Website Toko" (sp1).
        $seo = $this->project($kopi, 'website', 'Optimasi SEO Website Toko', 'Perbaikan SEO on-page dan kecepatan loading untuk website katalog kopi.', 1100000, 40);
        $this->apply($s['aulia'], $seo, 1100000, 21, [['Audit SEO & kecepatan', 400000], ['Perbaikan on-page & laporan', 700000]],
            'Saya akan mengaudit SEO dan Core Web Vitals, lalu memperbaiki struktur halaman katalog.');
        $this->apply($s['farhan'], $seo, 950000, 18, [['Audit & rekomendasi', 350000], ['Implementasi perbaikan', 600000]],
            'Saya bisa membantu merapikan meta, gambar produk, dan struktur heading.');

        // 3. Berjalan — "Desain Konten Instagram Bulanan" (mp1): 2 milestone cair, 1 di review mentor.
        $mp1 = $this->contract($kopi, $s['nadia'], 'social-media', 'Desain Konten Instagram Bulanan',
            '12 desain feed dan 4 reels untuk promosi menu baru bulan ini.', 1500000, [
                ['Moodboard & kalender konten', 250000], ['Batch 1: 6 desain feed', 400000],
                ['Batch 2: 6 desain feed', 400000], ['4 video reels menu baru', 450000],
            ]);
        $this->approveMilestone($mp1, 1, 'moodboard-kopi-anteng.pdf');
        $this->approveMilestone($mp1, 2, 'feed-batch-1.pdf');
        $this->submitAndForward($mp1, 3, 'feed-batch-2-draft.pdf', mentorReview: false);
        $this->chat($kopi, $s['nadia'], $mp1, [
            [$kopi, 'Halo Nadia! Makasih ya udah setuju bantu Kopi Anteng bulan ini 😊'],
            [$s['nadia'], 'Halo kak Ratna! Siap, saya mulai riset dulu buat moodboard-nya ya'],
            [$kopi, 'Udah aku cek, bagus banget! Lanjut aja ke tahap berikutnya'],
            [$s['nadia'], 'Draf batch 2 udah aku upload, mohon dicek dulu sebelum aku lanjut ke reels'],
            [$kopi, 'Kelihatannya oke, tapi warnanya boleh dibikin lebih hangat nggak? Biar sesuai vibe kedai'],
        ]);

        // 4. Berjalan — "Pembuatan Logo & Panduan Merek" (mp2): sengketa milestone 1 diputus admin
        //    (force approve), milestone 2 menunggu review UMKM.
        $mp2 = $this->contract($batik, $s['farhan'], 'branding', 'Pembuatan Logo & Panduan Merek',
            'Logo baru untuk lini produk batik premium, lengkap dengan brand guideline ringkas.', 2000000, [
                ['Konsep & 3 alternatif logo', 800000], ['Logo final & panduan merek', 1200000],
            ]);
        $m = $this->exhaustRevisions($mp2, 1, 'konsep-logo-batik.pdf');
        $this->api->post($batik, "/milestones/{$m->id}/disputes", ['reason' => 'Revisi kedua alternatif logo masih belum memakai motif parang sesuai brief.']);
        $this->api->post($this->admin, "/admin/milestones/{$m->id}/force-approve", ['notes' => 'Ketiga alternatif sudah sesuai brief tertulis; motif parang tidak tercantum di kesepakatan awal.']);
        $this->submitAndForward($mp2, 2, 'logo-final-panduan-merek.pdf');
        $this->chat($batik, $s['farhan'], $mp2, [
            [$batik, 'Mas Farhan, logo final dan panduan mereknya sudah saya terima, saya cek dulu ya.'],
            [$s['farhan'], 'Siap Bu, kalau ada yang perlu disesuaikan kabari saja.'],
        ]);

        // 5. Berjalan + sengketa terbuka — "Pendaftaran & Optimasi Toko Shopee" (mp3, laporan rep1).
        $mp3 = $this->contract($snack, $s['nadia'], 'marketplace', 'Pendaftaran & Optimasi Toko Shopee',
            'Daftarkan toko di Shopee, unggah 10 produk pertama, dan optimasi judul serta foto produk.', 600000, [
                ['Pendaftaran toko & 10 produk pertama', 250000], ['Optimasi judul, foto & deskripsi produk', 350000],
            ]);
        $this->approveMilestone($mp3, 1, 'toko-shopee-10-produk.pdf');
        $m = $this->exhaustRevisions($mp3, 2, 'optimasi-produk-shopee.pdf');
        $this->api->post($snack, "/milestones/{$m->id}/disputes", ['reason' => 'Hasil revisi judul & foto produk belum sesuai permintaan.']);

        // 6. Berjalan + sengketa terbuka — "Website Company Profile Sederhana" (mp4, laporan rep4).
        $mp4 = $this->contract($berkah, $s['aulia'], 'website', 'Website Company Profile Sederhana',
            'Website company profile 5 halaman untuk usaha furniture, termasuk galeri produk.', 3500000, [
                ['Wireframe & desain halaman', 1000000], ['Pengembangan website 5 halaman', 1800000], ['Revisi akhir & serah terima', 700000],
            ]);
        $m = $this->exhaustRevisions($mp4, 1, 'wireframe-berkah-furniture.pdf');
        $this->api->post($berkah, "/milestones/{$m->id}/disputes", ['reason' => 'Desain halaman tidak sesuai mockup yang disepakati.']);

        // 7. Selesai — "Rapikan Pembukuan 6 Bulan Terakhir" (mp5): semua cair + rating.
        $mp5 = $this->contract($seduh, $s['dewi'], 'digital-bookkeeping', 'Rapikan Pembukuan 6 Bulan Terakhir',
            'Rekap transaksi 6 bulan terakhir ke spreadsheet dan susun laporan laba rugi sederhana.', 800000, [
                ['Rekap transaksi Maret–Mei', 400000], ['Rekap Juni–Agustus & laporan laba rugi', 400000],
            ]);
        $this->approveMilestone($mp5, 1, 'rekap-maret-mei.pdf');
        $this->approveMilestone($mp5, 2, 'laporan-laba-rugi.pdf');
        $this->api->post($seduh, "/contracts/{$mp5->id}/ratings", ['target' => 'STUDENT', 'score' => 5, 'comment' => 'Rapi, cepat, dan mudah dipahami. Terima kasih Dewi!']);
        $this->api->post($s['dewi'], "/contracts/{$mp5->id}/ratings", ['target' => 'UMKM', 'score' => 5, 'comment' => 'Data dari pemilik lengkap dan komunikasinya jelas.']);

        // 8. Dibatalkan, dana dikembalikan — "Konten TikTok Mingguan" (mp7). Dibayar tetapi dibatalkan
        //    UMKM sebelum mahasiswa mulai → escrow REFUNDED, kontrak & proyek CANCELLED.
        $mp7 = $this->contract($seduh, $s['yoga'], 'video', 'Konten TikTok Mingguan',
            'Produksi 8 video TikTok mingguan untuk promosi menu kopi susu.', 900000, [
                ['Konsep & 4 video minggu pertama', 450000], ['4 video minggu kedua', 450000],
            ], start: false);
        $this->api->post($seduh, "/contracts/{$mp7->id}/cancellations", [
            'reason' => 'Promosi TikTok ditunda karena kedai sedang renovasi.', 'reopen_project' => false,
        ]);

        // Alert kualitas kerja (biasanya dibuat scheduler saat tenggat lewat).
        $alerts = app(AdminAlertService::class);
        $alerts->open('MENTOR_OVERDUE', 'MEDIUM', 'MILESTONE', $this->milestoneOf($mp1, 3)->id);
        $alerts->open('UMKM_UNRESPONSIVE', 'MEDIUM', 'MILESTONE', $this->milestoneOf($mp2, 2)->id);
    }

    private function project(User $umkm, string $category, string $title, string $description, int $budget, int $deadlineDays, bool $publish = true): string
    {
        $project = $this->api->post($umkm, '/projects', [
            'category_id' => $this->categories[$category], 'title' => $title, 'description' => $description,
            'budget_min' => (int) round($budget * 0.8, -4), 'budget_max' => $budget,
            'deadline' => now()->addDays($deadlineDays)->toDateString(),
            'city' => UmkmProfile::query()->where('user_id', $umkm->id)->value('city'),
        ]);
        if ($publish) {
            $this->api->post($umkm, "/projects/{$project['id']}/publish");
        }

        return $project['id'];
    }

    /** @param list<array{0: string, 1: int}> $milestones */
    private function apply(User $student, string $projectId, int $price, int $days, array $milestones, string $proposal): string
    {
        return $this->api->post($student, "/projects/{$projectId}/applications", [
            'proposal' => $proposal, 'offered_price' => $price, 'estimated_days' => $days,
            'proposed_milestones' => collect($milestones)->values()->map(fn ($m, $i) => [
                'title' => $m[0], 'amount' => $m[1], 'due_date' => now()->addDays(7 * ($i + 1))->toDateString(),
            ])->all(),
        ])['id'];
    }

    /** Proyek → lamaran → diterima → dibayar (escrow mock) → dimulai mahasiswa. */
    private function contract(User $umkm, User $student, string $category, string $title, string $description, int $budget, array $milestones, bool $start = true): Contract
    {
        $projectId = $this->project($umkm, $category, $title, $description, $budget, 60);
        $applicationId = $this->apply($student, $projectId, $budget, 7 * count($milestones), $milestones,
            "Saya tertarik mengerjakan \"{$title}\" dan siap mulai minggu ini.");
        $contract = Contract::query()->findOrFail($this->api->post($umkm, "/applications/{$applicationId}/accept")['contract']['id']);

        $payment = Payment::query()->findOrFail($this->api->post($umkm, "/contracts/{$contract->id}/payments", ['method' => 'VA'])['id']);
        $raw = json_encode(['gateway_ref' => $payment->gateway_ref, 'status' => 'PAID', 'gross_amount' => $payment->total_charged], JSON_THROW_ON_ERROR);
        $gateway = app(PaymentGateway::class);
        if (! $gateway instanceof MockPaymentGateway) {
            throw new RuntimeException('Data demo membutuhkan driver pembayaran mock (PAYMENT_GATEWAY_DRIVER=mock).');
        }
        $this->api->raw('/webhooks/payment-gateway', $raw, [MockPaymentGateway::SIGNATURE_HEADER => $gateway->sign($raw)]);

        if ($start) {
            $this->api->post($student, "/contracts/{$contract->id}/start");
        }

        return $contract->fresh();
    }

    private function milestoneOf(Contract $contract, int $sequence): Milestone
    {
        return Milestone::query()->where('contract_id', $contract->id)->where('sequence', $sequence)->firstOrFail();
    }

    private function submit(Contract $contract, int $sequence, string $file): Submission
    {
        $milestone = $this->milestoneOf($contract, $sequence);
        $this->api->upload(User::query()->findOrFail($contract->student_id), "/milestones/{$milestone->id}/submissions",
            ['notes' => 'Hasil pekerjaan sudah saya unggah, mohon ditinjau.'],
            ['files' => [UploadedFile::fake()->createWithContent($file, "%PDF-1.4\n% Hasil kerja demo: {$file}\n")]]);

        return Submission::query()->where('milestone_id', $milestone->id)->orderByDesc('version_no')->firstOrFail();
    }

    /** Kirim hasil → mentor setuju (diteruskan ke UMKM). Tanpa review mentor: berhenti di MENTOR_REVIEW. */
    private function submitAndForward(Contract $contract, int $sequence, string $file, bool $mentorReview = true): Submission
    {
        $submission = $this->submit($contract, $sequence, $file);
        if ($mentorReview) {
            $mentor = User::query()->findOrFail($this->milestoneOf($contract, $sequence)->mentor_id);
            $this->api->post($mentor, "/submissions/{$submission->id}/mentor-review", ['decision' => 'APPROVED', 'feedback' => 'Sudah sesuai brief, silakan diteruskan ke klien.']);
        }

        return $submission;
    }

    private function approveMilestone(Contract $contract, int $sequence, string $file): void
    {
        $submission = $this->submitAndForward($contract, $sequence, $file);
        $this->api->post(User::query()->findOrFail($contract->umkm_id), "/submissions/{$submission->id}/client-review",
            ['decision' => 'APPROVED', 'feedback' => 'Hasilnya bagus, terima kasih!']);
    }

    /** Pakai semua jatah revisi lalu berhenti di CLIENT_REVIEW (syarat mengajukan sengketa). */
    private function exhaustRevisions(Contract $contract, int $sequence, string $file): Milestone
    {
        $umkm = User::query()->findOrFail($contract->umkm_id);
        $milestone = $this->milestoneOf($contract, $sequence);

        for ($round = 1; $round <= $milestone->max_revisions; $round++) {
            $submission = $this->submitAndForward($contract, $sequence, $file);
            $this->api->post($umkm, "/submissions/{$submission->id}/client-review",
                ['decision' => 'REVISION_REQUESTED', 'feedback' => "Revisi {$round}: masih belum sesuai yang saya minta."]);
        }
        $this->submitAndForward($contract, $sequence, $file);

        return $milestone->fresh();
    }

    /** @param list<array{0: User, 1: string}> $messages */
    private function chat(User $umkm, User $student, Contract $contract, array $messages): void
    {
        $conversationId = Conversation::query()
            ->where('project_id', $contract->project_id)->where('student_user_id', $student->id)->value('id');
        foreach ($messages as [$sender, $body]) {
            $this->api->post($sender, "/conversations/{$conversationId}/messages", ['body' => $body]);
        }
    }
}
