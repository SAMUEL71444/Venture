// Pintu tunggal data transaksi platform. Semua sudut pandang membaca dari
// daftar yang sama (termin di lib/transactions.mock.js + log event proyek,
// status lewat fundStatusOfTerm di lib/escrow.js), lalu MEMPROYEKSIKAN sesuai
// perannya — bukan menyimpan atau menghitung ulang sendiri:
//   UMKM (Pembayaran)        -> forUmkm(rows, umkmId)       (lib/payments.js)
//   Mahasiswa (Penghasilan)  -> forMahasiswa(rows, mhsId)   (lib/earnings.js)
//   Verify & Trust           -> semua baris                  (Transaksi & Dana, Profil)
// Tiap baris memuat relasi eksplisit: projectId, umkmId, mahasiswaId, dan
// lastAdminId (admin yang terakhir menindak termin itu, dari log aktivitas).
// Saat backend dipasang, cukup ganti sumber `rows` di sini ke API.
import { buildEscrowTransactions, allPaymentTerms } from "./escrow";
import { getPlatformProjects } from "./platform-projects.mock";
import { getAllProjects, MOCK_TODAY } from "./projects.mock";
import { activeReportProjectIds } from "./reports.mock";

// `actions` = aksi manual admin atas dana (lib/activity-log.js -> escrowActions).
export function getAllTransactions({ actions = [], today = MOCK_TODAY } = {}) {
  const projects = getPlatformProjects(getAllProjects());
  return buildEscrowTransactions(projects, allPaymentTerms(), today, {
    actions, frozenProjectIds: activeReportProjectIds(),
  });
}

export const forUmkm = (rows, umkmId) => rows.filter((t) => t.umkmId === umkmId);
export const forMahasiswa = (rows, mahasiswaId) => rows.filter((t) => t.mahasiswaId === mahasiswaId);
