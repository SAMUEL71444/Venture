"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import IncomeChart from "@/components/earnings/IncomeChart";
import EarningsSectionMenu from "@/components/earnings/EarningsSectionMenu";
import PaymentsSummary from "@/components/payments/PaymentsSummary";
import PaymentRow from "@/components/payments/PaymentRow";
import PaymentDetailDrawer from "@/components/payments/PaymentDetailDrawer";
import PaymentInvoiceDrawer from "@/components/payments/PaymentInvoiceDrawer";
import { useRole } from "@/context/RoleContext";
import { useEscrow } from "@/context/EscrowContext";
import { FUND_STATUS } from "@/lib/escrow";
import { INVOICE_STATUS_META } from "@/lib/earnings";
import { MOCK_TODAY } from "@/lib/projects.mock";
import { buildPayments, buildPaymentInvoices, summarizePayments, monthlySpending } from "@/lib/payments";
import { formatRupiah, formatTanggal } from "@/lib/format";

// "Pembayaran" UMKM — pengeluaran ke mahasiswa lewat escrow. Struktur sama
// dengan EarningsView (ringkasan, grafik, 3 section popup, daftar + drawer).
// Baris transaksi datang dari lib/payments.js -> buildEscrowTransactions()
// (lib/escrow.js), jadi status & nilai termin sama persis dengan yang
// dilihat mahasiswa (Penghasilan) dan Verify & Trust (Transaksi & Dana).
// Hanya UMKM yang bisa membuka /payments (ROUTE_PERMISSIONS, config/roles.js).
export default function PaymentsView() {
  return (
    <Suspense fallback={null}>
      <PaymentsPageInner />
    </Suspense>
  );
}

const TAB_META = {
  riwayat: { title: "Riwayat Pembayaran", searchPlaceholder: "Cari judul proyek atau nama mahasiswa..." },
  tertahan: { title: "Dana Tertahan Saat Ini", searchPlaceholder: "Cari judul proyek atau nama mahasiswa..." },
  faktur: { title: "Faktur", searchPlaceholder: "Cari nomor faktur atau nama proyek..." },
};

const SECTIONS = [
  {
    id: "riwayat", label: "Riwayat Pembayaran", icon: "fileText",
    preview: (p) => ({
      icon: FUND_STATUS[p.status].icon,
      badgeClass: FUND_STATUS[p.status].badgeClass,
      title: p.projectTitle,
      subtitle: `${p.status === "dikembalikan" ? "+" : "−"}${formatRupiah(p.totalPaid)} · ${formatTanggal(p.date)}`,
    }),
  },
  {
    id: "tertahan", label: "Dana Tertahan", icon: "lock",
    preview: (p) => ({
      icon: FUND_STATUS[p.status].icon,
      badgeClass: FUND_STATUS[p.status].badgeClass,
      title: p.projectTitle,
      subtitle: `Milestone ${p.milestoneIndex} · ${formatRupiah(p.amount)}`,
    }),
  },
  {
    id: "faktur", label: "Faktur", icon: "fileText",
    preview: (i) => ({
      icon: "fileText",
      badgeClass: INVOICE_STATUS_META[i.status].badgeClass,
      title: i.number,
      subtitle: i.projectTitle,
    }),
  },
];

function PaymentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = TAB_META[searchParams.get("tab")] ? searchParams.get("tab") : "riwayat";
  const { user } = useRole();
  const { actions } = useEscrow();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [toast, setToast] = useState(null);

  const payments = useMemo(() => buildPayments(user.name, MOCK_TODAY, { actions }), [user.name, actions]);
  const invoices = useMemo(() => buildPaymentInvoices(payments), [payments]);
  const summary = useMemo(() => summarizePayments(payments), [payments]);
  const months = useMemo(() => monthlySpending(payments, MOCK_TODAY, 6), [payments]);
  const held = useMemo(() => payments.filter((p) => p.status === "ditahan" || p.status === "dibekukan"), [payments]);

  const dataByTab = { riwayat: payments, tertahan: held, faktur: invoices };
  const items = dataByTab[tab];
  const meta = TAB_META[tab];

  function selectTab(nextTab) {
    setQuery("");
    setStatusFilter(null);
    router.push(`/payments?tab=${nextTab}`);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const statusOptions = useMemo(() => {
    const metaMap = tab === "faktur" ? INVOICE_STATUS_META : FUND_STATUS;
    const seen = new Map();
    items.forEach((it) => { if (!seen.has(it.status)) seen.set(it.status, metaMap[it.status].label); });
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [items, tab]);

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter) list = list.filter((it) => it.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((it) =>
        it.projectTitle.toLowerCase().includes(q)
        || (it.freelancerName || "").toLowerCase().includes(q)
        || (it.number || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, statusFilter, query]);

  function openItem(item) {
    if (tab === "faktur") setSelectedInvoice(item);
    else setSelectedPayment(item);
  }

  return (
    <>
      <h1 className="t-h1 mb-4">Pembayaran</h1>
      <p className="t-body muted mb-20">Pantau dana yang kamu bayarkan ke mahasiswa lewat escrow.</p>

      <PaymentsSummary summary={summary} onTopUp={() => showToast("Top up saldo deposit belum tersedia di prototipe ini.")} />
      <IncomeChart
        months={months}
        tone="spend"
        title="Pengeluaran 6 Bulan Terakhir"
        subtitle="Total yang sudah & sedang dicairkan ke mahasiswa (termasuk biaya layanan) — dana tertahan tidak dihitung"
      />

      {/* Halaman ini cuma untuk MELIHAT data. Mengelola metode pembayaran,
          alamat penagihan, dan preferensi ada di Pengaturan > Tagihan &
          Pembayaran (components/settings/BillingPanel.js). */}
      <div className="card card-pad mb-20">
        <div className="row-between" style={{ gap: 16, flexWrap: "wrap" }}>
          <p className="t-small muted" style={{ flex: "1 1 280px" }}>
            Metode pembayaran, alamat penagihan, dan preferensi pembayaran dikelola di Pengaturan › Tagihan & Pembayaran.
          </p>
          <Link href="/settings?tab=pembayaran" className="btn btn-secondary btn-sm">Kelola di Pengaturan</Link>
        </div>
      </div>

      <EarningsSectionMenu activeTab={tab} onSelectTab={selectTab} dataByTab={dataByTab} sections={SECTIONS} basePath="/payments" />

      <h2 className="t-h3 mb-16">{meta.title}</h2>

      <div className="project-toolbar mb-16">
        <div className="project-search">
          <Icon name="search" />
          <input className="input" placeholder={meta.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="row gap-8" style={{ flexWrap: "wrap" }}>
          <button type="button" className={`chip-filter ${statusFilter === null ? "active" : ""}`} onClick={() => setStatusFilter(null)}>
            Semua Status
          </button>
          {statusOptions.map((s) => (
            <button key={s.id} type="button" className={`chip-filter ${statusFilter === s.id ? "active" : ""}`} onClick={() => setStatusFilter(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          {tab === "tertahan" && items.length === 0 ? "Tidak ada dana yang sedang tertahan." : "Tidak ada data yang cocok."}
        </div>
      ) : (
        <div className="job-feed-list">
          {filtered.map((item) => (
            <PaymentRow key={item.id} variant={tab} item={item} onClick={openItem} />
          ))}
        </div>
      )}

      <PaymentDetailDrawer payment={selectedPayment} open={!!selectedPayment} onClose={() => setSelectedPayment(null)} />
      <PaymentInvoiceDrawer
        invoice={selectedInvoice}
        open={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onDownload={() => showToast("Unduhan faktur belum tersedia di prototipe ini.")}
      />

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
