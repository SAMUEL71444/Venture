"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { OTP_LENGTH } from "@/lib/auth/validation";

// Input OTP 6 kotak. `value` = array 6 string (satu digit atau ""), `onChange`
// menerima array baru, `onComplete(code)` dipanggil begitu ke-6 kotak terisi.
// - ketik digit → fokus pindah ke kotak berikutnya
// - Backspace di kotak kosong → kembali & hapus kotak sebelumnya
// - ←/→ berpindah kotak
// - paste 6 digit (atau autofill "one-time-code" di HP) → terisi sekaligus
// Ref: { focus(index = 0) } untuk mengembalikan fokus setelah kode salah.
const OtpInput = forwardRef(function OtpInput({ value, onChange, onComplete, disabled, invalid, labelledBy, describedBy }, ref) {
  const inputs = useRef([]);

  useImperativeHandle(ref, () => ({
    focus: (i = 0) => inputs.current[i]?.focus(),
  }));

  function commit(next, focusIndex) {
    onChange(next);
    if (focusIndex != null) inputs.current[Math.min(focusIndex, OTP_LENGTH - 1)]?.focus();
    if (next.every((d) => d !== "")) onComplete?.(next.join(""));
  }

  // Isi beberapa digit mulai dari `start` (paste / autofill).
  function fill(start, digits) {
    const next = [...value];
    const from = digits.length >= OTP_LENGTH ? 0 : start;
    digits.slice(0, OTP_LENGTH - from).split("").forEach((d, k) => { next[from + k] = d; });
    const firstEmpty = next.findIndex((d) => d === "");
    commit(next, firstEmpty === -1 ? OTP_LENGTH - 1 : firstEmpty);
  }

  function handleChange(i, e) {
    if (disabled) return;
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      const next = [...value];
      next[i] = "";
      onChange(next);
      return;
    }
    if (digits.length > 1) return fill(i, digits);
    const next = [...value];
    next[i] = digits;
    commit(next, i + 1);
  }

  function handleKeyDown(i, e) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      e.preventDefault();
      const next = [...value];
      next[i - 1] = "";
      onChange(next);
      inputs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      e.preventDefault();
      inputs.current[i + 1]?.focus();
    }
  }

  function handlePaste(i, e) {
    if (disabled) return;
    const digits = (e.clipboardData.getData("text") || "").replace(/\D/g, "");
    e.preventDefault();
    if (digits) fill(i, digits);
  }

  return (
    <div className={`au-otp ${invalid ? "invalid" : ""}`} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {Array.from({ length: OTP_LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          className="au-otp-box"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1} dari ${OTP_LENGTH}`}
          aria-invalid={invalid || undefined}
          value={value[i] || ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
});

export default OtpInput;
