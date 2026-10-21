"use client";

import "../auth.css";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { ROLES } from "@/config/roles";
import AuthShell from "@/components/auth/AuthShell";
import PasswordInput from "@/components/auth/PasswordInput";
import { FieldError, FormAlert, SubmitButton, useCountdown } from "@/components/auth/AuthParts";
import { validateLogin, channelOf, normalizeIdentifier } from "@/lib/auth/validation";
import { login, formatCountdown, demoAccounts, USE_MOCK, ROLE_FROM_BACKEND } from "@/lib/auth/api";

// "Ingat saya" hanya menyimpan email/nomor — TIDAK PERNAH password.
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

// Pesan dari ?reason= (diarahkan ke sini oleh RoleContext / halaman lupa password).
const REASONS = {
  expired: { tone: "info", title: "Sesi berakhir", text: "Silakan masuk lagi untuk melanjutkan." },
  suspended: { tone: "error", title: "Akun ini sedang ditangguhkan", text: "Hubungi tim Digital.in untuk informasi lebih lanjut." },
  reset: { tone: "success", title: "Password berhasil diubah", text: "Masuk dengan password barumu. Semua sesi lama sudah dikeluarkan." },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setRole } = useRole();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(() => REASONS[searchParams.get("reason")] || null);
  const [loading, setLoading] = useState(false);
  const [lockUntil, setLockUntil] = useState(null);
  const lockLeft = useCountdown(lockUntil);
  const identifierRef = useRef(null);
  const passwordWrap = useRef(null);

  // Prefill dari "Ingat saya" (dibaca setelah mount — hindari hydration mismatch).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || "null");
      if (saved?.identifier) {
        setIdentifier(saved.identifier);
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

  function clearTransientError() {
    setFormError((f) => (f && f.code !== "LOCKED" ? null : f));
  }

  function changeIdentifier(v) {
    setIdentifier(v);
    if (errors.identifier) setErrors((e) => ({ ...e, identifier: validateLogin({ identifier: v, password: "x" }).identifier }));
    clearTransientError();
  }
  function changePassword(v) {
    setPassword(v);
    if (errors.password) setErrors((e) => ({ ...e, password: v ? undefined : "Password wajib diisi" }));
    clearTransientError();
  }

  function fillDemo(account) {
    setIdentifier(account.identifier);
    setPassword(account.password);
    setErrors({});
    clearTransientError();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || locked) return;
    const errs = validateLogin({ identifier, password });
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) {
      if (errs.identifier) identifierRef.current?.focus();
      else passwordWrap.current?.querySelector("input")?.focus();
      return;
    }

    const value = normalizeIdentifier(channelOf(identifier), identifier);
    setLoading(true);
    const res = await login({ identifier: value, password });
    setLoading(false);

    if (res.ok) {
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ identifier: value }));
        else localStorage.removeItem(REMEMBER_KEY);
      } catch { /* abaikan */ }
      setPassword("");
      const { appRole, status } = res.data.user;
      setRole(appRole);
      // Mahasiswa yang belum terverifikasi diarahkan menyelesaikan verifikasi identitas.
      router.push(status === "PENDING_VERIFICATION" && appRole !== "trust" ? `/verify?type=${appRole}` : ROLES[appRole].home);
      return;
    }

    const err = res.error;
    if (err.code === "VALIDATION") {
      setErrors({ identifier: err.fields?.identifier, password: err.fields?.password });
      return;
    }
    if (err.code === "LOCKED") setLockUntil(Date.now() + err.retryAfter * 1000);
    setFormError({ code: err.code, tone: err.code === "LOCKED" ? "warning" : "error", title: err.message });
  }

  function renderFormError() {
    if (!formError) return null;
    if (formError.code === "LOCKED") {
      return (
        <FormAlert tone="warning" title="Terlalu banyak percobaan gagal">
          Demi keamanan, login dikunci sementara. Coba lagi dalam <b>{formatCountdown(lockLeft)}</b>.
        </FormAlert>
      );
    }
    if (formError.code === "ROLE_UNSUPPORTED") {
      return <FormAlert title={formError.title}>Akun mentor belum memiliki tampilan di aplikasi web.</FormAlert>;
    }
    return <FormAlert tone={formError.tone} title={formError.title}>{formError.text}</FormAlert>;
  }

  return (
    <AuthShell aside={ASIDE} topLink={{ text: "Belum punya akun?", label: "Daftar", href: "/choose-type" }}>
      <h1 className="au-title">Masuk ke akunmu</h1>
      <p className="au-sub">Senang melihatmu lagi. Masuk dengan email atau nomor WhatsApp yang kamu daftarkan.</p>

      <form className="au-form" onSubmit={handleSubmit} noValidate>
        {renderFormError()}

        <div className="field">
          <label htmlFor="login-identifier">Email atau nomor WhatsApp</label>
          <input
            ref={identifierRef} id="login-identifier" name="identifier" type="text" className="input au-input"
            placeholder="nama@email.com atau 0812…" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={identifier} onChange={(e) => changeIdentifier(e.target.value)}
            aria-invalid={!!errors.identifier || undefined} aria-describedby={errors.identifier ? "login-identifier-err" : undefined}
          />
          <FieldError id="login-identifier-err" message={errors.identifier} />
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

        {USE_MOCK && demoAccounts.length > 0 && (
          <p className="au-demo-hint">
            Mode demo — isi akun:{" "}
            {demoAccounts.map((a, i) => (
              <span key={a.role}>
                {i > 0 && " · "}
                <button type="button" className="link-btn" onClick={() => fillDemo(a)}>
                  {ROLES[ROLE_FROM_BACKEND[a.role]]?.label || a.role}
                </button>
              </span>
            ))}
          </p>
        )}
      </form>

      <p className="au-switch">
        Belum punya akun? <Link href="/choose-type" className="link-btn">Daftar gratis</Link>
      </p>
    </AuthShell>
  );
}
