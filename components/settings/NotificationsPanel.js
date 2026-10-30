import { ComingSoon } from "./ProfileForm";

// Tab "Pengaturan Notifikasi": preferensi notifikasi belum punya endpoint → "Segera hadir".
export default function NotificationsPanel() {
  return (
    <ComingSoon title="Pengaturan Notifikasi">
      Memilih notifikasi apa saja yang dikirim lewat email atau push belum tersedia. Notifikasi penting
      (kode verifikasi, status proyek) tetap dikirim seperti biasa.
    </ComingSoon>
  );
}
