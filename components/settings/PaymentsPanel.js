"use client";

import Link from "next/link";
import SettingsCard from "./SettingsCard";
import BillingPanel from "./BillingPanel";
import { SAVED_ACCOUNTS } from "@/lib/earnings.mock";

// Tab "pembayaran". Freelancer: rekening penarikan tersimpan (SAVED_ACCOUNTS,
// sumber yang sama dengan halaman Pendapatan). UMKM: BillingPanel (kelola
// metode pembayaran, alamat penagihan, preferensi). Role Verify & Trust
// nggak punya tab ini (lihat config.settingsNav).
export default function PaymentsPanel({ config, showToast }) {
  const isFreelancer = config.key === "mahasiswa";

  if (isFreelancer) {
    return (
      <>
        <SettingsCard title="Rekening Penarikan">
          <p className="t-small muted mt-8">Dana dari milestone yang disetujui akan ditarik ke rekening di bawah.</p>
          <div className="mt-12">
            {SAVED_ACCOUNTS.map((a) => (
              <div key={a.id} className="settings-field">
                <div>
                  <div className="settings-item-title">{a.label}</div>
                  <div className="t-caption settings-item-sub">a.n. {a.holder}</div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast("Rekening dihapus (simulasi).")}>Hapus</button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm mt-12" onClick={() => showToast("Tambah rekening belum tersedia di prototipe ini.")}>Tambah rekening</button>
        </SettingsCard>
        <SettingsCard title="Riwayat Penarikan">
          <p className="t-small muted mt-8">Lihat semua penarikan dana beserta statusnya.</p>
          <Link href="/earnings?tab=penarikan" className="link-btn mt-12" style={{ display: "inline-block" }}>Lihat riwayat penarikan</Link>
        </SettingsCard>
      </>
    );
  }

  return <BillingPanel showToast={showToast} />;
}
