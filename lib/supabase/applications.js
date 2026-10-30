// Lapisan data lamaran/kontrak/milestone (CP4).
// Memakai fungsi RPC di database untuk operasi yang butuh aturan bisnis
// (apply, accept) supaya atomik & aman. Baca biasa lewat select + RLS.
import { supabase } from "./client";

const ERR = {
  UNAUTHENTICATED: "Harus login dulu",
  ROLE_FORBIDDEN: "Hanya mahasiswa yang bisa melamar",
  NOT_VERIFIED: "Akunmu belum terverifikasi. Unggah KTM dan tunggu persetujuan admin sebelum melamar proyek.",
  PROJECT_NOT_FOUND: "Proyek tidak ditemukan",
  PROJECT_NOT_OPEN: "Proyek sudah tidak menerima lamaran",
  ACTIVE_CONTRACT_LIMIT: "Kamu sudah mencapai batas kontrak aktif (maks 2)",
  STUDENT_CONTRACT_LIMIT: "Mahasiswa ini sudah mencapai batas kontrak aktif",
  MILESTONE_SUM_MISMATCH: "Total milestone harus sama dengan nilai lamaran",
  MILESTONE_BELOW_MIN: "Ada milestone di bawah nilai minimum",
  ALREADY_APPLIED: "Kamu sudah melamar proyek ini",
  APPLICATION_NOT_FOUND: "Lamaran tidak ditemukan",
  APPLICATION_NOT_PENDING: "Lamaran sudah diproses",
  NOT_PROJECT_OWNER: "Hanya pemilik proyek yang bisa menerima lamaran",
};

// Ambil pesan ramah dari error RPC Postgres (pesannya kode yang kita raise).
function friendly(error) {
  const raw = error?.message || "";
  const code = Object.keys(ERR).find((k) => raw.includes(k));
  return { code: code || "UNKNOWN", message: code ? ERR[code] : (raw || "Terjadi kesalahan") };
}

/** Mahasiswa melamar proyek. milestones: [{name, amount}]. */
export async function applyToProject({ projectId, proposal, bidAmount, milestones }) {
  const { data, error } = await supabase.rpc("apply_to_project", {
    p_project_id: projectId,
    p_proposal: proposal || "",
    p_bid_amount: Math.round(Number(bidAmount) || 0),
    p_milestones: milestones || [],
  });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, data };
}

/** UMKM menerima lamaran → kontrak + milestone terbentuk. */
export async function acceptApplication(applicationId) {
  const { data, error } = await supabase.rpc("accept_application", { p_application_id: applicationId });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, data };
}

/** Daftar lamaran untuk sebuah proyek (dilihat UMKM pemilik). */
export async function listApplicationsForProject(projectId) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, student_id, proposal, bid_amount, proposed_milestones, match_score, status, created_at, student:profiles!applications_student_id_fkey(display_name)")
    .eq("project_id", projectId)
    .order("match_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, data: data || [] };
}

/** Lamaran milik mahasiswa yang login. */
export async function listMyApplications() {
  const { data: sess } = await supabase.auth.getUser();
  const uid = sess?.user?.id;
  if (!uid) return { ok: false, error: { code: "UNAUTHENTICATED", message: ERR.UNAUTHENTICATED } };
  const { data, error } = await supabase
    .from("applications")
    .select("id, project_id, bid_amount, status, created_at, project:projects(title)")
    .eq("student_id", uid)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, data: data || [] };
}

/** Kontrak milik user yang login (UMKM atau mahasiswa) + milestone-nya. */
export async function listMyContracts() {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, project_id, total_amount, status, contract_no, created_at, milestones(id, seq, name, amount, status), project:projects(title)")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, data: data || [] };
}
