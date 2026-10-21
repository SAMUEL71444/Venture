"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import PostProjectModal from "@/components/projects/PostProjectModal";
import ProjectSectionMenu from "@/components/projects/ProjectSectionMenu";
import ProjectToolbar from "@/components/projects/ProjectToolbar";
import ProjectCard from "@/components/projects/ProjectCard";
import ProjectsEmptyState from "@/components/projects/ProjectsEmptyState";
import ProjectDetailDrawer from "@/components/projects/ProjectDetailDrawer";
import CompletionSummary from "@/components/projects/CompletionSummary";
import RecommendedJobs from "@/components/projects/RecommendedJobs";
import { STATUS_META, getActiveProjects, getAllProjects, getSavedProjects } from "@/lib/projects.mock";
import { useRole } from "@/context/RoleContext";
import { useClientProjects } from "@/context/ProjectsContext";

// Satu komponen "Proyek" dipakai DUA sudut pandang — bukan dua halaman
// terpisah:
//  - perspective="freelancer" (role mahasiswa): isinya PERSIS "Proyek Saya"
//    yang sudah ada (tab Aktif/Semua/Disimpan, ringkasan selesai,
//    rekomendasi di empty state).
//  - perspective="client" (role umkm): daftar proyek MILIK UMKM ini lintas
//    freelancer (lib/platform-projects.mock.js, disaring `client` ===
//    nama UMKM yang login), satu daftar tanpa tab simpan/rekomendasi
//    (konsep-konsep itu spesifik freelancer).
// useSearchParams wajib dibungkus <Suspense> di App Router — lihat catatan
// yang sama di app/register/page.js.
export default function ProjectsView({ perspective }) {
  return (
    <Suspense fallback={null}>
      {perspective === "client" ? <ClientProjectsView /> : <FreelancerProjectsView />}
    </Suspense>
  );
}

const TAB_META = {
  aktif: {
    title: "Proyek Aktif",
    emptyTitle: "Belum ada proyek aktif",
    emptySubtitle: "Proyek yang sedang kamu kerjakan bakal muncul di sini. Yuk mulai cari proyek pertamamu.",
    emptyAction: "Cari Proyek",
    emptyHref: "/dashboard",
  },
  semua: {
    title: "Semua Proyek",
    emptyTitle: "Belum ada riwayat proyek",
    emptySubtitle: "Semua proyek yang pernah dan sedang kamu kerjakan bakal terkumpul di sini.",
    emptyAction: "Cari Proyek",
    emptyHref: "/dashboard",
  },
  disimpan: {
    title: "Proyek yang Disimpan",
    emptyTitle: "Belum ada proyek yang disimpan",
    emptySubtitle: "Tandai proyek yang menarik perhatianmu supaya gampang ditemukan lagi nanti.",
    emptyAction: "Cari Proyek",
    emptyHref: "/dashboard",
  },
};

function FreelancerProjectsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = TAB_META[searchParams.get("tab")] ? searchParams.get("tab") : "aktif";

  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(null);
  const [sort, setSort] = useState("terbaru");
  const [savedIds, setSavedIds] = useState(() => new Set(getSavedProjects().map((p) => p.id)));
  const [detailProject, setDetailProject] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const raw = useMemo(() => ({
    aktif: getActiveProjects(),
    semua: getAllProjects(),
    disimpan: getSavedProjects(),
  }), []);

  const dataByTab = useMemo(() => ({
    aktif: raw.aktif,
    semua: raw.semua,
    disimpan: raw.disimpan.filter((p) => savedIds.has(p.id)),
  }), [raw, savedIds]);

  function selectTab(nextTab) {
    setQuery("");
    setStatusFilter(null);
    router.push(`/projects?tab=${nextTab}`);
  }

  function toggleSave(id) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openDetail(project) {
    setDetailProject(project);
    setDrawerOpen(true);
  }

  const items = raw[tab];
  const meta = TAB_META[tab];

  const statusOptions = useMemo(() => {
    const seen = new Map();
    items.forEach((p) => {
      if (!seen.has(p.status)) seen.set(p.status, STATUS_META[p.status].label);
    });
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter) list = list.filter((p) => p.status === statusFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.client.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sort === "tenggat") return new Date(a.deadline) - new Date(b.deadline);
      return new Date(b.updatedAt || b.deadline) - new Date(a.updatedAt || a.deadline);
    });
  }, [items, statusFilter, query, sort]);

  const hasAnyData = items.length > 0;
  const hasFilteredData = filtered.length > 0;

  return (
    <>
      <h1 className="t-h1 mb-20">Proyek Saya</h1>

      <CompletionSummary />

      <ProjectSectionMenu activeTab={tab} onSelectTab={selectTab} dataByTab={dataByTab} />

      <h2 className="t-h3 mb-16">{meta.title}</h2>

      {hasAnyData && (
        <ProjectToolbar
          query={query}
          onQueryChange={setQuery}
          statusOptions={statusOptions}
          activeStatus={statusFilter}
          onStatusChange={setStatusFilter}
          sort={sort}
          onSortChange={setSort}
        />
      )}

      {!hasAnyData ? (
        <>
          <ProjectsEmptyState
            variant="empty"
            title={meta.emptyTitle}
            subtitle={meta.emptySubtitle}
            actionLabel={meta.emptyAction}
            actionHref={meta.emptyHref}
          />
          <RecommendedJobs />
        </>
      ) : !hasFilteredData ? (
        <ProjectsEmptyState
          variant="no-results"
          title="Tidak ada hasil"
          subtitle="Coba ubah kata kunci pencarian atau hapus filter status yang sedang aktif."
          actionLabel="Hapus Filter"
          onAction={() => { setQuery(""); setStatusFilter(null); }}
        />
      ) : (
        <div className="job-feed-list">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpenDetail={openDetail}
              isSaved={tab === "disimpan" ? savedIds.has(p.id) : undefined}
              onToggleSave={tab === "disimpan" ? toggleSave : undefined}
            />
          ))}
        </div>
      )}

      <ProjectDetailDrawer project={detailProject} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

function ClientProjectsView() {
  const { user } = useRole();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Semua proyek milik UMKM yang sedang login: proyek yang diposting lewat
  // form + proyek bawaan (lintas freelancer, lib/platform-projects.mock.js),
  // digabung ProjectsContext — jadi proyek baru & hasil edit milestone
  // langsung terlihat di sini.
  const items = useClientProjects(user.name);

  // `?project=<id>` (mis. dari tombol "Tinjau & Setujui" di halaman
  // Pembayaran) langsung membuka detail proyek itu. `?new=1` (dari tombol
  // "Posting Proyek" di Dashboard) langsung membuka modal Buat Proyek Baru.
  const linkedProject = items.find((p) => p.id === searchParams.get("project")) || null;

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  // Yang disimpan cuma id: datanya selalu diturunkan dari `items`, supaya
  // drawer ikut ter-update begitu milestone diedit.
  const [detailId, setDetailId] = useState(linkedProject?.id || null);
  const [drawerOpen, setDrawerOpen] = useState(!!linkedProject);
  const [postOpen, setPostOpen] = useState(searchParams.get("new") === "1");
  const [toast, setToast] = useState(null);
  const detailProject = items.find((p) => p.id === detailId) || null;

  // Bersihkan ?new=1 dari URL setelah modal terbuka, supaya refresh/kembali
  // tidak membuka modalnya lagi.
  useEffect(() => {
    if (searchParams.get("new") === "1") router.replace("/projects", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDetail(project) {
    setDetailId(project.id);
    setDrawerOpen(true);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const statusOptions = useMemo(() => {
    const seen = new Map();
    items.forEach((p) => {
      if (!seen.has(p.status)) seen.set(p.status, STATUS_META[p.status].label);
    });
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter) list = list.filter((p) => p.status === statusFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || (p.freelancerName || "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => new Date(b.updatedAt || b.deadline) - new Date(a.updatedAt || a.deadline));
  }, [items, statusFilter, query]);

  return (
    <>
      <div className="row-between mb-20" style={{ gap: 16, flexWrap: "wrap" }}>
        <h1 className="t-h1">Proyek</h1>
        <button type="button" className="btn btn-primary" onClick={() => setPostOpen(true)}>
          <Icon name="plus" /> Posting Proyek
        </button>
      </div>

      {items.length > 0 && (
        <ProjectToolbar
          query={query}
          onQueryChange={setQuery}
          statusOptions={statusOptions}
          activeStatus={statusFilter}
          onStatusChange={setStatusFilter}
          sort="terbaru"
          onSortChange={() => {}}
        />
      )}

      {items.length === 0 ? (
        <ProjectsEmptyState
          variant="empty"
          title="Belum ada proyek"
          subtitle="Proyek yang kamu post dan sedang dikerjakan freelancer bakal muncul di sini."
          actionLabel="Posting Proyek Pertamamu"
          onAction={() => setPostOpen(true)}
        />
      ) : filtered.length === 0 ? (
        <ProjectsEmptyState
          variant="no-results"
          title="Tidak ada hasil"
          subtitle="Coba ubah kata kunci pencarian atau hapus filter status yang sedang aktif."
          actionLabel="Hapus Filter"
          onAction={() => { setQuery(""); setStatusFilter(null); }}
        />
      ) : (
        <div className="job-feed-list">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} onOpenDetail={openDetail} perspective="client" />
          ))}
        </div>
      )}

      <ProjectDetailDrawer project={detailProject} open={drawerOpen} onClose={() => setDrawerOpen(false)} perspective="client" />

      <PostProjectModal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        umkmName={user.name}
        onPosted={() => showToast("Proyek berhasil diposting")}
      />

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
