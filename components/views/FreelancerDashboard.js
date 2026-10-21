"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import JobTabs from "@/components/dashboard/JobTabs";
import JobFeed from "@/components/dashboard/JobFeed";
import ProfileSidePanel from "@/components/dashboard/ProfileSidePanel";
import Icon from "@/components/Icon";
import { useSearchPanel } from "@/context/SearchPanelContext";

// Isi persis "Cari Proyek" yang sebelumnya ada di app/mahasiswa/dashboard —
// cuma dipindah dari page.js ke sini (dipanggil lewat app/dashboard/page.js)
// supaya URL-nya bisa dipakai bareng role lain. Panel kanan (aside) tetap
// ditaruh AppShell, bukan di sini, biar sama caranya dengan role lain.
export default function FreelancerDashboard() {
  return (
    <Suspense fallback={null}>
      <FreelancerDashboardView />
    </Suspense>
  );
}

function FreelancerDashboardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState("best");
  const { openSearch } = useSearchPanel();

  return (
    <>
      <h1 className="t-h1 mb-16">Cari Proyek</h1>

      <button
        type="button"
        className="search-trigger-input mb-16"
        onClick={() => openSearch(query)}
      >
        <Icon name="search" />
        <span>{query ? query : "Cari proyek..."}</span>
      </button>

      {query && (
        <div className="search-active-chip mb-16">
          Hasil untuk &ldquo;{query}&rdquo;
          <button type="button" onClick={() => router.push("/dashboard")} aria-label="Hapus pencarian">
            <Icon name="close" />
          </button>
        </div>
      )}

      <JobTabs active={activeTab} onChange={setActiveTab} />
      <JobFeed activeTab={activeTab} query={query} />
    </>
  );
}

// Dipakai app/dashboard/page.js lewat prop `aside` AppShell. ProfileSidePanel
// membaca data profil sendiri lewat useRole()/FREELANCER_PROFILE, bukan
// props — lihat components/dashboard/ProfileSidePanel.js.
export function FreelancerDashboardAside() {
  return <ProfileSidePanel />;
}
