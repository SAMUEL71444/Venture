-- ============================================================================
-- CP5a (perbaikan keamanan) — Cabut akses post_ledger dari role client.
-- ============================================================================
-- Temuan uji: `revoke all ... from public` belum cukup; Supabase memberi
-- EXECUTE ke role `anon` & `authenticated` secara terpisah. Fungsi keuangan
-- inti TIDAK boleh bisa dipanggil langsung dari browser — hanya oleh fungsi
-- SECURITY DEFINER lain (CP5b/c/d) yang berjalan sebagai pemilik.
-- ============================================================================

revoke all on function post_ledger(text, uuid, text, jsonb) from public;
revoke all on function post_ledger(text, uuid, text, jsonb) from anon;
revoke all on function post_ledger(text, uuid, text, jsonb) from authenticated;
