"use client";

import "../auth.css";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { ROLES } from "@/config/roles";
import AuthShell from "@/components/auth/AuthShell";
import OtpInput from "@/components/auth/OtpInput";
import { FormAlert, SubmitButton, SignupSteps, useCountdown } from "@/components/auth/AuthParts";
import { IconShieldCheck, IconCircleCheck, IconRefresh, IconLoader, IconMail } from "@/components/auth/AuthIcons";
import { OTP_LENGTH, validateOtp } from "@/lib/auth/validation";
import { getVerificationStatus, verifyOtp, resendOtp, formatCountdown, demoOutbox, USE_MOCK } from "@/lib/auth/api";

// Verifikasi email dengan kode OTP 6 digit — langkah 2 pendaftaran. Dibuka
// dari halaman Daftar (setelah akun dibuat, status belum terverifikasi) atau
// dari Login ("Akun belum diverifikasi" → kirim ulang kode). Berhasil →
// langsung masuk lalu lanjut ke verifikasi identitas (/verify, yang sudah ada).
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

const ASIDE = {
  title: "Satu langkah lagi untuk mengamankan akunmu.",
  text: "Verifikasi email memastikan hanya kamu yang bisa masuk dan menerima kabar penting.",
  points: [
    "Kode pemulihan password dikirim ke email ini",
    "Notifikasi proyek & pencairan escrow sampai ke orang yang tepat",
    "Mencegah akun palsu memakai email orang lain",
  ],
};

const emptyDigits = () => Array(OTP_LENGTH).fill("");
const REDIRECT_DELAY = 1800;

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setRole } = useRole();
  const email = (searchParams.get("email") || "").trim();

  // "loading" | "ready" | "verified" (sukses di sini) | "already" | "notfound" | "missing" | "error"
  const [view, setView] = useState(email ? "loading" : "missing");
  const [accountRole, setAccountRole] = useState(null);
  const [digits, setDigits] = useState(emptyDigits);
  const [codeError, setCodeError] = useState(null);
  const [notice, setNotice] = useState(null); // { tone, title, text, action? }
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendUntil, setResendUntil] = useState(null);
  const [lockUntil, setLockUntil] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const [demoCode, setDemoCode] = useState(null);
  const busy = useRef(false);
  const otpRef = useRef(null);

  const resendLeft = useCountdown(resendUntil);
  const lockLeft = useCountdown(lockUntil);
  const expiresLeft = useCountdown(expiresAt);
  const locked = lockLeft > 0;

  const refreshDemo = useCallback(() => setDemoCode(demoOutbox(email)?.code || null), [email]);

  const applyStatus = useCallback((s) => {
    const t = Date.now();
    setResendUntil(s.resendIn ? t + s.resendIn * 1000 : null);
    setLockUntil(s.lockedFor ? t + s.lockedFor * 1000 : null);
    setExpiresAt(s.expiresIn ? t + s.expiresIn * 1000 : null);
    setNeedsNewCode(!s.hasCode || !s.expiresIn);
  }, []);

  const load = useCallback(async () => {
    setView("loading");
    const res = await getVerificationStatus({ email });
    if (!res.ok) {
      setView(res.error.code === "NOT_FOUND" ? "notfound" : "error");
      return;
    }
    setAccountRole(res.data.role);
    if (res.data.verified) {
      setView("already");
      return;
    }
    applyStatus(res.data);
    refreshDemo();
    setView("ready");
  }, [email, applyStatus, refreshDemo]);

  useEffect(() => {
    if (email) load();
  }, [email, load]);

  useEffect(() => {
    if (view === "ready") otpRef.current?.focus(0);
  }, [view]);

  // Blokir selesai → kode lama sudah hangus, minta kirim ulang.
  useEffect(() => {
    if (lockUntil && lockLeft === 0) {
      setLockUntil(null);
      setNeedsNewCode(true);
      setNotice({ tone: "info", title: "Blokir sudah berakhir", text: "Kirim ulang kode untuk mendapatkan kode baru." });
    }
  }, [lockLeft, lockUntil]);

  // Setelah verifikasi: masuk dengan role akun, lalu ke verifikasi identitas
  // (/verify) untuk UMKM/mahasiswa, atau langsung ke beranda role lain.
  const nextHref = accountRole === "umkm" || accountRole === "mahasiswa" ? `/verify?type=${accountRole}` : ROLES[accountRole]?.home || "/login";
  const goNext = useCallback(() => {
    if (accountRole) setRole(accountRole);
    router.push(nextHref);
  }, [accountRole, nextHref, router, setRole]);

  useEffect(() => {
    if (view !== "verified") return undefined;
    const t = setTimeout(goNext, REDIRECT_DELAY);
    return () => clearTimeout(t);
  }, [view, goNext]);

  function resetCode(focus = true) {
    setDigits(emptyDigits());
    if (focus) setTimeout(() => otpRef.current?.focus(0), 0);
  }

  async function submit(code) {
    if (busy.current || locked || needsNewCode) return;
    const v = validateOtp(code);
    if (v) {
      setCodeError(v);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setCodeError(null);
    setNotice(null);
    const res = await verifyOtp({ email, code });
    busy.current = false;
    setSubmitting(false);

    if (res.ok) {
      setAccountRole(res.data.user.role);
      setView("verified");
      return;
    }
    const err = res.error;
    switch (err.code) {
      case "OTP_INVALID":
        setCodeError(`${err.message}. Sisa percobaan: ${err.attemptsLeft}`);
        resetCode();
        break;
      case "OTP_EXPIRED":
        setCodeError(err.message);
        setNeedsNewCode(true);
        setExpiresAt(null);
        resetCode(false);
        break;
      case "OTP_LOCKED":
        setLockUntil(Date.now() + err.retryAfter * 1000);
        setCodeError(null);
        setNeedsNewCode(true);
        resetCode(false);
        break;
      case "VALIDATION":
        setCodeError(err.fields?.code || err.message);
        break;
      case "ALREADY_VERIFIED":
        setView("already");
        break;
      default:
        setNotice({ tone: "error", title: err.message });
    }
  }

  async function resend() {
    if (resending || resendLeft > 0 || locked) return;
    setResending(true);
    setNotice(null);
    const res = await resendOtp({ email });
    setResending(false);
    if (res.ok) {
      applyStatus(res.data);
      refreshDemo();
      setCodeError(null);
      resetCode();
      setNotice({ tone: "success", title: "Kode baru sudah dikirim", text: `Cek kotak masuk ${email}. Kode berlaku 10 menit.` });
      return;
    }
    const err = res.error;
    if (err.code === "OTP_COOLDOWN") setResendUntil(Date.now() + err.retryAfter * 1000);
    else if (err.code === "OTP_LOCKED") setLockUntil(Date.now() + err.retryAfter * 1000);
    else if (err.code === "ALREADY_VERIFIED") return setView("already");
    setNotice({ tone: "error", title: err.message });
  }

  // --- tampilan non-form ---------------------------------------------------
  if (view !== "ready" && view !== "verified") {
    return (
      <AuthShell aside={ASIDE} topLink={{ text: "Sudah terverifikasi?", label: "Masuk", href: "/login" }}>
        <h1 className="au-title">Verifikasi email</h1>
        {view === "loading" && (
          <p className="au-sub au-loading-line"><IconLoader size={16} className="au-spin" /> Memuat status verifikasi…</p>
        )}
        {view === "missing" && (
          <FormAlert title="Tautan verifikasi tidak lengkap" action={<Link href="/choose-type" className="btn btn-secondary btn-sm">Daftar akun</Link>}>
            Buka halaman ini dari proses pendaftaran atau dari halaman Masuk.
          </FormAlert>
        )}
        {view === "notfound" && (
          <FormAlert title="Akun untuk email ini tidak ditemukan" action={<Link href="/choose-type" className="btn btn-secondary btn-sm">Daftar akun</Link>}>
            Periksa kembali emailnya atau daftar akun baru.
          </FormAlert>
        )}
        {view === "already" && (
          <FormAlert tone="success" title="Email ini sudah terverifikasi" action={<Link href="/login" className="btn btn-primary btn-sm">Masuk sekarang</Link>}>
            Kamu bisa langsung masuk dengan email dan password-mu.
          </FormAlert>
        )}
        {view === "error" && (
          <FormAlert title="Tidak dapat terhubung ke server, coba lagi" action={<button type="button" className="btn btn-secondary btn-sm" onClick={load}>Coba lagi</button>} />
        )}
      </AuthShell>
    );
  }

  if (view === "verified") {
    return (
      <AuthShell aside={ASIDE}>
        <div className="au-success" role="status">
          <span className="au-success-icon"><IconCircleCheck size={40} /></span>
          <h1 className="au-title">Email berhasil diverifikasi!</h1>
          <p className="au-sub">
            Akunmu sudah aktif. {nextHref.startsWith("/verify") ? "Mengarahkan ke verifikasi identitas…" : "Mengarahkan ke dashboard…"}
          </p>
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={goNext}>Lanjutkan sekarang</button>
        </div>
      </AuthShell>
    );
  }

  const code = digits.join("");
  const resendLabel = resending
    ? "Mengirim…"
    : resendLeft > 0 ? `Kirim ulang kode (${formatCountdown(resendLeft)})` : "Kirim ulang kode";

  return (
    <AuthShell aside={ASIDE} topLink={{ text: "Salah email?", label: "Daftar ulang", href: "/choose-type" }}>
      {(accountRole === "umkm" || accountRole === "mahasiswa") && <SignupSteps current={1} />}
      <span className="au-badge-icon"><IconMail size={22} /></span>
      <h1 className="au-title">Cek emailmu</h1>
      <p className="au-sub">
        Kami mengirim kode {OTP_LENGTH} digit ke <b className="au-email">{email}</b>. Masukkan kodenya di bawah.
      </p>

      <div className="au-why">
        <IconShieldCheck size={18} />
        <p>
          <b>Kenapa perlu verifikasi?</b> Supaya kami yakin email ini benar milikmu — melindungi akunmu dari
          penyalahgunaan dan memastikan kode pemulihan, notifikasi proyek, serta info pembayaran escrow sampai ke kamu.
        </p>
      </div>

      {USE_MOCK && demoCode && (
        <div className="au-demo">
          <span className="au-demo-tag">Mode demo</span>
          <span>Belum ada layanan email — kode untuk akun ini: <b className="au-demo-code">{demoCode}</b></span>
        </div>
      )}

      <form className="au-form" onSubmit={(e) => { e.preventDefault(); submit(code); }} noValidate>
        {locked && (
          <FormAlert tone="warning" title="Terlalu banyak percobaan salah">
            Verifikasi diblokir sementara. Coba lagi dalam <b>{formatCountdown(lockLeft)}</b>, lalu minta kode baru.
          </FormAlert>
        )}
        {!locked && notice && <FormAlert tone={notice.tone} title={notice.title}>{notice.text}</FormAlert>}

        <div className="field">
          <span className="au-label" id="otp-label">Kode verifikasi</span>
          <OtpInput
            ref={otpRef}
            value={digits}
            onChange={(d) => { setDigits(d); if (codeError && !needsNewCode) setCodeError(null); }}
            onComplete={(c) => submit(c)}
            disabled={locked || submitting || needsNewCode}
            invalid={!!codeError}
            labelledBy="otp-label"
            describedBy={codeError ? "otp-err" : "otp-hint"}
          />
          {codeError ? (
            <p id="otp-err" className="au-error">
              <span>{codeError}</span>
              {needsNewCode && !locked && resendLeft === 0 && (
                <> · <button type="button" className="au-error-link" onClick={resend}>Kirim ulang kode</button></>
              )}
            </p>
          ) : (
            <p id="otp-hint" className="au-hint au-hint-left">
              {needsNewCode
                ? "Belum ada kode yang aktif. Tekan “Kirim ulang kode” untuk mendapatkan kode baru."
                : expiresLeft > 0 ? `Kode berlaku ${formatCountdown(expiresLeft)} lagi. Bisa juga tempel (paste) 6 digit sekaligus.` : "Bisa juga tempel (paste) 6 digit sekaligus."}
            </p>
          )}
        </div>

        <SubmitButton loading={submitting} disabled={locked || needsNewCode || code.length < OTP_LENGTH} loadingText="Memverifikasi…">
          Verifikasi
        </SubmitButton>

        <div className="au-resend">
          <span>Tidak menerima kode?</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resend} disabled={resending || resendLeft > 0 || locked}>
            <IconRefresh size={15} /> {resendLabel}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
