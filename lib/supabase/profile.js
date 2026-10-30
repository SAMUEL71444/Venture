// Implementasi profileApi berbasis Supabase (dipakai saat USE_SUPABASE).
// Bentuk hasil { ok, data } / { ok, error } sama dengan versi Laravel supaya
// StudentProfile.js & SettingsView tidak perlu diubah.
import { supabase } from "./client";
import { setAuthUser } from "@/lib/auth/session";

const DB_TO_BACKEND_ROLE = { umkm: "UMKM", mahasiswa: "STUDENT", trust: "ADMIN" };
const STATUS_DB_TO_UI = { pending: "PENDING_VERIFICATION", active: "ACTIVE", suspended: "SUSPENDED" };
const VERIF_DB_TO_UI = { belum: "PENDING", pending: "PENDING", terverifikasi: "VERIFIED", ditolak: "REJECTED" };

function err(message, code = "UNKNOWN") {
  return { ok: false, error: { code, status: 0, message, fields: {} } };
}

async function currentAuthUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

async function loadFullProfile() {
  const authUser = await currentAuthUser();
  if (!authUser) return { ok: false, error: { code: "UNAUTHENTICATED", message: "Sesi berakhir, silakan masuk lagi", fields: {} } };

  const { data: p, error: pErr } = await supabase
    .from("profiles")
    .select("id, role, full_name, display_name, phone, avatar_url, status, created_at")
    .eq("id", authUser.id)
    .maybeSingle();
  if (pErr) return err(pErr.message);
  if (!p) return err("Profil tidak ditemukan");

  const user = {
    id: authUser.id,
    name: p.display_name || p.full_name || "",
    email: authUser.email || null,
    phone: authUser.phone || p.phone || null,
    role: DB_TO_BACKEND_ROLE[p.role] || null,
    status: STATUS_DB_TO_UI[p.status] || "PENDING_VERIFICATION",
    joined_at: p.created_at,
  };

  let profile = null;
  if (p.role === "mahasiswa") {
    const { data: sp } = await supabase
      .from("student_profiles")
      .select("university_id, university_name, major, bio, city, skills, campus_email, campus_email_verified, ktm_verification, rating_avg, completed_count")
      .eq("profile_id", authUser.id)
      .maybeSingle();
    let universityName = sp?.university_name || null;
    if (sp?.university_id) {
      const { data: uni } = await supabase.from("universities").select("name").eq("id", sp.university_id).maybeSingle();
      universityName = uni?.name || universityName;
    }
    // skills disimpan sebagai jsonb [{name, level}] atau [{id, level}].
    const skills = Array.isArray(sp?.skills) ? sp.skills.map((s, i) => ({ id: s.id || s.category_id || String(i), name: s.name || s.category_id || "Skill", level: s.level || "BEGINNER" })) : [];
    profile = {
      verification_status: VERIF_DB_TO_UI[sp?.ktm_verification || "belum"],
      university: universityName ? { name: universityName } : null,
      university_name_custom: sp?.university_name || null,
      major: sp?.major || null,
      semester: null,
      bio: sp?.bio || null,
      city: sp?.city || null,
      is_available: true,
      skills,
      portfolio: [],      // portofolio belum tabelnya — kosong dulu
      rating_avg: sp?.rating_avg ?? 0,
      completed_count: sp?.completed_count ?? 0,
    };
  } else if (p.role === "umkm") {
    const { data: up } = await supabase
      .from("umkm_profiles")
      .select("business_type, owner_name, business_size, city, address, npwp, nib, verification")
      .eq("profile_id", authUser.id)
      .maybeSingle();
    profile = {
      verification_status: VERIF_DB_TO_UI[up?.verification || "belum"],
      business_type: up?.business_type || null,
      owner_name: up?.owner_name || null,
      city: up?.city || null,
      address: up?.address || null,
      npwp: up?.npwp || null,
      nib: up?.nib || null,
    };
  }
  // admin/trust: profile = null (sesuai kontrak lama).

  return { ok: true, data: { user, profile } };
}

export const supabaseProfileApi = {
  me: async () => {
    const res = await loadFullProfile();
    if (res.ok) {
      const appRole = { UMKM: "umkm", STUDENT: "mahasiswa", ADMIN: "trust" }[res.data.user.role];
      if (appRole) setAuthUser({ ...res.data.user, appRole });
    }
    return res;
  },

  update: async (patch) => {
    const authUser = await currentAuthUser();
    if (!authUser) return err("Sesi berakhir", "UNAUTHENTICATED");

    // Tentukan tabel berdasarkan role.
    const { data: p } = await supabase.from("profiles").select("role").eq("id", authUser.id).maybeSingle();
    if (p?.role === "mahasiswa") {
      const upd = {};
      if ("bio" in patch) upd.bio = patch.bio;
      if ("major" in patch) upd.major = patch.major;
      if ("city" in patch) upd.city = patch.city;
      if (Object.keys(upd).length) {
        const { error } = await supabase.from("student_profiles").update(upd).eq("profile_id", authUser.id);
        if (error) return err(error.message);
      }
    }
    // display_name bisa diubah di tabel profiles.
    if ("name" in patch || "display_name" in patch) {
      const name = patch.display_name || patch.name;
      await supabase.from("profiles").update({ display_name: name }).eq("id", authUser.id);
    }
    return loadFullProfile().then((r) => {
      if (r.ok) {
        const appRole = { UMKM: "umkm", STUDENT: "mahasiswa", ADMIN: "trust" }[r.data.user.role];
        if (appRole) setAuthUser({ ...r.data.user, appRole });
      }
      return r;
    });
  },

  categories: async () => {
    const { data, error } = await supabase.from("service_categories").select("id, name, slug").order("sort_order");
    if (error) return err(error.message);
    return { ok: true, data };
  },

  saveSkills: async (skills) => {
    const authUser = await currentAuthUser();
    if (!authUser) return err("Sesi berakhir", "UNAUTHENTICATED");
    // Simpan sebagai jsonb di student_profiles.skills.
    const { error } = await supabase.from("student_profiles").update({ skills }).eq("profile_id", authUser.id);
    if (error) return err(error.message);
    return { ok: true, data: { skills } };
  },

  addPortfolio: async () => err("Portofolio belum tersedia di versi ini", "NOT_SUPPORTED"),
  certificates: async () => ({ ok: true, data: [] }),
  bankAccounts: async () => ({ ok: true, data: [] }),
  addBankAccount: async () => err("Belum tersedia", "NOT_SUPPORTED"),
};
