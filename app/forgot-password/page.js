"use client";

import "../auth.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import ContactField from "@/components/auth/ContactField";
import OtpInput from "@/components/auth/OtpInput";
import PasswordInput from "@/components/auth/PasswordInput";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { FieldError, FormAlert, SubmitButton, useCountdown } from "@/components/auth/AuthParts";
import { IconArrowLeft, IconLock, IconRefresh } from "@/components/auth/AuthIcons";
import {
  OTP_LENGTH, validateOtp, validateIdentifier, normalizeIdentifier, displayIdentifier,
  validateResetPassword, formatCountdown,
} from "@/lib/auth/validation";
import { sendOtp, verifyOtp, resetPassword, demoOutbox, USE_MOCK } from "@/lib/auth/api";

// Lupa password, 3 langkah dalam satu halaman:
// 1. kontak (email / WhatsApp) → kirim kode (respons selalu sama, terdaftar atau tidak)
// 2. kode OTP → reset_token (berlaku 15 menit, sekali pakai; hanya di memori)
// 3. password baru → semua sesi lama dicabut backend → ke halaman Masuk
const ASIDE = {
  title: "Kembali masuk dengan aman.",
  text: "Atur ulang password lewat kode yang dikirim ke email atau WhatsApp yang terdaftar.",
  points: [
    "Kode hanya berlaku beberapa menit",
    "Setelah password diganti, semua perangkat lain otomatis keluar",
    "Tim Digital.in tidak pernah meminta kode verifikasimu",
  ],
};

const STEP_TITLES = ["Kontak", "Kode", "Password baru"];
const emptyDigits = () => Array(OTP_LENGTH).fill("");

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState("email");
  const [value, setValue] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [resetToken, setResetToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [notice, setNotice] = useState(null);
  const [resendUntil, setResendUntil] = useState(null);
  const [waitUntil, setWaitUntil] = useState(null);

  const waitLeft = useCountdown(waitUntil);

  function rateLimited(retryAfter, title) {
    setWaitUntil(Date.now() + retryAfter * 1000);
    setNotice({ tone: "warning", title });
  }

  function restart(alert) {
    setStep(0);
    setResetToken(null);
    setTokenExpiresAt(null);
    setNotice(alert || null);
  }

  return (
    <AuthShell aside={ASIDE} topLink={{ text: "Ingat password?", label: "Masuk", href: "/login" }}>
      <ol className="au-steps" aria-label={`Langkah ${step + 1} dari ${STEP_TITLES.length}`}>
        {STEP_TITLES.map((label, i) => (
          <li key={label} className={i < step ? "done" : i === step ? "active" : ""} aria-current={i === step ? "step" : undefined}>
            <span className="au-steps-bar" />
            <span className="au-steps-label">{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <RequestStep
          channel={channel} setChannel={setChannel} value={value} setValue={setValue}
          notice={notice} setNotice={setNotice} waitLeft={waitLeft} rateLimited={rateLimited}
          onSent={(id, resendAfter) => {
            setIdentifier(id);
            setResendUntil(Date.now() + resendAfter * 1000);
            setNotice(null);
            setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <CodeStep
          channel={channel} identifier={identifier}
          resendUntil={resendUntil} setResendUntil={setResendUntil}
          waitLeft={waitLeft} rateLimited={rateLimited} notice={notice} setNotice={setNotice}
          onBack={() => restart()}
          onVerified={(token, expiresIn) => {
            setResetToken(token);
            setTokenExpiresAt(Date.now() + expiresIn * 1000);
            setNotice(null);
            setStep(2);
          }}
        />
      )}
      {step === 2 && (
        <PasswordStep
          channel={channel} identifier={identifier} token={resetToken} expiresAt={tokenExpiresAt}
          waitLeft={waitLeft} rateLimited={rateLimited} notice={notice}
          onExpired={(message) => restart({ tone: "warning", title: message })}
          onDone={() => router.push("/login?reason=reset")}
        />
      )}

      <p className="au-switch">
        <Link href="/login" className="link-btn"><IconArrowLeft size={15} /> Kembali ke Masuk</Link>
      </p>
    </AuthShell>
  );
}

function Notice({ notice, waitLeft }) {
  if (!notice) return null;
  return (
    <FormAlert tone={notice.tone} title={notice.title}>
      {notice.text}
      {waitLeft > 0 && notice.tone === "warning" && <>Coba lagi dalam <b>{formatCountdown(waitLeft)}</b>.</>}
    </FormAlert>
  );
}

// --- Langkah 1 -------------------------------------------------------------------
function RequestStep({ channel, setChannel, value, setValue, notice, setNotice, waitLeft, rateLimited, onSent }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || waitLeft > 0) return;
    const err = validateIdentifier(channel, value);
    setError(err);
    setNotice(null);
    if (err) return inputRef.current?.focus();

    const id = normalizeIdentifier(channel, value);
    setLoading(true);
    const res = await sendOtp({ purpose: "reset", channel, identifier: id });
    setLoading(false);
    if (res.ok) return onSent(id, res.data.resendAfter);
    if (res.error.code === "RATE_LIMITED") return rateLimited(res.error.retryAfter, res.error.message);
    if (res.error.code === "VALIDATION") return setError(res.error.fields?.identifier || res.error.message);
    setNotice({ tone: "error", title: res.error.message });
  }

  return (
    <>
      <h1 className="au-title">Lupa password?</h1>
      <p className="au-sub">Masukkan email atau nomor WhatsApp yang terdaftar. Kami akan mengirim kode untuk mengatur ulang password.</p>
      <form className="au-form" onSubmit={handleSubmit} noValidate>
        <Notice notice={notice} waitLeft={waitLeft} />
        <ContactField
          idPrefix="fp" channel={channel}
          onChannelChange={(c) => { if (c !== channel) { setChannel(c); setValue(""); setError(null); } }}
          value={value} onChange={(v) => { setValue(v); if (error) setError(validateIdentifier(channel, v)); }}
          onBlur={() => value && setError(validateIdentifier(channel, value))}
          error={error} inputRef={inputRef}
        />
        <SubmitButton loading={loading} disabled={waitLeft > 0} loadingText="Mengirim kode…">
          {waitLeft > 0 ? `Coba lagi dalam ${formatCountdown(waitLeft)}` : "Kirim kode"}
        </SubmitButton>
      </form>
    </>
  );
}

// --- Langkah 2 -------------------------------------------------------------------
function CodeStep({ channel, identifier, resendUntil, setResendUntil, waitLeft, rateLimited, notice, setNotice, onBack, onVerified }) {
  const [digits, setDigits] = useState(emptyDigits);
  const [codeError, setCodeError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [demoCode, setDemoCode] = useState(null);
  const otpRef = useRef(null);
  const busy = useRef(false);
  const resendLeft = useCountdown(resendUntil);
  const shown = displayIdentifier(channel, identifier);

  useEffect(() => {
    otpRef.current?.focus(0);
    setDemoCode(demoOutbox(channel, identifier)?.code || null);
  }, [channel, identifier]);

  async function submit(code) {
    if (busy.current || waitLeft > 0) return;
    const v = validateOtp(code);
    if (v) return setCodeError(v);
    busy.current = true;
    setSubmitting(true);
    setCodeError(null);
    setNotice(null);
    const res = await verifyOtp({ purpose: "reset", channel, identifier, code });
    busy.current = false;
    setSubmitting(false);
    if (res.ok) return onVerified(res.data.token, res.data.expiresIn);
    setDigits(emptyDigits());
    if (res.error.code === "RATE_LIMITED") return rateLimited(res.error.retryAfter, res.error.message);
    if (res.error.code === "NETWORK" || res.error.code === "UNKNOWN") return setNotice({ tone: "error", title: res.error.message });
    // Pesan sengaja seragam: backend tidak membocorkan sisa percobaan pada reset password.
    setCodeError(`${res.error.message}. Periksa kodenya atau kirim ulang kode.`);
    setTimeout(() => otpRef.current?.focus(0), 0);
  }

  async function resend() {
    if (resending || resendLeft > 0 || waitLeft > 0) return;
    setResending(true);
    setNotice(null);
    const res = await sendOtp({ purpose: "reset", channel, identifier });
    setResending(false);
    if (res.ok) {
      setResendUntil(Date.now() + res.data.resendAfter * 1000);
      setCodeError(null);
      setDigits(emptyDigits());
      setDemoCode(demoOutbox(channel, identifier)?.code || null);
      setNotice({ tone: "success", title: "Permintaan kode baru dikirim" });
      return;
    }
    if (res.error.code === "RATE_LIMITED") return rateLimited(res.error.retryAfter, res.error.message);
    setNotice({ tone: "error", title: res.error.message });
  }

  const code = digits.join("");
  return (
    <>
      <h1 className="au-title">Masukkan kode</h1>
      <p className="au-sub">
        Jika <b className="au-email">{shown}</b> terdaftar, kode {OTP_LENGTH} digit sudah dikirim {channel === "email" ? "ke email tersebut" : "lewat WhatsApp"}.
        {" "}<button type="button" className="link-btn" onClick={onBack}>Ubah kontak</button>
      </p>

      {USE_MOCK && demoCode && (
        <div className="au-demo">
          <span className="au-demo-tag">Mode demo</span>
          <span>Backend tiruan aktif — kode: <b className="au-demo-code">{demoCode}</b></span>
        </div>
      )}

      <form className="au-form" onSubmit={(e) => { e.preventDefault(); submit(code); }} noValidate>
        <Notice notice={notice} waitLeft={waitLeft} />
        <div className="field">
          <span className="au-label" id="fp-otp-label">Kode verifikasi</span>
          <OtpInput
            ref={otpRef} value={digits}
            onChange={(d) => { setDigits(d); if (codeError) setCodeError(null); }}
            onComplete={(c) => submit(c)}
            disabled={submitting || waitLeft > 0}
            invalid={!!codeError} labelledBy="fp-otp-label" describedBy={codeError ? "fp-otp-err" : "fp-otp-hint"}
          />
          {codeError
            ? <p id="fp-otp-err" className="au-error"><span>{codeError}</span></p>
            : <p id="fp-otp-hint" className="au-hint au-hint-left">Bisa juga tempel (paste) 6 digit sekaligus.</p>}
        </div>
        <SubmitButton loading={submitting} disabled={waitLeft > 0 || code.length < OTP_LENGTH} loadingText="Memverifikasi…">
          Lanjutkan
        </SubmitButton>
        <div className="au-resend">
          <span>Tidak menerima kode?</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resend} disabled={resending || resendLeft > 0 || waitLeft > 0}>
            <IconRefresh size={15} /> {resending ? "Mengirim…" : resendLeft > 0 ? `Kirim ulang kode (${formatCountdown(resendLeft)})` : "Kirim ulang kode"}
          </button>
        </div>
      </form>
    </>
  );
}

// --- Langkah 3 -------------------------------------------------------------------
function PasswordStep({ channel, identifier, token, expiresAt, waitLeft, rateLimited, notice, onExpired, onDone }) {
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);
  const wrap = useRef(null);
  const left = useCountdown(expiresAt);

  useEffect(() => { wrap.current?.querySelector("input")?.focus(); }, []);

  useEffect(() => {
    if (expiresAt && left === 0) onExpired("Sesi reset password sudah kedaluwarsa, ulangi dari awal");
  }, [left, expiresAt, onExpired]);

  function change(field, v) {
    const next = { ...values, [field]: v };
    setValues(next);
    setFormError(null);
    if (errors[field] || (field === "password" && errors.confirm)) setErrors(validateResetPassword(next));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || waitLeft > 0) return;
    const errs = validateResetPassword(values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    const res = await resetPassword({ channel, identifier, token, ...values });
    setLoading(false);
    if (res.ok) return onDone();
    const err = res.error;
    if (err.code === "RESET_EXPIRED") return onExpired(err.message);
    if (err.code === "RATE_LIMITED") return rateLimited(err.retryAfter, err.message);
    if (err.code === "VALIDATION") return setErrors({ password: err.fields?.password || err.message });
    if (err.code === "ACCOUNT_SUSPENDED") {
      return setFormError({ title: err.message, text: "Password tidak dapat diubah. Hubungi tim Digital.in untuk bantuan." });
    }
    setFormError({ title: err.message });
  }

  return (
    <>
      <span className="au-badge-icon"><IconLock size={22} /></span>
      <h1 className="au-title">Buat password baru</h1>
      <p className="au-sub">Untuk akun <b className="au-email">{displayIdentifier(channel, identifier)}</b>. Selesaikan dalam {formatCountdown(left)}.</p>
      <form className="au-form" onSubmit={handleSubmit} noValidate ref={wrap}>
        <Notice notice={notice} waitLeft={waitLeft} />
        {formError && <FormAlert title={formError.title}>{formError.text}</FormAlert>}
        <div className="field">
          <label htmlFor="fp-password">Password baru</label>
          <PasswordInput
            id="fp-password" value={values.password} onChange={(e) => change("password", e.target.value)}
            autoComplete="new-password" placeholder="Buat password baru" invalid={!!errors.password}
            describedBy={["fp-password-rules", errors.password && "fp-password-err"].filter(Boolean).join(" ")}
          />
          <FieldError id="fp-password-err" message={errors.password} />
          <PasswordStrength id="fp-password-rules" password={values.password} />
        </div>
        <div className="field">
          <label htmlFor="fp-confirm">Konfirmasi password baru</label>
          <PasswordInput
            id="fp-confirm" value={values.confirm} onChange={(e) => change("confirm", e.target.value)}
            autoComplete="new-password" placeholder="Ketik ulang password" invalid={!!errors.confirm}
            describedBy={errors.confirm ? "fp-confirm-err" : undefined}
          />
          <FieldError id="fp-confirm-err" message={errors.confirm} />
        </div>
        <SubmitButton loading={loading} disabled={waitLeft > 0} loadingText="Menyimpan…">Simpan password baru</SubmitButton>
      </form>
    </>
  );
}
