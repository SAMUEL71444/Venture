// Backend auth berbasis Supabase — implementasi yang mematuhi kontrak yang
// sama dengan `real` di lib/auth/api.js, supaya halaman UI tidak perlu diubah.
//
// CP2a (sekarang): register + login + logout + sesi + universities + profil.
//   * Alur OTP sengaja DILEWATI dulu (butuh konfigurasi email/WhatsApp).
//     sendOtp/verifyOtp mengembalikan token tiruan agar langkah UI tetap jalan;
//     pembuatan akun sebenarnya terjadi di register().
//   * KTM & verifikasi identitas → CP2b.
//
// Catatan token: Supabase mengelola sesinya sendiri (access + refresh) di
// localStorage lewat supabase-js. Kita tetap mengisi struktur `tokens` yang
// diharapkan session.js supaya lapisan lama tidak kaget, tetapi sumber
// kebenaran sesi adalah Supabase.
import { supabase } from "@/lib/supabase/client";
import { AuthFlowError } from "./errors";
import { UNIVERSITY_CUSTOM } from "./validation";

// Peran aplikasi web ↔ nilai enum user_role di database.
const APP_TO_DB = { umkm: "umkm", mahasiswa: "mahasiswa", trust: "trust" };

// Bentuk user yang diharapkan startSession() di api.js: { user: { role, ... }, tokens }
// role di sini pakai kode BACKEND LAMA (UMKM/STUDENT/ADMIN) supaya ROLE_FROM_BACKEND cocok.
const DB_TO_BACKEND_ROLE = { umkm: "UMKM", mahasiswa: "STUDENT", trust: "ADMIN" };

function backendUserFrom(authUser, profile) {
  return {
    id: authUser.id,
    name: profile?.display_name || profile?.full_name || "",
    email: authUser.email || null,
    phone: authUser.phone || profile?.phone || null,
    role: DB_TO_BACKEND_ROLE[profile?.role] || null,
    status: profile?.status || "pending",
    joined_at: authUser.created_at || null,
  };
}

// Supabase session → struktur tokens yang session.js harapkan.
function tokensFrom(session) {
  return {
    access_token: session?.access_token || "supabase-managed",
    refresh_token: session?.refresh_token || "supabase-managed",
    // session.js mungkin membaca expires_in; Supabase pakai expires_at (epoch detik).
    expires_in: session?.expires_in || 3600,
  };
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, display_name, phone, avatar_url, status")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new AuthFlowError("UNKNOWN", { detail: error.message });
  return data;
}

export async function sendOtp() {
  // CP2a: lewati OTP. Kembalikan jadwal tiruan supaya UI bisa lanjut.
  return { expiresAt: Date.now() + 10 * 60 * 1000, resendAfter: 30 };
}

export async function verifyOtp() {
  // CP2a: token tiruan; verifikasi sebenarnya tidak dilakukan di sini.
  return { token: "cp2a-skip-otp", expiresIn: 600 };
}

export async function register({ type, channel, identifier, values }) {
  const email = channel === "email" ? identifier : null;
  // Supabase Auth butuh email. Untuk pendaftaran via WhatsApp (tanpa email),
  // CP2a belum mendukung — arahkan pakai email dulu.
  if (!email) throw new AuthFlowError("VALIDATION", { fields: { identifier: "Untuk sekarang, daftar memakai email." } });

  const dbRole = APP_TO_DB[type];
  if (!dbRole) throw new AuthFlowError("ROLE_UNSUPPORTED");

  // 1. Buat akun di Supabase Auth.
  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email,
    password: values.password,
    options: {
      data: { app_role: dbRole, display_name: values.name?.trim() || "" },
    },
  });
  if (signUpError) {
    if (/already registered|already exists/i.test(signUpError.message)) {
      throw new AuthFlowError("IDENTIFIER_TAKEN");
    }
    throw new AuthFlowError("VALIDATION", { fields: { identifier: signUpError.message } });
  }

  const authUser = signUp.user;
  if (!authUser) throw new AuthFlowError("UNKNOWN");

  // 2. Buat baris profil + detail peran. (RLS mengizinkan insert milik sendiri.)
  const displayName = values.name?.trim() || "";
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authUser.id,
    role: dbRole,
    full_name: dbRole === "umkm" ? (values.owner?.trim() || "") : displayName,
    display_name: displayName,
    status: "pending",
  });
  if (profileError) throw new AuthFlowError("UNKNOWN", { detail: profileError.message });

  if (dbRole === "mahasiswa") {
    const custom = values.university === UNIVERSITY_CUSTOM;
    await supabase.from("student_profiles").insert({
      profile_id: authUser.id,
      university_id: custom ? null : (values.university || null),
      university_name: custom ? values.universityCustom?.trim() : null,
      campus_email: custom ? null : (values.campusEmail?.trim() || null),
      ktm_verification: "belum",
    });
  } else if (dbRole === "umkm") {
    await supabase.from("umkm_profiles").insert({
      profile_id: authUser.id,
      city: values.city?.trim() || null,
      verification: "belum",
    });
  }

  const profile = await loadProfile(authUser.id);
  return { user: backendUserFrom(authUser, profile), tokens: tokensFrom(signUp.session) };
}

export async function login({ identifier, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      // Email belum dikonfirmasi — di CP2a kita anggap kredensial oke tapi pending.
      throw new AuthFlowError("PENDING_VERIFICATION");
    }
    throw new AuthFlowError("INVALID_CREDENTIALS");
  }
  const profile = await loadProfile(data.user.id);
  return { user: backendUserFrom(data.user, profile), tokens: tokensFrom(data.session) };
}

export async function logout() {
  await supabase.auth.signOut();
}

// Status verifikasi DB (huruf kecil) → yang diharapkan UI (/verify, dsb).
// Catatan: 'belum' (belum mengajukan) dipetakan ke 'PENDING' supaya halaman
// /verify menampilkan FORM UNGGAH KTM (canUpload butuh status==='PENDING').
// Perbedaan "belum" vs "sudah submit menunggu" tetap terlihat lewat `has_ktm`.
const VERIF_DB_TO_UI = { belum: "PENDING", pending: "PENDING", terverifikasi: "VERIFIED", ditolak: "REJECTED" };

export async function myProfile() {
  const { data: sessionData } = await supabase.auth.getUser();
  const authUser = sessionData?.user;
  if (!authUser) throw new AuthFlowError("UNAUTHENTICATED");
  const profile = await loadProfile(authUser.id);

  // Lengkapi `profile` dengan bentuk yang halaman /verify & /profile harapkan.
  let detail = {};
  if (profile?.role === "mahasiswa") {
    const { data: sp } = await supabase
      .from("student_profiles")
      .select("university_id, university_name, major, bio, city, skills, campus_email, campus_email_verified, ktm_verification, ktm_file_path, rating_avg, completed_count")
      .eq("profile_id", authUser.id)
      .maybeSingle();
    let universityName = sp?.university_name || null;
    if (sp?.university_id) {
      const { data: uni } = await supabase.from("universities").select("name").eq("id", sp.university_id).maybeSingle();
      universityName = uni?.name || universityName;
    }
    detail = {
      verification_status: VERIF_DB_TO_UI[sp?.ktm_verification || "belum"],
      has_ktm: Boolean(sp?.ktm_file_path),
      campus_email: sp?.campus_email || null,
      campus_email_verified_at: sp?.campus_email_verified ? new Date().toISOString() : null,
      university: universityName ? { name: universityName } : null,
      university_name_custom: sp?.university_name || null,
      verification_attempts_remaining: 3, // batas 3x; perhitungan nyata menyusul
      major: sp?.major || null,
      bio: sp?.bio || null,
      city: sp?.city || null,
      skills: sp?.skills || [],
      rating_avg: sp?.rating_avg ?? 0,
      completed_count: sp?.completed_count ?? 0,
    };
  } else if (profile?.role === "umkm") {
    const { data: up } = await supabase
      .from("umkm_profiles")
      .select("business_type, owner_name, business_size, city, address, npwp, nib, verification")
      .eq("profile_id", authUser.id)
      .maybeSingle();
    detail = {
      verification_status: VERIF_DB_TO_UI[up?.verification || "belum"],
      business_type: up?.business_type || null,
      owner_name: up?.owner_name || null,
      city: up?.city || null,
      address: up?.address || null,
      npwp: up?.npwp || null,
      nib: up?.nib || null,
    };
  }

  return { user: backendUserFrom(authUser, profile), profile: { ...profile, ...detail } };
}

export async function universities() {
  const { data, error } = await supabase
    .from("universities")
    .select("id, name, email_domain, city")
    .order("name");
  if (error) throw new AuthFlowError("UNKNOWN", { detail: error.message });
  // Bentuk yang diharapkan UniversityCombobox: { id, name, ... }
  return data || [];
}

export async function resetPassword() {
  // CP2a: belum diimplementasikan (butuh alur email). Placeholder aman.
  throw new AuthFlowError("UNKNOWN");
}

const PRIVATE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_PRIVATE_BUCKET || "digitalin-private";

// Unggah KTM ke bucket privat lalu tandai status verifikasi = pending.
// Path file: ktm/<user-id>/<timestamp>.<ext> — hanya diakses lewat signed URL
// oleh peninjau (CP: Trust), tidak publik.
export async function uploadKtm(file) {
  const { data: sessionData } = await supabase.auth.getUser();
  const authUser = sessionData?.user;
  if (!authUser) throw new AuthFlowError("UNAUTHENTICATED");
  if (!file) throw new AuthFlowError("VALIDATION", { fields: { ktm: "Pilih file KTM dulu" } });

  const ext = (file.name?.split(".").pop() || "bin").toLowerCase();
  const path = `ktm/${authUser.id}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (upErr) {
    // Surface the real reason so the user tahu apa yang salah.
    console.error("Upload KTM gagal:", upErr);
    throw new AuthFlowError("UNKNOWN", { detail: "Gagal unggah file: " + upErr.message });
  }

  // Pastikan baris student_profiles ada (upsert) sebelum update status.
  await supabase.from("student_profiles").upsert(
    { profile_id: authUser.id },
    { onConflict: "profile_id", ignoreDuplicates: true },
  );

  const { error: updErr } = await supabase
    .from("student_profiles")
    .update({ ktm_file_path: path, ktm_verification: "pending" })
    .eq("profile_id", authUser.id);
  if (updErr) {
    console.error("Update status KTM gagal:", updErr);
    throw new AuthFlowError("UNKNOWN", { detail: "Gagal simpan status: " + updErr.message });
  }

  return { verification_status: "PENDING" };
}

export async function sendCampusEmailVerification() {
  // Butuh alur email kampus — belum didukung di tahap ini.
  throw new AuthFlowError("CAMPUS_EMAIL_NOT_AVAILABLE");
}
