Modul notifikasi — in-app, WhatsApp, email.

- `Services/NotificationService.php` — `notify()` / `notifyAdmins()`; baris `notifications` = kanal in-app.
- `Jobs/DeliverNotificationJob.php` — kirim kanal eksternal lewat `NotificationChannelSender` (saat ini `LogNotificationSender`, mock).
- `GET /notifications`, `POST /notifications/{id}/read`.
