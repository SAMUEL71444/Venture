Modul pembatalan — batal langsung, pengajuan yang ditinjau admin, alokasi dana per milestone.

- `Services/CancellationService.php` — request (DIRECT / NEEDS_REVIEW), respond, withdraw, reject, approve, terminasi admin.
- `State/CancellationStateMachine.php` — status cancellation_requests.
- Jurnal ada di `ledger/Services/LedgerService::refundEscrowInFull` dan `::settleTermination`; refund gateway di `payment/Services/RefundService`.
