# Panduan Migrasi Digital.in ke Next.js

## Cara jalanin

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Yang sudah dimigrasi penuh (contoh pola)

| Layar lama (`state.screen`) | Route Next.js baru      | File                                  |
|---|---|---|
| landing                     | `/`                     | `app/page.js`                         |
| login                       | `/login`                | `app/login/page.js`                   |
| choose-type                 | `/choose-type`          | `app/choose-type/page.js`             |
| register                    | `/register?type=umkm`   | `app/register/page.js`                |
| verify                      | `/verify?type=umkm`     | `app/verify/page.js`                  |
| forgot                      | `/forgot-password`      | `app/forgot-password/page.js`         |
| umkm-dashboard               | `/umkm/dashboard`       | `app/umkm/dashboard/page.js`          |
| maha-dashboard               | `/mahasiswa/dashboard`  | `app/mahasiswa/dashboard/page.js`     |

Plus infrastruktur bersama: `globals.css` (design token & utility class, disalin nyaris 1:1), `components/Icon.js`, `context/RoleContext.js` (ganti `state.role` global), `components/DashboardShell.js` (ganti fungsi `shell()`), `lib/mock-data.js` (semua array dummy).

**Pelajari 4 file ini dulu** sebelum lanjut migrasi sendiri — semua layar sisanya cuma mengulang pola yang sama:
1. `app/umkm/dashboard/page.js` — pola halaman "dalam app" (pakai `DashboardShell`)
2. `app/login/page.js` — pola halaman auth + form + navigasi
3. `components/DashboardShell.js` — cara sidebar/topbar/bottom-nav baca route aktif
4. `context/RoleContext.js` — cara role dibagi antar halaman

## Yang BELUM dimigrasi — sisa kerjaan, urut prioritas realistis

| Layar lama | Saran route baru | Catatan |
|---|---|---|
| umkm-projects | `/umkm/projects` | list + tabs (Aktif/Menunggu/Selesai/Draf) |
| post-project | `/umkm/post-project` | **wizard multi-step** — dulu pakai `state.wizardStep`; di React ganti `useState(1)` di komponen client, jangan taruh di URL kecuali mau tiap step bisa di-refresh/dibagikan |
| find-talent | `/umkm/find-talent` | list + filter panel |
| talent-profile | `/talent/[id]` | dynamic route, ambil data dari `STUDENTS.find(s => s.id === params.id)` sementara ini |
| umkm-payments | `/umkm/payments` | tabel statis, paling gampang |
| find-projects | `/mahasiswa/find-projects` | list + filter panel |
| project-detail | `/projects/[id]` | dynamic route |
| apply-project | `/projects/[id]/apply` | form lamar |
| maha-projects | `/mahasiswa/projects` | list |
| portfolio | `/mahasiswa/portfolio` | list statis |
| earnings | `/mahasiswa/earnings` | tabel statis |
| my-project | `/workspace/[id]` | **shared** antara UMKM & mahasiswa — tampilannya beda tergantung `role`, sama seperti pola `isUmkm` yang sudah ada di file lama |
| milestone-detail | `/workspace/[id]/milestones/[milestoneId]` | dynamic nested route |
| revision | `/workspace/[id]/milestones/[milestoneId]/revision` | dynamic nested route |
| messages | `/messages` | shared, layout 2 kolom — paling ribet karena ada state "kontak yang lagi dibuka" |
| notifications | `/notifications` | shared, list statis |
| profile | `/profile` | shared, form edit |

**Cara kerjain sisanya:** buka fungsi `screenX()` yang sesuai di `index.html` lama, lalu ikuti pola yang sama seperti `app/umkm/dashboard/page.js` — bungkus isinya dengan `<DashboardShell title="...">`, ganti semua `onclick="go(...)"` jadi `<Link href="...">` atau `router.push(...)`, ganti `${variabel}` jadi `{variabel}` JSX, ganti `class` jadi `className`.

## Hal yang sengaja BELUM ikut pindah (bukan lupa)

- **`toast()`** — dulu bikin notifikasi kecil muncul di pojok bawah. Di beberapa halaman baru (misal `app/verify/page.js`) saya ganti sementara jadi langsung pindah halaman tanpa notifikasi, di satu tempat pakai `alert()` biasa (`ApplicantRow.js`) sebagai placeholder paling murah. Sebelum lanjut migrasi, ganti ini dengan library toast beneran (`sonner` atau `react-hot-toast`) sekali di `app/layout.js`, supaya nggak perlu diulang manual di 15 tempat.
- **`demoRole()`** — trik lama nebak role dari registrasi terakhir. Di `app/login/page.js` sekarang di-hardcode `setRole("umkm")`. Begitu auth asli (Supabase Auth) masuk, ini yang pertama diganti.
- **Wizard `post-project`** (lines 919-1030 di file lama) belum dikonversi — ini paling kompleks karena punya banyak step dan pilihan kategori/template. Kerjakan terakhir setelah pola dasar sudah lancar.
- **Route guard** — sekarang `/umkm/dashboard` bisa diakses langsung tanpa login (role-nya `null`, jadi `DashboardShell` jatuh ke tampilan default). Sebelum ini jadi produk beneran, ini WAJIB ditambah — kalau tidak, siapa saja bisa buka halaman internal tanpa lewat login sama sekali.

## Kenapa strukturnya begini (ringkas alasan desain)

- **File `screenX()` → satu file `page.js` per route**, bukan satu file besar — supaya Next.js bisa nge-route otomatis dan tiap halaman testable sendiri-sendiri.
- **`state` global & `go()` dibuang total**, diganti `useRouter()`/`<Link>` (navigasi) + `useState`/Context (data yang perlu dibagi antar komponen). Alasannya sudah dibahas di percakapan sebelumnya: `innerHTML` re-render manual itu langsung bertabrakan sama model deklaratif React.
- **`STUDENTS`/`PROJECTS`/dll tetap sebagai array statis di `lib/mock-data.js`** — sengaja belum diganti fetch ke Supabase, supaya migrasi struktur (tahap ini) dan migrasi data (tahap Supabase, nanti) tidak dikerjakan bersamaan. Begitu Supabase siap, ganti isi file ini jadi fungsi `async function getStudents()` satu-satu per halaman, jangan sekaligus.
