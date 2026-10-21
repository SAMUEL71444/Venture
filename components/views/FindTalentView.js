"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import ProjectsEmptyState from "@/components/projects/ProjectsEmptyState";
import TalentFilters from "@/components/talent/TalentFilters";
import TalentResultCard from "@/components/talent/TalentResultCard";
import TalentDetailPanel from "@/components/talent/TalentDetailPanel";
import InviteModal from "@/components/talent/InviteModal";
import { useRole } from "@/context/RoleContext";
import { useClientProjects } from "@/context/ProjectsContext";
import { PROJECTS } from "@/lib/mock-data";
import { PLATFORM_USERS } from "@/lib/users.mock";
import { TALENTS, SIMULATE_NO_OPEN_PROJECTS } from "@/lib/talents.mock";

const uniq = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, "id"));
const RATES = TALENTS.map((t) => t.rate);
const RATE_BOUNDS = [Math.floor(Math.min(...RATES) / 5000) * 5000, Math.ceil(Math.max(...RATES) / 5000) * 5000];

const OPTIONS = {
  rates: RATES,
  skills: uniq(TALENTS.flatMap((t) => t.skills.map((s) => s.name))),
  cities: uniq(TALENTS.map((t) => t.city)),
  timezones: ["WIB", "WITA", "WIT"],
  categories: uniq(TALENTS.map((t) => t.category)),
  unis: uniq(TALENTS.map((t) => t.uni)),
  educations: uniq(TALENTS.map((t) => t.education)),
};

const DEFAULT_FILTERS = {
  badges: [], rate: RATE_BOUNDS, skills: [], city: "", timezone: "",
  availability: "semua", category: "", success: 0, uni: "", education: "",
};

// Halaman "Cari Freelancer" (UMKM). Semua state ada di sini:
// - query + filters -> daftar hasil (satu useMemo)
// - selectedId -> TalentDetailPanel (kartu memanggil onOpen(id))
// - inviteId -> InviteModal (dari kartu maupun tombol "Ajak" di panel)
// - saved/invited -> dipakai kartu DAN panel, jadi selalu sinkron.
// `?talent=<id>` (mis. dari kartu rekomendasi di dashboard UMKM atau tautan
// "Bagikan" di panel) langsung membuka panel detail talent itu.
// useSearchParams wajib dibungkus <Suspense> di App Router.
export default function FindTalentView() {
  return (
    <Suspense fallback={null}>
      <FindTalentContent />
    </Suspense>
  );
}

function FindTalentContent() {
  const { user } = useRole();
  const searchParams = useSearchParams();
  const linkedTalent = TALENTS.find((t) => t.id === searchParams.get("talent"));
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(linkedTalent?.id || null);
  const [inviteId, setInviteId] = useState(null);
  const [saved, setSaved] = useState(() => new Set());
  const [invited, setInvited] = useState(() => new Set());
  const [toast, setToast] = useState(null);

  // Banner pengingat cuma muncul kalau usaha ini belum terverifikasi.
  const umkmVerified = PLATFORM_USERS.find((u) => u.name === user.name)?.verification === "terverifikasi";
  const [noticeOpen, setNoticeOpen] = useState(!umkmVerified);

  // Proyek terbuka milik UMKM ini, target undangan. Di-memo supaya modal
  // tidak me-reset pesan yang sedang diketik tiap render.
  // Proyek yang baru diposting lewat form (status "terbuka") ikut jadi target.
  const myProjects = useClientProjects(user.name);
  const openProjects = useMemo(
    () => (SIMULATE_NO_OPEN_PROJECTS
      ? []
      : [...myProjects.filter((p) => p.status === "terbuka"), ...PROJECTS.filter((p) => p.umkm === user.name)]),
    [user.name, myProjects]
  );

  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const resetAll = () => { setFilters(DEFAULT_FILTERS); setQuery(""); };

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const f = filters;
    return TALENTS.filter((t) => {
      if (q) {
        const hay = [t.name, t.title, t.major, t.uni, ...t.skills.map((s) => s.name)].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.badges.length && !f.badges.includes(t.badge)) return false;
      if (t.rate < f.rate[0] || t.rate > f.rate[1]) return false;
      if (f.skills.length && !f.skills.every((s) => t.skills.some((x) => x.name === s))) return false;
      if (f.city && t.city !== f.city) return false;
      if (f.timezone && t.timezone !== f.timezone) return false;
      if (f.availability === "terbuka" && !t.available) return false;
      if (f.category && t.category !== f.category) return false;
      if (f.success && t.successRate < f.success) return false;
      if (f.uni && t.uni !== f.uni) return false;
      if (f.education && t.education !== f.education) return false;
      return true;
    }).sort((a, b) => Number(b.boosted) - Number(a.boosted));
  }, [query, filters]);

  function toggleSave(id) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function sendInvite(talent, project) {
    setInvited((prev) => new Set(prev).add(talent.id));
    setInviteId(null);
    showToast(`Undangan untuk "${project.title}" terkirim ke ${talent.name}.`);
  }

  const selected = TALENTS.find((t) => t.id === selectedId) || null;
  const inviteTarget = TALENTS.find((t) => t.id === inviteId) || null;

  return (
    <>
      <h1 className="t-h1 ft-page-title">Cari Freelancer</h1>

      {noticeOpen && (
        <div className="ft-notice">
          <Icon name="info" />
          <span>Lengkapi <Link href="/settings?tab=verifikasi" className="link-btn">verifikasi usaha</Link> untuk membuka semua fitur pencarian freelancer.</span>
          <button type="button" className="icon-btn ft-notice-close" onClick={() => setNoticeOpen(false)} aria-label="Tutup pengingat">
            <Icon name="close" />
          </button>
        </div>
      )}

      <div className="ft-search-row">
        <div className="ft-search">
          <Icon name="search" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari berdasarkan nama, skill, atau jurusan..."
            aria-label="Cari freelancer"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Hapus pencarian"><Icon name="xCircle" /></button>
          )}
        </div>
        <button type="button" className="link-btn" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
          Pencarian Lanjutan
        </button>
      </div>

      <div className="ft-layout">
        <div className={`ft-filters-wrap ${filtersOpen ? "open" : ""}`}>
          <TalentFilters filters={filters} set={set} options={OPTIONS} rateBounds={RATE_BOUNDS} onReset={resetAll} />
        </div>

        <div className="ft-results">
          <div className="ft-quick-filters">
            <select className="input" value={filters.city} onChange={(e) => set({ city: e.target.value })} aria-label="Lokasi">
              <option value="">Lokasi</option>
              {OPTIONS.cities.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select
              className="input" aria-label="Skill"
              value={filters.skills.length === 1 ? filters.skills[0] : ""}
              onChange={(e) => set({ skills: e.target.value ? [e.target.value] : [] })}
            >
              <option value="">Skill</option>
              {OPTIONS.skills.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="input" value={filters.education} onChange={(e) => set({ education: e.target.value })} aria-label="Tingkat Pendidikan">
              <option value="">Tingkat Pendidikan</option>
              {OPTIONS.educations.map((e) => <option key={e}>{e}</option>)}
            </select>
          </div>

          <div className="t-small muted">{results.length} freelancer ditemukan</div>

          {results.length === 0 ? (
            <ProjectsEmptyState
              variant="no-results"
              title="Tidak ada freelancer yang cocok"
              subtitle="Coba ubah kata kunci atau longgarkan filter pencarianmu."
              actionLabel="Reset pencarian"
              onAction={resetAll}
            />
          ) : (
            <div className="ft-list">
              {results.map((t) => (
                <TalentResultCard
                  key={t.id}
                  talent={t}
                  saved={saved.has(t.id)}
                  invited={invited.has(t.id)}
                  onToggleSave={toggleSave}
                  onInvite={setInviteId}
                  onOpen={setSelectedId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <TalentDetailPanel
        talent={selected}
        query={query}
        saved={selected ? saved.has(selected.id) : false}
        invited={selected ? invited.has(selected.id) : false}
        onClose={() => setSelectedId(null)}
        onToggleSave={toggleSave}
        onInvite={setInviteId}
        showToast={showToast}
      />

      <InviteModal
        talent={inviteTarget}
        umkmName={user.name}
        projects={openProjects}
        onClose={() => setInviteId(null)}
        onSend={sendInvite}
      />

      {toast && <div className="toast" style={{ zIndex: 400 }}>{toast}</div>}
    </>
  );
}
