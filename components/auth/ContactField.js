"use client";

// Pilih kanal OTP (Email / WhatsApp) + isian kontaknya. Dipakai halaman Daftar
// (langkah verifikasi kontak) dan Lupa Password (langkah 1).
import { IconAlert, IconMail, IconMessage } from "./AuthIcons";

const CHANNELS = [
  { id: "email", label: "Email", Icon: IconMail },
  { id: "whatsapp", label: "WhatsApp", Icon: IconMessage },
];

export default function ContactField({
  idPrefix, channel, onChannelChange, value, onChange, onBlur, error, errorAction, inputRef, emailPlaceholder = "nama@email.com",
}) {
  const isEmail = channel === "email";
  const inputId = `${idPrefix}-identifier`;

  // Panah kiri/kanan berpindah pilihan (pola radiogroup).
  function onKeyDown(e) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = channel === "email" ? "whatsapp" : "email";
    onChannelChange(next);
    e.currentTarget.parentElement.querySelector(`[data-channel="${next}"]`)?.focus();
  }

  return (
    <>
      <div className="field">
        <span className="au-label" id={`${idPrefix}-channel-label`}>Kirim kode verifikasi lewat</span>
        <div className="au-roles au-channels" role="radiogroup" aria-labelledby={`${idPrefix}-channel-label`}>
          {CHANNELS.map(({ id, label, Icon }) => (
            <button
              key={id} type="button" role="radio" data-channel={id} aria-checked={channel === id}
              tabIndex={channel === id ? 0 : -1}
              className={`au-role ${channel === id ? "selected" : ""}`}
              onClick={() => onChannelChange(id)} onKeyDown={onKeyDown}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor={inputId}>{isEmail ? "Email" : "Nomor WhatsApp"}</label>
        <input
          ref={inputRef} id={inputId} name={inputId} className="input au-input"
          type={isEmail ? "email" : "tel"} inputMode={isEmail ? "email" : "tel"} autoComplete={isEmail ? "email" : "tel"}
          placeholder={isEmail ? emailPlaceholder : "0812 3456 7890"}
          value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          aria-invalid={!!error || undefined} aria-describedby={error ? `${inputId}-err` : `${inputId}-hint`}
        />
        {error ? (
          <p id={`${inputId}-err`} className="au-error">
            <IconAlert size={14} /> <span>{error}</span>
            {errorAction && <> · {errorAction}</>}
          </p>
        ) : (
          <p id={`${inputId}-hint`} className="au-hint au-hint-left">
            {isEmail ? "Kode 6 digit dikirim ke email ini." : "Kode 6 digit dikirim lewat WhatsApp. Boleh diawali 08 atau +62."}
          </p>
        )}
      </div>
    </>
  );
}
