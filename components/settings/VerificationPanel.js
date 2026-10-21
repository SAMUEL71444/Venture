"use client";

import { useState } from "react";
import SettingsCard from "./SettingsCard";
import Icon from "@/components/Icon";
import { PLATFORM_USERS } from "@/lib/users.mock";

const STATUS = {
  belum: { label: "Belum Diverifikasi", cls: "badge-neutral" },
  pending: { label: "Menunggu Tinjauan", cls: "badge-warning" },
  terverifikasi: { label: "Terverifikasi", cls: "badge-success" },
};

// User yang "sedang login" per role -> id di PLATFORM_USERS, supaya status di
// sini sama dengan yang dilihat Verify & Trust di /verifications. Akun
// internal (trust) selalu terverifikasi.
const PLATFORM_ID = { mahasiswa: "u-s1", umkm: "u-c3" };

export default function VerificationPanel({ config, showToast }) {
  const initial = PLATFORM_USERS.find((u) => u.id === PLATFORM_ID[config.key])?.verification || "terverifikasi";
  const [status, setStatus] = useState(initial);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState({});
  const docs = config.settings.verificationDocs;
  const s = STATUS[status];
  const ready = docs.length > 0 && docs.every((d) => files[d]);

  function submit() {
    setStatus("pending");
    setOpen(false);
    showToast("Dokumen terkirim. Tim Verify & Trust akan meninjau dalam 1×24 jam.");
  }

  return (
    <SettingsCard title="Verifikasi Identitas">
      <div className="row gap-8 mt-12">
        <span className={`badge ${s.cls}`}>{s.label}</span>
      </div>

      {status === "belum" && !open && (
        <>
          <p className="t-small muted mt-12">Verifikasi membantu membangun kepercayaan dan membuka fitur penuh di Digital.in.</p>
          <button type="button" className="btn btn-primary btn-sm mt-12" onClick={() => setOpen(true)}>Verifikasi Identitas Anda</button>
        </>
      )}
      {status === "pending" && <p className="t-small muted mt-12">Dokumenmu sedang ditinjau. Biasanya selesai dalam 1×24 jam.</p>}
      {status === "terverifikasi" && <p className="t-small muted mt-12">Identitasmu sudah terverifikasi. Tidak ada tindakan yang diperlukan.</p>}

      {open && (
        <div className="mt-16">
          {docs.map((d) => (
            <div key={d} className="field">
              <label>Unggah {d}</label>
              <label className="card settings-upload" style={{ borderStyle: "dashed", padding: 24, textAlign: "center", cursor: "pointer", display: "block" }}>
                <Icon name="paperclip" />
                <div className="t-small mt-8">{files[d] ? files[d] : <>Seret file ke sini atau <span className="link-btn">pilih file</span></>}</div>
                <div className="t-caption mt-4">JPG, PNG, atau PDF — maks 5MB</div>
                <input
                  type="file" accept="image/*,.pdf" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles((p) => ({ ...p, [d]: f.name })); }}
                />
              </label>
            </div>
          ))}
          <div className="row gap-8">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Batal</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!ready} onClick={submit}>Kirim untuk Verifikasi</button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
