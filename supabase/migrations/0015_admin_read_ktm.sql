-- ============================================================================
-- CP admin (fix) — Admin (role trust) boleh MEMBACA semua file KTM.
-- ============================================================================
-- Policy sebelumnya (0002) hanya mengizinkan user baca KTM miliknya sendiri,
-- sehingga admin tidak bisa membuat signed URL untuk meninjau KTM mahasiswa.
-- Tambah policy: role trust boleh select file KTM mana pun di bucket privat.
-- ============================================================================

drop policy if exists "ktm baca oleh admin trust" on storage.objects;
create policy "ktm baca oleh admin trust" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'digitalin-private'
    and (storage.foldername(name))[1] = 'ktm'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'trust'
    )
  );
