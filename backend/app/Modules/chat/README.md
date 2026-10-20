Modul chat UMKM <-> mahasiswa.

- `Services/ChatService.php` — percakapan otomatis per project, kirim pesan, tanda dibaca, deteksi kontak di luar platform.
- `Events/MessageSent.php` — broadcast private channel `conversation.{id}` (otorisasi di `routes/channels.php`).

