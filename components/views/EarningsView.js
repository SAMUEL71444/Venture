"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import EarningsSummary from "@/components/earnings/EarningsSummary";
import IncomeChart from "@/components/earnings/IncomeChart";
import EarningsSectionMenu from "@/components/earnings/EarningsSectionMenu";
import LedgerRow from "@/components/earnings/LedgerRow";
import TransactionDetailDrawer from "@/components/earnings/TransactionDetailDrawer";
import WithdrawDrawer from "@/components/earnings/WithdrawDrawer";
import InvoiceDrawer from "@/components/earnings/InvoiceDrawer";
import Icon from "@/components/Icon";
import { getAllProjects, MOCK_TODAY } from "@/lib/projects.mock";
import { SAVED_ACCOUNTS, WITHDRAWALS } from "@/lib/earnings.mock";
import {
  buildTransactions, buildInvoices, summarize, monthlyIncome,
  TX_STATUS_META, WD_STATUS_META, INVOICE_STATUS_META,
} from "@/lib/earnings";

// Isi persis "Penghasilan" yang sebelumnya app/mahasiswa/earnings/page.js —
// dipindah ke sini (dipanggil app/earnings/page.js) minus Sidebar/dash-shell,
// yang sekarang tanggung jawab AppShell. Cuma role freelancer yang boleh
// buka /earnings (lihat ROUTE_PERMISSIONS, config/roles.js), jadi nggak ada
// cabang role di dalam sini.
// useSearchParams wajib dibungkus <Suspense> di App Router — lihat catatan
// yang sama di app/register/page.js.
export default function EarningsView() {
  return (
    <Suspense fallback={null}>
      <EarningsPageInner />
    </Suspense>
  );
}

const TAB_META = {
  transaksi: { title: "Riwayat Transaksi", searchPlaceholder: "Cari judul proyek atau nama klien..." },
  penarikan: { title: "Penarikan Dana", searchPlaceholder: "Cari rekening tujuan..." },
  faktur: { title: "Faktur", searchPlaceholder: "Cari nomor faktur atau nama klien..." },
};

const accountLabel = (id) => SAVED_ACCOUNTS.find((a) => a.id === id)?.label || "-";

function EarningsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = TAB_META[searchParams.get("tab")] ? searchParams.get("tab") : "transaksi";

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [extraWithdrawals, setExtraWithdrawals] = useState([]);
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const projects = useMemo(() => getAllProjects(), []);
  const transactions = useMemo(() => buildTransactions(projects, MOCK_TODAY), [projects]);
  const invoices = useMemo(() => buildInvoices(transactions, projects), [transactions, projects]);

  const withdrawals = useMemo(
    () => [...extraWithdrawals, ...WITHDRAWALS]
      .map((w) => ({ ...w, accountLabel: accountLabel(w.accountId) }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [extraWithdrawals]
  );

  const summary = useMemo(() => summarize(transactions, withdrawals), [transactions, withdrawals]);
  const months = useMemo(() => monthlyIncome(transactions, MOCK_TODAY, 6), [transactions]);

  const dataByTab = { transaksi: transactions, penarikan: withdrawals, faktur: invoices };

  function selectTab(nextTab) {
    setQuery("");
    setStatusFilter(null);
    router.push(`/earnings?tab=${nextTab}`);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  function handleWithdrawSubmit({ amount, accountId }) {
    const newWithdrawal = {
      id: `wd-new-${Date.now()}`,
      date: MOCK_TODAY,
      amount,
      accountId,
      status: "diproses",
    };
    setExtraWithdrawals((prev) => [newWithdrawal, ...prev]);
    setWithdrawOpen(false);
    showToast(`Penarikan ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)} sedang diproses.`);
  }

  const items = dataByTab[tab];
  const meta = TAB_META[tab];

  const statusMetaByTab = { transaksi: TX_STATUS_META, penarikan: WD_STATUS_META, faktur: INVOICE_STATUS_META };
  const statusOptions = useMemo(() => {
    const currentMeta = statusMetaByTab[tab];
    const seen = new Map();
    items.forEach((it) => {
      if (!seen.has(it.status)) seen.set(it.status, currentMeta[it.status].label);
    });
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tab]);

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter) list = list.filter((it) => it.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((it) => {
        if (tab === "transaksi") return it.projectTitle.toLowerCase().includes(q) || it.client.toLowerCase().includes(q);
        if (tab === "penarikan") return it.accountLabel.toLowerCase().includes(q);
        return it.number.toLowerCase().includes(q) || it.projectTitle.toLowerCase().includes(q) || it.client.toLowerCase().includes(q);
      });
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [items, statusFilter, query, tab]);

  function openItem(item) {
    if (tab === "transaksi") setSelectedTx(item);
    else if (tab === "faktur") setSelectedInvoice(item);
  }

  return (
    <>
      <h1 className="t-h1 mb-20">Penghasilan</h1>

      <EarningsSummary summary={summary} onWithdraw={() => setWithdrawOpen(true)} />
      <IncomeChart months={months} />

      <EarningsSectionMenu activeTab={tab} onSelectTab={selectTab} dataByTab={dataByTab} />

      <h2 className="t-h3 mb-16">{meta.title}</h2>

      <div className="project-toolbar mb-16">
        <div className="project-search">
          <Icon name="search" />
          <input
            className="input"
            placeholder={meta.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="row gap-8" style={{ flexWrap: "wrap" }}>
          <button
            type="button"
            className={`chip-filter ${statusFilter === null ? "active" : ""}`}
            onClick={() => setStatusFilter(null)}
          >
            Semua Status
          </button>
          {statusOptions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`chip-filter ${statusFilter === s.id ? "active" : ""}`}
              onClick={() => setStatusFilter(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {tab === "penarikan" && (
          <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setWithdrawOpen(true)}>
            <Icon name="arrowUpRight" /> Tarik Dana
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">Tidak ada data yang cocok.</div>
      ) : (
        <div className="job-feed-list">
          {filtered.map((item) => (
            <LedgerRow key={item.id} variant={tab} item={item} onClick={openItem} />
          ))}
        </div>
      )}

      <TransactionDetailDrawer transaction={selectedTx} open={!!selectedTx} onClose={() => setSelectedTx(null)} />
      <InvoiceDrawer
        invoice={selectedInvoice}
        open={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onDownload={() => showToast("Unduhan faktur belum tersedia di prototipe ini.")}
      />
      <WithdrawDrawer
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        saldoTersedia={summary.saldoTersedia}
        onSubmit={handleWithdrawSubmit}
      />

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
