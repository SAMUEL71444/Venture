// Lapisan data proyek berbasis Supabase (CP3).
// Mengembalikan bentuk yang dekat dengan mock lama supaya komponen daftar/
// detail proyek gampang disambung. Kontrak hasil: { ok, data } / { ok, error }.
import { supabase } from "./client";

function formatRupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}

// Baris DB → bentuk untuk kartu/daftar proyek di UI.
function shapeProject(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category?.name || null,
    categorySlug: row.category?.slug || null,
    budget: row.budget,
    budgetLabel: formatRupiah(row.budget),
    deadline: row.deadline,
    location: row.location,
    status: row.status,
    isPremium: row.is_premium,
    applicants: row.applicants_count,
    umkmId: row.umkm_id,
    umkmName: row.umkm?.display_name || null,
    createdAt: row.created_at,
  };
}

const SELECT = `
  id, umkm_id, title, description, budget, deadline, location, status,
  is_premium, applicants_count, created_at,
  category:service_categories ( slug, name ),
  umkm:profiles!projects_umkm_id_fkey ( display_name )
`;

/** Daftar proyek terbuka (untuk halaman "Cari Proyek"). Premium di atas. */
export async function listOpenProjects({ categorySlug } = {}) {
  let q = supabase.from("projects").select(SELECT).eq("status", "open");
  const { data, error } = await q
    .order("is_premium", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: { message: error.message } };
  let rows = (data || []).map(shapeProject);
  if (categorySlug) rows = rows.filter((p) => p.categorySlug === categorySlug);
  return { ok: true, data: rows };
}

/** Proyek milik satu UMKM (semua status). */
export async function listMyProjects(umkmId) {
  const { data, error } = await supabase
    .from("projects")
    .select(SELECT)
    .eq("umkm_id", umkmId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: { message: error.message } };
  return { ok: true, data: (data || []).map(shapeProject) };
}

/** Detail satu proyek. */
export async function getProject(id) {
  const { data, error } = await supabase.from("projects").select(SELECT).eq("id", id).maybeSingle();
  if (error) return { ok: false, error: { message: error.message } };
  if (!data) return { ok: false, error: { code: "NOT_FOUND", message: "Proyek tidak ditemukan" } };
  return { ok: true, data: shapeProject(data) };
}

/** UMKM memposting proyek baru. */
export async function createProject({ title, description, budget, deadline, location, categoryId, templateId }) {
  const { data: sess } = await supabase.auth.getUser();
  const uid = sess?.user?.id;
  if (!uid) return { ok: false, error: { code: "UNAUTHENTICATED", message: "Harus login" } };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      umkm_id: uid,
      title: title?.trim(),
      description: description?.trim() || "",
      budget: Math.round(Number(budget) || 0),
      deadline: deadline || null,
      location: location?.trim() || null,
      category_id: categoryId || null,
      template_id: templateId || null,
      status: "open",
    })
    .select(SELECT)
    .maybeSingle();
  if (error) return { ok: false, error: { message: error.message } };
  return { ok: true, data: shapeProject(data) };
}

/** Daftar kategori jasa (untuk filter & form posting). */
export async function listCategories() {
  const { data, error } = await supabase
    .from("service_categories")
    .select("id, slug, name, description")
    .order("sort_order");
  if (error) return { ok: false, error: { message: error.message } };
  return { ok: true, data: data || [] };
}
