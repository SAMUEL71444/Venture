"use client";

// Potongan kecil yang dipakai bersama halaman Login, Daftar, dan Verifikasi
// Email: pesan error per field, banner pesan form, tombol submit dengan
// loading, hook countdown, dan langkah pendaftaran.
import { useEffect, useState } from "react";
import { IconAlert, IconLoader, IconCircleCheck, IconClock } from "./AuthIcons";

// Pesan error di bawah field — id-nya dipasang ke aria-describedby input.
export function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="au-error">
      <IconAlert size={14} /> <span>{message}</span>
    </p>
  );
}

// Banner pesan tingkat form. tone: "error" | "warning" | "success" | "info".
export function FormAlert({ tone = "error", title, children, action }) {
  const Icon = tone === "success" ? IconCircleCheck : tone === "warning" ? IconClock : IconAlert;
  return (
    <div className={`au-alert ${tone}`} role={tone === "error" || tone === "warning" ? "alert" : "status"}>
      <Icon size={18} className="au-alert-icon" />
      <div className="au-alert-body">
        {title && <div className="au-alert-title">{title}</div>}
        {children && <div className="au-alert-text">{children}</div>}
        {action && <div className="au-alert-action">{action}</div>}
      </div>
    </div>
  );
}

export function SubmitButton({ loading, disabled, children, loadingText = "Memproses…" }) {
  return (
    <button type="submit" className="btn btn-primary btn-block btn-lg au-submit" disabled={loading || disabled} aria-busy={loading || undefined}>
      {loading ? <><IconLoader size={18} className="au-spin" /> {loadingText}</> : children}
    </button>
  );
}

// Sisa detik sampai `until` (timestamp ms). Dihitung LANGSUNG saat render —
// bukan disimpan di state — supaya pada render yang sama dengan `until` baru,
// nilainya sudah benar (kalau lewat state, sesaat bernilai 0 dan pemanggil
// mengira kunci sudah berakhir). State `tick` hanya memicu render ulang.
export function useCountdown(until) {
  const [, setTick] = useState(0);
  const left = until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0;
  useEffect(() => {
    if (!until) return undefined;
    const t = setInterval(() => {
      setTick((n) => n + 1);
      if (Date.now() >= until) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [until]);
  return left;
}

// Langkah pendaftaran: Verifikasi kontak (OTP email/WhatsApp) → Lengkapi data
// → Verifikasi identitas (halaman /verify yang sudah ada). `current` = indeks 0-based.
const STEPS = ["Verifikasi kontak", "Lengkapi data", "Verifikasi identitas"];
export function SignupSteps({ current }) {
  return (
    <ol className="au-steps" aria-label={`Langkah ${current + 1} dari ${STEPS.length}`}>
      {STEPS.map((label, i) => (
        <li key={label} className={i < current ? "done" : i === current ? "active" : ""} aria-current={i === current ? "step" : undefined}>
          <span className="au-steps-bar" />
          <span className="au-steps-label">{label}</span>
        </li>
      ))}
    </ol>
  );
}
