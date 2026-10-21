"use client";

import "../auth.css";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import OtpInput from "@/components/auth/OtpInput";
import { FormAlert, SubmitButton, SignupSteps, useCountdown } from "@/components/auth/AuthParts";
import { IconShieldCheck, IconRefresh, IconMail, IconMessage } from "@/components/auth/AuthIcons";
import {
  OTP_LENGTH, validateOtp, validateIdentifier, displayIdentifier, formatCountdown,
} from "@/lib/auth/validation";
import { sendOtp, verifyOtp, demoOutbox, USE_MOCK } from "@/lib/auth/api";
import { readPending, savePending, saveProof } from "@/lib/auth/signup-flow";

// Verifikasi kontak (email ATAU WhatsApp) dengan kode OTP 6 digit — bagian
// dari langkah 1 pendaftaran. Kode sudah dikirim dari halaman Daftar; kode
// benar → verification_token disimpan di sessionStorage → lanjut isi data akun.
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}

const ASIDE = {
  title: "Satu langkah untuk mengamankan akunmu.",
  text: "Verifikasi kontak memastikan hanya kamu yang bisa masuk dan menerima kabar penting.",
  points: [
    "Kode pemulihan password dikirim ke kontak ini",
    "Notifikasi proyek & pencairan escrow sampai ke orang yang tepat",
    "Mencegah akun palsu memakai email atau nomor orang lain",
  ],
};

const emptyDigits = () => Array(OTP_LENGTH).fill("");

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type") === "mahasiswa" ? "mahasiswa" : "umkm";
  const channel = searchParams.get("channel") === "whatsapp" ? "whatsapp" : "email";
  const identifier = (searchParams.get("identifier") || "").trim();
  const valid = !!identifier && !validateIdentifier(channel, identifier);
  const isEmail = channel === "email";
  const shown = displayIdentifier(channel, identifier);
  const backHref = `/register?${new URLSearchParams({ type, channel, identifier })}`;

  const [ready, setReady] = useState(false);
  const [digits, setDigits] = useState(emptyDigits);
  const [codeError, setCodeError] = useState(null);
  const [notice, setNotice] = useState(null); // { tone, title, text }
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendUntil, setResendUntil] = useState(null);
  const [waitUntil, setWaitUntil] = useState(null); // rate limit (429)
  const [expiresAt, setExpiresAt] = useState(null);
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const [verified, setVerified] = useState(false);
  const [demoCode, setDemoCode] = useState(null);
  const busy = useRef(false);
  const otpRef = useRef(null);

  const resendLeft = useCountdown(resendUntil);
  const waitLeft = useCountdown(waitUntil);
  const expiresLeft = useCountdown(expiresAt);
  const waiting = waitLeft > 0;

  const refreshDemo = useCallback(() => setDemoCode(demoOutbox(channel, identifier)?.code || null), [channel, identifier]);

  // Status kirim ulang dibaca dari sessionStorage setelah mount. Tanpa data
  // (mis. tab baru), kode dianggap mungkin masih aktif — backend yang menilai.
  useEffect(() => {
    if (!valid) return;
    const pending = readPending({ channel, identifier });
    if (pending) {
      setResendUntil(pending.resendAt > Date.now() ? pending.resendAt : null);
      setExpiresAt(pending.expiresAt && pending.expiresAt > Date.now() ? pending.expiresAt : null);
    }
    refreshDemo();
    setReady(true);
  }, [valid, channel, identifier, refreshDemo]);

  useEffect(() => {
    if (ready) otpRef.current?.focus(0);
  }, [ready]);

  useEffect(() => {
    if (waitUntil && waitLeft === 0) {
      setWaitUntil(null);
      setNotice(null);
    }
  }, [waitLeft, waitUntil]);

  function resetCode(focus = true) {
    setDigits(emptyDigits());
    if (focus) setTimeout(() => otpRef.current?.focus(0), 0);
  }

  async function submit(code) {
    if (busy.current || waiting || needsNewCode || verified) return;
    const v = validateOtp(code);
    if (v) {
      setCodeError(v);
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setCodeError(null);
    setNotice(null);
    const res = await verifyOtp({ purpose: "register", channel, identifier, code });
    busy.current = false;
    setSubmitting(false);

    if (res.ok) {
      saveProof({ type, channel, identifier, token: res.data.token, expiresAt: Date.now() + res.data.expiresIn * 1000 });
      setVerified(true);
      router.push(`/register?type=${type}&step=data`);
      return;
    }
    const err = res.error;
    switch (err.code) {
      case "OTP_INVALID":
        setCodeError(`${err.message}. Sisa percobaan: ${err.attemptsLeft}`);
        resetCode();
        break;
      case "OTP_EXPIRED":
      case "OTP_LOCKED":
        setCodeError(err.message);
        setNeedsNewCode(true);
        setExpiresAt(null);
        resetCode(false);
        break;
      case "RATE_LIMITED":
        setWaitUntil(Date.now() + err.retryAfter * 1000);
        setNotice({ tone: "warning", title: err.message });
        resetCode(false);
        break;
      default:
        setNotice({ tone: "error", title: err.message });
    }
  }

  async function resend() {
    if (resending || resendLeft > 0 || waiting) return;
    setResending(true);
    setNotice(null);
    const res = await sendOtp({ purpose: "register", channel, identifier });
    setResending(false);
    if (res.ok) {
      const resendAt = Date.now() + res.data.resendAfter * 1000;
      savePending({ type, channel, identifier, expiresAt: res.data.expiresAt, resendAt });
      setResendUntil(resendAt);
      setExpiresAt(res.data.expiresAt);
      setNeedsNewCode(false);
      setCodeError(null);
      refreshDemo();
      resetCode();
      setNotice({ tone: "success", title: "Kode baru sudah dikirim", text: isEmail ? `Cek kotak masuk ${shown}.` : `Cek WhatsApp di ${shown}.` });
      return;
    }
    const err = res.error;
    if (err.code === "OTP_COOLDOWN") setResendUntil(Date.now() + err.retryAfter * 1000);
    else if (err.code === "RATE_LIMITED") setWaitUntil(Date.now() + err.retryAfter * 1000);
    setNotice({ tone: err.code === "IDENTIFIER_TAKEN" ? "error" : "warning", title: err.code === "IDENTIFIER_TAKEN" ? "Kontak ini sudah terdaftar, silakan masuk" : err.message });
  }

  if (!valid) {
    return (
      <AuthShell aside={ASIDE} topLink={{ text: "Sudah punya akun?", label: "Masuk", href: "/login" }}>
        <h1 className="au-title">Verifikasi kontak</h1>
        <FormAlert title="Tautan verifikasi tidak lengkap" action={<Link href="/choose-type" className="btn btn-secondary btn-sm">Daftar akun</Link>}>
          Buka halaman ini dari proses pendaftaran.
        </FormAlert>
      </AuthShell>
    );
  }

  const code = digits.join("");
  const resendLabel = resending
    ? "Mengirim…"
    : resendLeft > 0 ? `Kirim ulang kode (${formatCountdown(resendLeft)})` : "Kirim ulang kode";

  return (
    <AuthShell aside={ASIDE} topLink={{ text: isEmail ? "Salah email?" : "Salah nomor?", label: "Ubah", href: backHref }}>
      <SignupSteps current={0} />
      <span className="au-badge-icon">{isEmail ? <IconMail size={22} /> : <IconMessage size={22} />}</span>
      <h1 className="au-title">{isEmail ? "Cek emailmu" : "Cek WhatsApp-mu"}</h1>
      <p className="au-sub">
        Kami mengirim kode {OTP_LENGTH} digit {isEmail ? "ke" : "lewat WhatsApp ke"} <b className="au-email">{shown}</b>. Masukkan kodenya di bawah.
      </p>

      <div className="au-why">
        <IconShieldCheck size={18} />
        <p>
          <b>Kenapa perlu verifikasi?</b> Supaya kami yakin {isEmail ? "email" : "nomor"} ini benar milikmu — melindungi akunmu dari
          penyalahgunaan dan memastikan kode pemulihan, notifikasi proyek, serta info pembayaran escrow sampai ke kamu.
        </p>
      </div>

      {USE_MOCK && demoCode && (
        <div className="au-demo">
          <span className="au-demo-tag">Mode demo</span>
          <span>Backend tiruan aktif — kode untuk kontak ini: <b className="au-demo-code">{demoCode}</b></span>
        </div>
      )}

      <form className="au-form" onSubmit={(e) => { e.preventDefault(); submit(code); }} noValidate>
        {notice && <FormAlert tone={notice.tone} title={notice.title}>{notice.text}</FormAlert>}
        {waiting && <p className="au-hint au-hint-left">Coba lagi dalam <b>{formatCountdown(waitLeft)}</b>.</p>}

        <div className="field">
          <span className="au-label" id="otp-label">Kode verifikasi</span>
          <OtpInput
            ref={otpRef}
            value={digits}
            onChange={(d) => { setDigits(d); if (codeError && !needsNewCode) setCodeError(null); }}
            onComplete={(c) => submit(c)}
            disabled={!ready || waiting || submitting || needsNewCode || verified}
            invalid={!!codeError}
            labelledBy="otp-label"
            describedBy={codeError ? "otp-err" : "otp-hint"}
          />
          {codeError ? (
            <p id="otp-err" className="au-error">
              <span>{codeError}</span>
              {needsNewCode && resendLeft === 0 && !waiting && (
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

        <SubmitButton loading={submitting || verified} disabled={waiting || needsNewCode || code.length < OTP_LENGTH} loadingText={verified ? "Kontak terverifikasi…" : "Memverifikasi…"}>
          Verifikasi
        </SubmitButton>

        <div className="au-resend">
          <span>Tidak menerima kode?</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resend} disabled={resending || resendLeft > 0 || waiting}>
            <IconRefresh size={15} /> {resendLabel}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
