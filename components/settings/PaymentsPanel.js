"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SettingsCard from "./SettingsCard";
import { ComingSoon, EditForm } from "./ProfileForm";
import { useRole } from "@/context/RoleContext";
import { isPendingUser } from "@/lib/auth/pending";
import { profileApi } from "@/lib/profile/api";

// Pilihan sama dengan PayoutController::PROVIDERS di backend.
const PROVIDERS = {
  BANK: ["BCA", "BRI", "BNI", "MANDIRI", "BSI", "CIMB", "PERMATA", "DANAMON", "BTN"],
  EWALLET: ["DANA", "OVO", "GOPAY", "SHOPEEPAY", "LINKAJA"],
};
const CHANNEL_LABEL = { BANK: "Bank", EWALLET: "E-wallet" };

// Tab "pembayaran". Mahasiswa: rekening penarikan asli (GET/POST /bank-accounts;
// nomor rekening penuh tidak pernah dikirim backend). Ubah/hapus rekening belum ada
// endpoint-nya. UMKM: tagihan & metode pembayaran belum punya endpoint → "Segera hadir".
export default function PaymentsPanel({ config, showToast }) {
  if (config.key !== "mahasiswa") {
    return (
      <ComingSoon title="Tagihan & Pembayaran">
        Menyimpan metode pembayaran dan alamat penagihan belum tersedia. Pembayaran proyek tetap dilakukan
        per milestone lewat halaman Pembayaran.
      </ComingSoon>
    );
  }
  return <BankAccounts showToast={showToast} />;
}

function BankAccounts({ showToast }) {
  const { authUser } = useRole();
  const pending = isPendingUser(authUser);
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [adding, setAdding] = useState(false);
  const [channel, setChannel] = useState("BANK");

  const load = useCallback(async () => {
    if (pending) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await profileApi.bankAccounts();
    setState(res.ok ? { loading: false, error: null, items: res.data || [] } : { loading: false, error: res.error.message, items: [] });
  }, [pending]);

  useEffect(() => { load(); }, [load]);

  async function add(input) {
    const res = await profileApi.addBankAccount({ ...input, channel });
    if (res.ok) {
      setAdding(false);
      showToast("Rekening ditambahkan.");
      load();
    }
    return res;
  }

  return (
    <>
      <SettingsCard title="Rekening Penarikan">
        <p className="t-small muted mt-8">Dana dari milestone yang disetujui ditarik ke rekening atau e-wallet di bawah.</p>
        {pending ? (
          <p className="t-small mt-12">Rekening penarikan bisa ditambahkan setelah akunmu terverifikasi. <Link href="/verify" className="link-btn">Verifikasi sekarang</Link></p>
        ) : state.loading ? (
          <p className="t-small muted mt-12">Memuat rekening…</p>
        ) : state.error ? (
          <div className="mt-12">
            <p className="t-small" role="alert">{state.error}</p>
            <button type="button" className="btn btn-secondary btn-sm mt-8" onClick={load}>Coba lagi</button>
          </div>
        ) : (
          <>
            {state.items.length === 0 ? (
              <div className="empty-state mt-12"><p className="t-small muted">Belum ada rekening. Tambahkan rekening untuk bisa menarik dana.</p></div>
            ) : (
              <div className="mt-12">
                {state.items.map((a) => (
                  <div key={a.id} className="settings-field">
                    <div>
                      <div className="settings-item-title">{a.provider_code} •••• {a.account_number_last4}</div>
                      <div className="t-caption settings-item-sub">{CHANNEL_LABEL[a.channel] || a.channel} · a.n. {a.account_holder_name}</div>
                    </div>
                    <div className="row gap-6">
                      {a.is_primary && <span className="badge badge-primary">Utama</span>}
                      <span className={`badge ${a.is_verified ? "badge-success" : "badge-neutral"}`}>{a.is_verified ? "Terverifikasi" : "Belum terverifikasi"}</span>
                    </div>
                  </div>
                ))}
                <p className="t-caption muted mt-8">Mengubah atau menghapus rekening belum tersedia.</p>
              </div>
            )}
            {adding ? (
              <>
                <div className="field mt-12">
                  <label htmlFor="ba-channel">Jenis</label>
                  <select id="ba-channel" className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
                    <option value="BANK">Bank</option>
                    <option value="EWALLET">E-wallet</option>
                  </select>
                </div>
                <EditForm
                  key={channel}
                  fields={[
                    { key: "provider_code", label: channel === "BANK" ? "Bank" : "E-wallet", type: "select", required: true,
                      options: PROVIDERS[channel].map((p) => ({ value: p, label: p })) },
                    { key: "account_number", label: channel === "BANK" ? "Nomor rekening" : "Nomor HP e-wallet", required: true, maxLength: 20, hint: "Hanya angka, 6–20 digit." },
                    { key: "account_holder_name", label: "Nama pemilik", required: true, maxLength: 120 },
                  ]}
                  initial={{ provider_code: PROVIDERS[channel][0] }}
                  submitLabel="Tambah rekening"
                  onCancel={() => setAdding(false)}
                  onSubmit={add}
                />
              </>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm mt-12" onClick={() => setAdding(true)}>Tambah rekening</button>
            )}
          </>
        )}
      </SettingsCard>
      <SettingsCard title="Riwayat Penarikan">
        <p className="t-small muted mt-8">Lihat semua penarikan dana beserta statusnya.</p>
        <Link href="/earnings?tab=penarikan" className="link-btn mt-12" style={{ display: "inline-block" }}>Lihat riwayat penarikan</Link>
      </SettingsCard>
    </>
  );
}
