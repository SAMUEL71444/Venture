Modul escrow & ledger — satu-satunya yang boleh mengubah saldo (double-entry).

- `Services/LedgerService.php` — `fundEscrow`, `releaseMilestone`, `walletFor`; wajib dipanggil di dalam transaksi DB.
- `Services/FeeCalculator.php` — rumus komisi platform & mentor (integer Rupiah, basis poin).
- `State/EscrowStateMachine.php` — transisi status escrow.
