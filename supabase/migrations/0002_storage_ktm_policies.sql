-- ============================================================================
-- CP2b — Policy Storage untuk bucket privat (KTM & hasil kerja)
-- ============================================================================
-- Bucket `digitalin-private` sudah dibuat manual (privat). Di sini kita atur
-- SIAPA yang boleh unggah/baca file di dalamnya.
--
-- Aturan:
--   * User yang login boleh MENGUNGGAH & MEMBACA file miliknya sendiri,
--     yaitu file di bawah folder `ktm/<user-id>/...`.
--   * Pembacaan oleh peninjau (role trust) & akses lintas-user diatur nanti
--     lewat signed URL dari sisi server/Edge Function, bukan kebijakan publik.
--
-- Catatan: path file = 'ktm/<auth-uid>/<file>'. storage.foldername(name)
-- memecah path jadi array folder; indeks [2] = segmen kedua = user id.
-- ============================================================================

-- Pastikan RLS aktif (biasanya sudah, tapi aman ditegaskan).
-- Objek storage ada di tabel storage.objects.

drop policy if exists "ktm upload milik sendiri" on storage.objects;
create policy "ktm upload milik sendiri" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'digitalin-private'
    and (storage.foldername(name))[1] = 'ktm'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "ktm update milik sendiri" on storage.objects;
create policy "ktm update milik sendiri" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'digitalin-private'
    and (storage.foldername(name))[1] = 'ktm'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "ktm baca milik sendiri" on storage.objects;
create policy "ktm baca milik sendiri" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'digitalin-private'
    and (storage.foldername(name))[1] = 'ktm'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
