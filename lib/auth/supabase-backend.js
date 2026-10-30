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

export async function myProfile() {
  const { data: sessionData } = await supabase.auth.getUser();
  const authUser = sessionData?.user;
  if (!authUser) throw new AuthFlowError("UNAUTHENTICATED");
  const profile = await loadProfile(authUser.id);
  return { user: backendUserFrom(authUser, profile), profile };
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

// KTM & verifikasi identitas → CP2b.
export async function uploadKtm() {
  throw new AuthFlowError("KTM_NOT_ALLOWED");
}
export async function sendCampusEmailVerification() {
  throw new AuthFlowError("CAMPUS_EMAIL_NOT_AVAILABLE");
}
