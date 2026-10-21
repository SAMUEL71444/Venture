"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";

// Dialog konfirmasi untuk tindakan admin yang mengubah data. Mencegah klik
// ganda (tombol terkunci selama onConfirm berjalan), alasan opsional/wajib,
// dan menampilkan galat dari server tanpa menutup dialog.
// onConfirm(reason) → Promise<{ ok, error? }>
export default function ConfirmDialog({
  open, onClose, title, children, confirmLabel = "Konfirmasi", danger = false,
  reason = "none", // "none" | "optional" | "required"
  reasonLabel = "Alasan", reasonPlaceholder = "", onConfirm,
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setText("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const missingReason = reason === "required" && !text.trim();

  async function confirm() {
    if (busy || missingReason) return;
    setBusy(true);
    setError(null);
    const res = await onConfirm(text.trim());
    setBusy(false);
    if (res?.ok === false) setError(res.error?.message || "Tindakan gagal");
  }

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={title} width={480}>
      <div className="t-body">{children}</div>

      {reason !== "none" && (
        <div className="mt-16">
          <label className="t-caption mb-4" style={{ display: "block" }} htmlFor="confirm-reason">
            {reasonLabel.toUpperCase()}{reason === "required" ? " (WAJIB)" : " (OPSIONAL)"}
          </label>
          <textarea
            id="confirm-reason" className="input" rows={3} value={text} disabled={busy}
            onChange={(e) => setText(e.target.value)} placeholder={reasonPlaceholder} maxLength={2000}
          />
        </div>
      )}

      {error && <div className="t-small mt-12" role="alert" style={{ color: "var(--error)" }}>{error}</div>}

      <div className="row gap-10 mt-20">
        <button type="button" className="btn btn-secondary btn-block" onClick={onClose} disabled={busy}>Batal</button>
        <button
          type="button" className={`btn btn-block ${danger ? "" : "btn-primary"}`} disabled={busy || missingReason} aria-busy={busy || undefined}
          style={danger ? { background: "var(--error)", color: "#fff" } : undefined}
          onClick={confirm}
        >
          {busy ? "Memproses…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
