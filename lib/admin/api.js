// Pemanggil API untuk halaman Verify & Trust (role ADMIN). Semua fungsi
// mengembalikan { ok: true, data, meta } atau { ok: false, error: { code, status, message } }.
// Token & refresh ditangani lib/api.js.
import { api, parseApiError } from "@/lib/api";

const MESSAGES = {
  NETWORK: "Tidak dapat terhubung ke server, coba lagi",
  UNAUTHENTICATED: "Sesi berakhir, silakan masuk lagi",
  FORBIDDEN: "Akun ini tidak punya akses ke tindakan ini",
  NOT_FOUND: "Data tidak ditemukan atau sudah berubah",
  VALIDATION_FAILED: "Periksa kembali isian",
  INVALID_STATE_TRANSITION: "Status data sudah berubah. Muat ulang lalu coba lagi",
  KTM_VERIFICATION_NOT_PENDING: "Pengajuan ini sudah tidak menunggu keputusan",
  TOO_MANY_REQUESTS: "Terlalu banyak permintaan, tunggu sebentar",
  SERVICE_UNAVAILABLE: "Layanan sedang tidak tersedia, coba lagi nanti",
};

function messageFor(e) {
  if (MESSAGES[e.code]) return MESSAGES[e.code];
  // Aturan bisnis lain: tampilkan pesan backend apa adanya supaya admin tahu alasannya.
  if (e.message) return `Tindakan ditolak: ${e.message}`;
  return "Terjadi kesalahan, coba lagi";
}

async function call(fn) {
  try {
    const res = await fn();
    return { ok: true, data: res.data?.data, meta: res.data?.meta || {} };
  } catch (err) {
    const e = parseApiError(err);
    return { ok: false, error: { code: e.code, status: e.status, message: messageFor(e), details: e.details } };
  }
}

/** Kenali tipe file dari beberapa byte pertamanya (header Content-Type/Disposition tidak diekspos CORS). */
async function sniffType(blob) {
  const bytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  return blob.type || "application/octet-stream";
}

export const adminApi = {
  // --- dashboard
  dashboardSummary: () => call(() => api.get("/admin/dashboard/summary")),
  // --- verifikasi pengguna
  verifications: () => call(() => api.get("/admin/verifications")),
  decideVerification: (id, decision, type, reason) => call(() => api.post(`/admin/verifications/${id}/${decision}`, { type, reason: reason || null })),
  // --- riwayat pengguna
  users: (params) => call(() => api.get("/admin/users", { params })),
  user: (id) => call(() => api.get(`/admin/users/${id}`)),
  suspendUser: (id, reason) => call(() => api.post(`/admin/users/${id}/suspend`, { reason })),
  // --- transaksi & dana
  escrows: (params) => call(() => api.get("/admin/escrows", { params })),
  /** Cairkan = force approve milestone sengketa (ESCALATED). */
  forceApprove: (milestoneId, notes) => call(() => api.post(`/admin/milestones/${milestoneId}/force-approve`, { notes: notes || null })),
  /** Kembalikan = hentikan kontrak; allocations mencakup semua milestone yang belum cair. */
  terminateContract: (contractId, allocations, notes) => call(() => api.post(`/admin/contracts/${contractId}/terminate`, { allocations, admin_notes: notes })),
  // --- laporan & sengketa, kualitas kerja
  disputes: (params) => call(() => api.get("/admin/disputes", { params })),
  dispute: (id) => call(() => api.get(`/admin/disputes/${id}`)),
  returnToStudent: (milestoneId, notes) => call(() => api.post(`/admin/milestones/${milestoneId}/return-to-student`, { notes })),
  extraChance: (milestoneId, notes) => call(() => api.post(`/admin/milestones/${milestoneId}/extra-chance`, { notes: notes || null })),
  forwardToClient: (milestoneId, notes) => call(() => api.post(`/admin/milestones/${milestoneId}/forward-to-client`, { notes: notes || null })),
  reassignMentor: (milestoneId) => call(() => api.post(`/admin/milestones/${milestoneId}/reassign-mentor`, {})),
  alerts: (params) => call(() => api.get("/admin/alerts", { params })),
  alert: (id) => call(() => api.get(`/admin/alerts/${id}`)),
  followUp: (alertId, input) => call(() => api.post(`/admin/alerts/${alertId}/follow-ups`, input)),
  /** KTM diambil dengan header Authorization → { url, type } (object URL; panggil URL.revokeObjectURL setelah dipakai). */
  async ktm(studentProfileId) {
    try {
      const res = await api.get(`/admin/students/${studentProfileId}/ktm`, { responseType: "blob" });
      const type = await sniffType(res.data);
      return { ok: true, data: { url: URL.createObjectURL(new Blob([res.data], { type })), type } };
    } catch (err) {
      const e = parseApiError(err);
      return { ok: false, error: { code: e.code, status: e.status, message: e.status === 404 ? "Dokumen KTM tidak ditemukan" : messageFor(e) } };
    }
  },
};
