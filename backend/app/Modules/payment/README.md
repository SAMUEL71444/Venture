Modul payment — tagihan ke gateway dan webhook.

- `Gateway/PaymentGateway.php` — kontrak driver; `MockPaymentGateway` untuk dev/test (pilih lewat `PAYMENT_GATEWAY_DRIVER`).
- `Services/PaymentService.php` — buat tagihan escrow, proses webhook (idempotent), expire tagihan.
- `Jobs/ExpirePaymentJob.php` + command `payments:expire-overdue`; simulasi dev `payments:mock-pay {payment_id}`.
