"use client";

import { useState } from "react";
import Link from "next/link";
import SettingsCard from "./SettingsCard";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/Icon";
import { PAYMENT_METHODS, BILLING_ADDRESS, PAYMENT_PREFERENCES } from "@/lib/payments.mock";

// Jenis metode yang bisa ditambah + aturan nomornya (jumlah digit).
const TYPES = {
  va: { label: "Virtual Account", icon: "landmark", min: 10, max: 16, hint: "10–16 digit" },
  kartu: { label: "Kartu Debit/Kredit", icon: "wallet", min: 16, max: 16, hint: "16 digit" },
  ewallet: { label: "E-wallet", icon: "send", min: 9, max: 13, hint: "9–13 digit (nomor HP)" },
};
const digitsOf = (s) => s.replace(/\D/g, "");

// "Tagihan & Pembayaran" UMKM — MENGELOLA konfigurasi (metode tersimpan,
// alamat penagihan, preferensi). Melihat data pengeluaran/escrow/faktur ada
// di halaman sidebar "Pembayaran" (/payments), bukan di sini. Metode awal
// dari PAYMENT_METHODS (lib/payments.mock.js) — sumber yang sama dengan
// label metode di riwayat transaksi — tanpa "Saldo Deposit" karena itu
// bukan metode tersimpan. State lokal (prototipe, belum ada backend).
export default function BillingPanel({ showToast }) {
  const [methods, setMethods] = useState(() => PAYMENT_METHODS.filter((m) => m.type !== "deposit"));
  const [address, setAddress] = useState(BILLING_ADDRESS);
  const [autoRelease, setAutoRelease] = useState(PAYMENT_PREFERENCES.autoRelease);
  const [modal, setModal] = useState(null); // "tambah" | "alamat" | "hapus"
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [target, setTarget] = useState(null); // metode yang akan dihapus

  function open(name, initial = {}) {
    setDraft(initial);
    setErrors({});
    setModal(name);
  }
  const close = () => setModal(null);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const fieldError = (k) => errors[k] && <div className="t-small mt-4" style={{ color: "var(--error)" }} role="alert">{errors[k]}</div>;

  function makeDefault(m) {
    setMethods((list) => list.map((x) => ({ ...x, isDefault: x.id === m.id })));
    showToast(`${m.label} dijadikan metode utama.`);
  }

  function confirmRemove() {
    setMethods((list) => list.filter((x) => x.id !== target.id));
    close();
    showToast(`${target.label} dihapus.`);
  }

  function addMethod(e) {
    e.preventDefault();
    const t = TYPES[draft.type];
    const digits = digitsOf(draft.number || "");
    const errs = {};
    if (digits.length < t.min || digits.length > t.max) errs.number = `Nomor ${t.label} harus ${t.hint}.`;
    if (!draft.holder?.trim()) errs.holder = "Nama pemilik wajib diisi.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const method = {
      id: `m-${Date.now()}`, type: draft.type, icon: t.icon,
      label: `${t.label} •••• ${digits.slice(-4)}`, holder: draft.holder.trim(), isDefault: methods.length === 0,
    };
    setMethods((list) => [...list, method]);
    close();
    showToast("Metode pembayaran ditambahkan.");
  }

  function saveAddress(e) {
    e.preventDefault();
    const errs = {};
    if (!draft.businessName?.trim()) errs.businessName = "Nama usaha wajib diisi.";
    if (!draft.address?.trim()) errs.address = "Alamat wajib diisi.";
    if (!draft.city?.trim()) errs.city = "Kota wajib diisi.";
    if (!/^\d{5}$/.test(draft.postalCode || "")) errs.postalCode = "Kode pos harus 5 digit.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setAddress({ ...draft, businessName: draft.businessName.trim(), address: draft.address.trim(), city: draft.city.trim() });
    close();
    showToast("Perubahan disimpan.");
  }

  function toggleAutoRelease() {
    setAutoRelease((v) => !v);
    showToast("Perubahan disimpan.");
  }

  return (
    <>
      <SettingsCard title="Metode Pembayaran Tersimpan">
        <p className="t-small muted mt-8">
          Dana akan ditahan di escrow saat proyek dimulai, dan otomatis dicairkan ke mahasiswa setelah kamu menyetujui hasil kerja.
        </p>

        {methods.length === 0 ? (
          <p className="t-small muted mt-12">Belum ada metode pembayaran tersimpan.</p>
        ) : (
          <div className="mt-8">
            {methods.map((m) => (
              <div key={m.id} className="pay-method-row">
                <span className="pay-method-icon"><Icon name={m.icon} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                    <span className="settings-item-title">{m.label}</span>
                    {m.isDefault && <span className="badge badge-primary">Default</span>}
                  </div>
                  <div className="t-caption settings-item-sub">a.n. {m.holder}</div>
                </div>
                <div className="row gap-8" style={{ flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {!m.isDefault && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => makeDefault(m)}>Jadikan Default</button>
                  )}
                  <button
                    type="button" className="btn btn-ghost btn-sm" disabled={m.isDefault}
                    title={m.isDefault ? "Jadikan metode lain sebagai default dulu untuk menghapus yang ini." : undefined}
                    onClick={() => { setTarget(m); open("hapus"); }}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="btn btn-secondary btn-sm mt-12" onClick={() => open("tambah", { type: "va", number: "", holder: "" })}>
          <Icon name="plus" /> Tambah Metode Pembayaran Baru
        </button>
      </SettingsCard>

      <SettingsCard title="Alamat Penagihan" onEdit={() => open("alamat", { ...address })}>
        <div className="mt-12">
          <div className="settings-field">
            <span className="t-caption">NAMA USAHA</span>
            <span className="settings-item-title">{address.businessName}</span>
          </div>
          <div className="settings-field">
            <span className="t-caption">ALAMAT LENGKAP</span>
            <span className="t-small">{address.address}, {address.city}</span>
          </div>
          <div className="settings-field">
            <span className="t-caption">KODE POS</span>
            <span className="t-small">{address.postalCode}</span>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Preferensi Pembayaran">
        <div className="row-between mt-12" style={{ gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div className="settings-item-title">Konfirmasi otomatis pencairan dana</div>
            <div className="t-caption settings-item-sub">Dana dicairkan ke mahasiswa setelah 7 hari tanpa respons darimu atas milestone yang sudah dikirim.</div>
          </div>
          <button
            type="button"
            className={`toggle-switch ${autoRelease ? "on" : ""}`}
            onClick={toggleAutoRelease}
            aria-label="Toggle konfirmasi otomatis pencairan dana setelah 7 hari"
            aria-pressed={autoRelease}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </SettingsCard>

      <div className="card settings-card">
        <div className="row-between" style={{ gap: 16, flexWrap: "wrap" }}>
          <p className="t-small muted" style={{ flex: "1 1 260px" }}>
            Ingin lihat riwayat pembayaran dan dana tertahan? Kunjungi halaman Pembayaran.
          </p>
          <Link href="/payments" className="btn btn-secondary btn-sm">Buka Halaman Pembayaran</Link>
        </div>
      </div>

      {/* --- Modal --- */}
      <Modal open={modal === "tambah"} onClose={close} title="Tambah Metode Pembayaran">
        <form onSubmit={addMethod} noValidate className="mt-16">
          <div className="field">
            <label htmlFor="bm-type">Jenis metode</label>
            <select id="bm-type" className="input" value={draft.type || "va"} onChange={set("type")}>
              {Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bm-number">Nomor ({TYPES[draft.type || "va"].hint})</label>
            <input id="bm-number" className="input" inputMode="numeric" value={draft.number || ""} onChange={set("number")} autoFocus />
            {fieldError("number")}
          </div>
          <div className="field">
            <label htmlFor="bm-holder">Nama pemilik</label>
            <input id="bm-holder" className="input" value={draft.holder || ""} onChange={set("holder")} />
            {fieldError("holder")}
          </div>
          <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={close}>Batal</button>
            <button type="submit" className="btn btn-primary">Tambah</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "hapus"} onClose={close} title="Hapus Metode Pembayaran?">
        <p className="t-small muted mt-16 mb-16">
          {target ? <>Metode <b style={{ color: "var(--text)" }}>{target.label}</b> akan dihapus dari akunmu. Kamu bisa menambahkannya lagi kapan saja.</> : null}
        </p>
        <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={close}>Batal</button>
          <button type="button" className="btn btn-danger" onClick={confirmRemove}>Hapus</button>
        </div>
      </Modal>

      <Modal open={modal === "alamat"} onClose={close} title="Edit Alamat Penagihan">
        <form onSubmit={saveAddress} noValidate className="mt-16">
          <div className="field">
            <label htmlFor="ba-name">Nama usaha</label>
            <input id="ba-name" className="input" value={draft.businessName || ""} onChange={set("businessName")} autoFocus />
            {fieldError("businessName")}
          </div>
          <div className="field">
            <label htmlFor="ba-address">Alamat lengkap</label>
            <input id="ba-address" className="input" value={draft.address || ""} onChange={set("address")} />
            {fieldError("address")}
          </div>
          <div className="field">
            <label htmlFor="ba-city">Kota</label>
            <input id="ba-city" className="input" value={draft.city || ""} onChange={set("city")} />
            {fieldError("city")}
          </div>
          <div className="field">
            <label htmlFor="ba-postal">Kode pos</label>
            <input id="ba-postal" className="input" inputMode="numeric" maxLength={5} value={draft.postalCode || ""} onChange={set("postalCode")} />
            {fieldError("postalCode")}
          </div>
          <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={close}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
