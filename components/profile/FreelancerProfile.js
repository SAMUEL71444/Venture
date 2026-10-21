"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { FREELANCER_PROFILE, USE_COMPLETE_PROFILE } from "@/lib/profile.mock";
import { PLATFORM_USERS } from "@/lib/users.mock";
import { getAllProjects } from "@/lib/projects.mock";
import ProfileHeader from "./ProfileHeader";
import CompletenessSidebar from "./CompletenessSidebar";
import PortfolioSection from "./PortfolioSection";
import WorkHistorySection from "./WorkHistorySection";
import SkillsSection from "./SkillsSection";
import CatalogSection from "./CatalogSection";
import CertificationsSection from "./CertificationsSection";
import ExperienceListSection from "./ExperienceListSection";

// `?focus=<key>` (datang dari link "Lengkapi profil" di dashboard, atau
// growth tip saat profil 100%) -> id elemen yang di-scroll-ke dan di-highlight.
// Kunci checklist (video/hours/dst) ikut lib/profile.js; beberapa kunci
// tambahan menunjuk ke section kanan/bawah yang tidak ada di checklist.
const FOCUS_TARGETS = {
  video: "fp-item-video",
  hours: "fp-item-hours",
  languages: "fp-item-languages",
  verification: "fp-item-verification",
  education: "fp-item-education",
  certifications: "fp-section-certifications",
  catalog: "fp-section-catalog",
  skills: "fp-section-skills",
  portfolio: "fp-section-portfolio",
};

// Profil lengkap freelancer (gaya Upwork). Semua perubahan cuma state lokal —
// prototipe tanpa backend, balik ke data dummy kalau di-refresh. `?view=public`
// = tampilan seperti yang dilihat UMKM (tanpa tombol edit/draft).
export default function FreelancerProfile() {
  const { user } = useRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPublic = searchParams.get("view") === "public";
  const editable = !isPublic;
  const focus = searchParams.get("focus");

  const [data, setData] = useState(FREELANCER_PROFILE);
  const [toast, setToast] = useState(null);

  // Status verifikasi ID sama dengan halaman Pengaturan (PLATFORM_USERS
  // u-s1), kecuali USE_COMPLETE_PROFILE lagi dinyalakan untuk pratinjau.
  const idVerified = USE_COMPLETE_PROFILE || PLATFORM_USERS.find((u) => u.id === "u-s1")?.verification === "terverifikasi";
  const completed = getAllProjects().filter((p) => p.status === "selesai");

  // Scroll + highlight sebentar ke elemen yang ditunjuk ?focus=. Dijalankan
  // sekali per nilai `focus` (bukan tiap render data berubah).
  useEffect(() => {
    if (!focus) return;
    const id = FOCUS_TARGETS[focus] || focus;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("fp-highlight");
    const t = setTimeout(() => el.classList.remove("fp-highlight"), 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }
  // Gabungkan patch ke data + (opsional) munculkan toast.
  function update(patch, msg) {
    setData((d) => ({ ...d, ...patch }));
    if (msg) showToast(msg);
  }

  return (
    <>
      {isPublic && (
        <div className="fp-public-bar">Kamu melihat profil seperti yang dilihat UMKM.</div>
      )}

      <div className="card fp-shell">
        <ProfileHeader
          user={user} data={data} idVerified={idVerified} editable={editable} isPublic={isPublic}
          onTogglePublic={() => router.replace(isPublic ? "/profile" : "/profile?view=public", { scroll: false })}
          onChange={update} showToast={showToast}
        />
        <div className="fp-grid">
          <CompletenessSidebar data={data} idVerified={idVerified} editable={editable} onChange={update} showToast={showToast} />
          <div className="fp-main">
            <PortfolioSection
              id="fp-section-portfolio"
              portfolio={isPublic ? { ...data.portfolio, drafts: [] } : data.portfolio}
              editable={editable}
              onChange={(portfolio, msg) => update({ portfolio }, msg)}
            />
            <WorkHistorySection projects={completed} />
            <SkillsSection id="fp-section-skills" skills={data.skills} editable={editable} onChange={(skills, msg) => update({ skills }, msg)} showToast={showToast} />
            <CatalogSection id="fp-section-catalog" catalog={data.catalog} editable={editable} showToast={showToast} />
          </div>
        </div>
      </div>

      <div className="fp-stack">
        <CertificationsSection id="fp-section-certifications" items={data.certifications} editable={editable} onChange={(certifications, msg) => update({ certifications }, msg)} />
        <ExperienceListSection
          title="Riwayat Pekerjaan / Magang" items={data.employment} editable={editable}
          emptyText="Belum ada pengalaman kerja atau magang." addLabel="Tambah pengalaman kerja"
          onChange={(employment, msg) => update({ employment }, msg)}
        />
        <ExperienceListSection
          title="Pengalaman Lain" items={data.otherExperiences} editable={editable}
          emptyText="Tambahkan organisasi, lomba, atau proyek pribadi." addLabel="Tambah pengalaman lain"
          labels={{ title: "Judul", org: "Organisasi / Penyelenggara", period: "Periode", desc: "Deskripsi (opsional)" }}
          onChange={(otherExperiences, msg) => update({ otherExperiences }, msg)}
        />
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
