-- ============================================================================
-- Seed universitas — daftar kampus umum di Indonesia + domain email kampus.
-- Aman dijalankan berulang (upsert berdasarkan name yang unik).
-- email_domain dipakai untuk mencocokkan verifikasi email kampus nanti.
-- ============================================================================
insert into universities (name, email_domain, city) values
  ('Universitas Indonesia', 'ui.ac.id', 'Depok'),
  ('Institut Teknologi Bandung', 'itb.ac.id', 'Bandung'),
  ('Universitas Gadjah Mada', 'ugm.ac.id', 'Yogyakarta'),
  ('Institut Teknologi Sepuluh Nopember', 'its.ac.id', 'Surabaya'),
  ('Universitas Airlangga', 'unair.ac.id', 'Surabaya'),
  ('Universitas Diponegoro', 'undip.ac.id', 'Semarang'),
  ('Universitas Brawijaya', 'ub.ac.id', 'Malang'),
  ('Universitas Padjadjaran', 'unpad.ac.id', 'Bandung'),
  ('Universitas Bina Nusantara', 'binus.ac.id', 'Jakarta'),
  ('Telkom University', 'telkomuniversity.ac.id', 'Bandung'),
  ('Universitas Sebelas Maret', 'uns.ac.id', 'Surakarta'),
  ('Universitas Hasanuddin', 'unhas.ac.id', 'Makassar'),
  ('Universitas Sumatera Utara', 'usu.ac.id', 'Medan'),
  ('Universitas Negeri Jakarta', 'unj.ac.id', 'Jakarta'),
  ('Universitas Pendidikan Indonesia', 'upi.edu', 'Bandung'),
  ('Institut Pertanian Bogor', 'apps.ipb.ac.id', 'Bogor'),
  ('Universitas Gunadarma', 'gunadarma.ac.id', 'Depok'),
  ('Universitas Atma Jaya Yogyakarta', 'uajy.ac.id', 'Yogyakarta'),
  ('Universitas Mercu Buana', 'mercubuana.ac.id', 'Jakarta'),
  ('Universitas Udayana', 'unud.ac.id', 'Denpasar')
on conflict (name) do update
  set email_domain = excluded.email_domain, city = excluded.city;
