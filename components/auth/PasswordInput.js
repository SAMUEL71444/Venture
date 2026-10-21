"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { IconEye, IconEyeOff } from "./AuthIcons";

// Field password dengan tombol tampilkan/sembunyikan sendiri (tiap field
// punya state terpisah). Tombolnya type="button" — tidak pernah men-submit
// form. Klik mouse tidak mencuri fokus (onMouseDown preventDefault), dan
// posisi kursor/seleksi dikembalikan setelah tipe input berganti, karena
// sebagian browser mereset seleksi saat type password <-> text.
// Ikon reveal bawaan browser (Edge ::-ms-reveal) disembunyikan di auth.css.
export default function PasswordInput({ id, value, onChange, onBlur, autoComplete, invalid, describedBy, placeholder, disabled }) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef(null);
  const selection = useRef(null);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (el && selection.current && document.activeElement === el) {
      el.setSelectionRange(selection.current[0], selection.current[1]);
    }
    selection.current = null;
  }, [visible]);

  function toggle() {
    const el = inputRef.current;
    if (el && document.activeElement === el) selection.current = [el.selectionStart, el.selectionEnd];
    setVisible((v) => !v);
  }

  return (
    <div className={`au-pass ${invalid ? "invalid" : ""}`}>
      <input
        ref={inputRef}
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        className="input au-input"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        className="au-pass-toggle"
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={visible}
        aria-controls={id}
        disabled={disabled}
      >
        {visible ? <IconEye size={18} /> : <IconEyeOff size={18} />}
      </button>
    </div>
  );
}
