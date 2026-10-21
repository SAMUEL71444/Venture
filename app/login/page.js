"use client";

import "../auth.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { ROLES } from "@/config/roles";
import AuthShell from "@/components/auth/AuthShell";
import PasswordInput from "@/components/auth/PasswordInput";
import { FieldError, FormAlert, SubmitButton, useCountdown } from "@/components/auth/AuthParts";
import { IconMail } from "@/components/auth/AuthIcons";
import { validateLogin, validateEmail } from "@/lib/auth/validation";
import { login, resendOtp, formatCountdown, demoAccounts, USE_MOCK } from "@/lib/auth/api";

const ROLE_OPTIONS = ["umkm", "mahasiswa", "trust"];
const roleLabel = (key) => (key === "mahasiswa" ? "Mahasiswa" : ROLES[key].label);
// "Ingat saya" hanya menyimpan email & peran — TIDAK PERNAH password.
const REMEMBER_KEY = "digitalin.rememberLogin";

const ASIDE = {
  title: "Selamat datang kembali.",
  text: "Lanjutkan proyek, pantau milestone, dan kelola pembayaranmu dari satu tempat.",
  points: [
    "Dana proyek ditahan aman di escrow sampai milestone disetujui",
    "Setiap UMKM dan mahasiswa melewati verifikasi identitas",
    "Progres dan riwayat proyek tercatat transparan",
  ],
};

export default function LoginPage() {
  const router = useRouter();
  const { setRole } = useRole();
  const [role, setSelectedRole] = useState("umkm");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null); // error dari backend
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [lockUntil, setLockUntil] = useState(null);
  const lockLeft = useCountdown(lockUntil);
  const emailRef = useRef(null);
  const passwordWrap = useRef(null);

  // Prefill dari "Ingat saya" (dibaca setelah mount — hindari hydration mismatch).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || "null");
      if (saved?.email) {
        setEmail(saved.email);
        if (ROLES[saved.role]) setSelectedRole(saved.role);
        setRemember(true);
      }
    } catch { /* storage tidak tersedia */ }
  }, []);

  // Kunci selesai → pesan kunci hilang sendiri.
  useEffect(() => {
    if (lockUntil && lockLeft === 0) {
      setLockUntil(null);
      setFormError((f) => (f?.code === "LOCKED" ? null : f));
    }
  }, [lockLeft, lockUntil]);

  const locked = lockLeft > 0;

  function pickRole(key) {
    setSelectedRole(key);
    setFormError((f) => (f?.code === "ROLE_MISMATCH" ? null : f));
    // Kalau isian masih akun demo role lain, ganti ke akun demo role ini.
    const demoEmails = Object.values(demoAccounts).map((a) => a.email);
    if (demoAccounts[key] && (!email || demoEmails.includes(email))) {
      setEmail(demoAccounts[key].email);
      if (password) setPassword(demoAccounts[key].password);
    }
  }

  function fillDemo() {
    const acc = demoAccounts[role];
    if (!acc) return;
    setEmail(acc.email);
    setPassword(acc.password);
    setErrors({});
    setFormError((f) => (f?.code === "LOCKED" ? f : null));
  }

  // Error field hilang/diperbarui begitu isian diperbaiki.
  function changeEmail(v) {
    setEmail(v);
    if (errors.email) setErrors((e) => ({ ...e, email: validateEmail(v) || undefined }));
    setFormError((f) => (f && f.code !== "LOCKED" ? null : f));
  }
  function changePassword(v) {
    setPassword(v);
    if (errors.password) setErrors((e) => ({ ...e, password: v ? undefined : "Password wajib diisi" }));
    setFormError((f) => (f && f.code !== "LOCKED" ? null : f));
  }

  function focusField(name) {
    if (name === "email") emailRef.current?.focus();
    else passwordWrap.current?.querySelector("input")?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || locked) return;
    const errs = validateLogin({ email, password });
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) {
      focusField(errs.email ? "email" : "password");
      return;
    }

    setLoading(true);
    const res = await login({ email, password, role });
    setLoading(false);

    if (res.ok) {
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: res.data.user.email, role: res.data.user.role }));
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* abaikan */ }
      setPassword("");
      setRole(res.data.user.role);
      router.push(ROLES[res.data.user.role].home);
      return;
    }

    const err = res.error;
    if (err.code === "VALIDATION") {
      setErrors(err.fields || {});
      return;
    }
    if (err.code === "LOCKED") setLockUntil(Date.now() + err.retryAfter * 1000);
    setFormError(err);
  }

  async function resendAndVerify() {
    if (resending) return;
    setResending(true);
    const res = await resendOtp({ email: formError.email });
    setResending(false);
    if (!res.ok && res.error.code === "NETWORK") {
      setFormError(res.error);
      return;
    }
    // Cooldown/blokir tetap diarahkan — halaman verifikasi menampilkan statusnya.
    router.push(`/verify-email?email=${encodeURIComponent(formError.email)}`);
  }

  function renderFormError() {
    if (!formError) return null;
    switch (formError.code) {
      case "LOCKED":
        return (
          <FormAlert tone="warning" title="Terlalu banyak percobaan gagal">
            Demi keamanan, login dikunci sementara. Coba lagi dalam <b>{formatCountdown(lockLeft)}</b>.
          </FormAlert>
        );
      case "UNVERIFIED":
        return (
          <FormAlert
            tone="warning"
            title={formError.message}
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={resendAndVerify} disabled={resending}>
                <IconMail size={16} /> {resending ? "Mengirim kode…" : "Kirim ulang kode & verifikasi"}
              </button>
            }
          >
            Verifikasi email dulu sebelum masuk. Kami akan mengirim kode 6 digit ke emailmu.
          </FormAlert>
        );
      case "ROLE_MISMATCH":
        return (
          <FormAlert
            title={formError.message}
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => pickRole(formError.role)}>
                Pilih peran {roleLabel(formError.role)}
              </button>
            }
          >
            Akun ini terdaftar sebagai <b>{roleLabel(formError.role)}</b>. Pilih peran yang sesuai lalu masuk lagi.
          </FormAlert>
        );
      default:
        return <FormAlert title={formError.message} />;
    }
  }

  return (
    <AuthShell aside={ASIDE} topLink={{ text: "Belum punya akun?", label: "Daftar", href: "/choose-type" }}>
      <h1 className="au-title">Masuk ke akunmu</h1>
      <p className="au-sub">Senang melihatmu lagi. Masukkan email dan password untuk melanjutkan.</p>

      <form className="au-form" onSubmit={handleSubmit} noValidate>
        {renderFormError()}

        <div className="field">
          <span className="au-label" id="login-role-label">Masuk sebagai</span>
          <div className="au-roles" role="radiogroup" aria-labelledby="login-role-label">
            {ROLE_OPTIONS.map((key) => (
              <button
                key={key} type="button" role="radio" aria-checked={role === key}
                className={`au-role ${role === key ? "selected" : ""}`}
                onClick={() => pickRole(key)}
              >
                {roleLabel(key)}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            ref={emailRef} id="login-email" name="email" type="email" className="input au-input"
            placeholder="nama@email.com" autoComplete="email" inputMode="email"
            value={email} onChange={(e) => changeEmail(e.target.value)}
            aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? "login-email-err" : undefined}
          />
          <FieldError id="login-email-err" message={errors.email} />
        </div>

        <div className="field" ref={passwordWrap}>
          <div className="au-label-row">
            <label htmlFor="login-password">Password</label>
            <Link href="/forgot-password" className="link-btn au-forgot">Lupa password?</Link>
          </div>
          <PasswordInput
            id="login-password" value={password} onChange={(e) => changePassword(e.target.value)}
            autoComplete="current-password" placeholder="Masukkan password"
            invalid={!!errors.password} describedBy={errors.password ? "login-password-err" : undefined}
          />
          <FieldError id="login-password-err" message={errors.password} />
        </div>

        <label className="au-check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Ingat saya di perangkat ini</span>
        </label>

        <SubmitButton loading={loading} disabled={locked} loadingText="Memeriksa akun…">
          {locked ? `Coba lagi dalam ${formatCountdown(lockLeft)}` : "Masuk"}
        </SubmitButton>

        {USE_MOCK && demoAccounts[role] && (
          <p className="au-demo-hint">
            Mode demo: <button type="button" className="link-btn" onClick={fillDemo}>isi akun demo {roleLabel(role)}</button>
          </p>
        )}
      </form>

      <p className="au-switch">
        Belum punya akun? <Link href="/choose-type" className="link-btn">Daftar gratis</Link>
      </p>
    </AuthShell>
  );
}
