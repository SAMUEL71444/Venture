// adminApi versi Supabase — simpel, hanya yang dipakai halaman Verify & Trust.
// Bentuk hasil { ok, data } / { ok, error } sama dengan versi Laravel.
import { supabase } from "./client";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PRIVATE_BUCKET || "digitalin-private";

function err(message, code = "UNKNOWN") {
  return { ok: false, error: { code, status: 0, message } };
}

export const supabaseAdminApi = {
  // Antrean verifikasi KTM mahasiswa (yang sudah unggah & pending).
  verifications: async () => {
    const { data, error } = await supabase.rpc("admin_verification_queue");
    if (error) return err(error.message);
    const rows = (data || []).map((r) => ({
      id: r.student_id,                  // id = student profile id (= user id)
      type: "STUDENT_KTM",
      method: "KTM",
      user: { name: r.name, email: null },
      university_name: r.university,
      submitted_at: null,
      attempts: 1,
    }));
    return { ok: true, data: rows };
  },

  // Setujui / tolak. decision: "approve" | "reject".
  decideVerification: async (studentId, decision, _type, reason) => {
    if (decision === "approve") {
      const { error } = await supabase.rpc("admin_approve_student", { p_student_id: studentId });
      if (error) return err(error.message);
    } else {
      const { error } = await supabase.rpc("admin_reject_student", { p_student_id: studentId, p_reason: reason || null });
      if (error) return err(error.message);
    }
    return { ok: true, data: {} };
  },

  // Ambil file KTM → object URL. Admin (trust) boleh baca semua KTM via
  // signed URL (dibuat server-side oleh Supabase Storage).
  ktm: async (studentId) => {
    // Cari path file KTM mahasiswa.
    const { data: sp, error } = await supabase
      .from("student_profiles")
      .select("ktm_file_path")
      .eq("profile_id", studentId)
      .maybeSingle();
    if (error) return err(error.message);
    if (!sp?.ktm_file_path) return err("Dokumen KTM tidak ditemukan", "NOT_FOUND");

    const { data: signed, error: sErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(sp.ktm_file_path, 300); // berlaku 5 menit
    if (sErr) return err(sErr.message);

    const ext = sp.ktm_file_path.split(".").pop().toLowerCase();
    const type = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
    return { ok: true, data: { url: signed.signedUrl, type } };
  },

  // Statistik dashboard admin.
  stats: async () => {
    const { data, error } = await supabase.rpc("admin_stats");
    if (error) return err(error.message);
    return { ok: true, data };
  },

  // Ringkasan dashboard admin — bentuk dicocokkan dengan yang diharapkan
  // TrustDashboard.js (held_funds.amount, recent_verifications, dst).
  dashboardSummary: async () => {
    const { data: s, error } = await supabase.rpc("admin_stats");
    if (error) return err(error.message);
    // Antrean verifikasi terbaru untuk daftar pendek.
    let recent = [];
    const q = await supabase.rpc("admin_verification_queue");
    if (!q.error) recent = (q.data || []).slice(0, 5).map((r) => ({ id: r.student_id, name: r.name, university: r.university, submitted_at: null }));
    return {
      ok: true,
      data: {
        pending_verifications: s.menunggu_verifikasi ?? 0,
        held_funds: { amount: s.dana_escrow ?? 0, contracts: s.kontrak_aktif ?? 0 },
        active_disputes: 0,
        recent_verifications: recent,
        recent_disputes: [],
        // ekstra (dipakai kalau mau tampilkan lebih banyak kartu):
        total_mahasiswa: s.total_mahasiswa, total_umkm: s.total_umkm,
        mahasiswa_aktif: s.mahasiswa_aktif, proyek_total: s.proyek_total,
        pendapatan_platform: s.pendapatan_platform,
      },
    };
  },
  users: async () => ({ ok: true, data: [] }),
  escrows: async () => ({ ok: true, data: [] }),
  disputes: async () => ({ ok: true, data: [] }),
  alerts: async () => ({ ok: true, data: [] }),
};
