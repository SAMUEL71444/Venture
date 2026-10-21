"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import Drawer from "@/components/ui/Drawer";
import { SAVED_ACCOUNTS } from "@/lib/earnings.mock";
import { formatRupiah } from "@/lib/format";

const MIN_WITHDRAW = 50000;

export default function WithdrawDrawer({ open, onClose, saldoTersedia, onSubmit }) {
  const [accountId, setAccountId] = useState(SAVED_ACCOUNTS[0].id);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);

  function reset() {
    setAmount("");
    setError(null);
    setAccountId(SAVED_ACCOUNTS[0].id);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e) {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n < MIN_WITHDRAW) {
      setError(`Minimal penarikan ${formatRupiah(MIN_WITHDRAW)}`);
      return;
    }
    if (n > saldoTersedia) {
      setError(`Jumlah melebihi saldo tersedia (${formatRupiah(saldoTersedia)})`);
      return;
    }
    onSubmit({ amount: n, accountId });
    reset();
  }

  return (
    <Drawer open={open} onClose={handleClose} title="Tarik Dana">
      <form onSubmit={handleSubmit}>
        <div className="t-caption mb-8">SALDO TERSEDIA</div>
        <div className="t-h2 mb-20">{formatRupiah(saldoTersedia)}</div>

        <div className="field">
          <label>Rekening Tujuan</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {SAVED_ACCOUNTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Jumlah Penarikan</label>
          <div className="input-group">
            <span className="input-prefix">Rp</span>
            <input
              className="input"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(null); }}
              placeholder="0"
            />
          </div>
          <button type="button" className="link-btn mt-8" onClick={() => setAmount(String(saldoTersedia))}>
            Tarik semua saldo
          </button>
        </div>

        {error && (
          <div className="card mt-8" style={{ background: "var(--error-bg)", borderColor: "transparent", padding: 12 }}>
            <span className="t-small" style={{ color: "var(--error)" }}>{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block btn-lg mt-20">
          <Icon name="arrowUpRight" /> Tarik Dana
        </button>
      </form>
    </Drawer>
  );
}
