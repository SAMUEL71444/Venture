"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { enrichProject } from "@/lib/progress";
import { MOCK_TODAY } from "@/lib/projects.mock";
import { umkmProjects } from "@/lib/payments";
import { applyPostedMilestones } from "@/lib/projects-posting";

// Store proyek milik UMKM yang bisa berubah di sesi ini: proyek baru yang
// diposting lewat form (`posted`) dan hasil edit milestone pada proyek bawaan
// (`overrides`: projectId -> daftar milestone). Data bawaan di lib/*.mock.js
// TIDAK dimodifikasi — useClientProjects() menggabungkannya saat dibaca, dan
// escrow (lib/escrow.js) tetap membaca data bawaan, jadi angka dana tidak
// berubah. Dipasang di app/layout.js sebelum ChatProvider (chat juga
// membutuhkan daftar proyek yang sama).
const ProjectsContext = createContext(null);

export function ProjectsProvider({ children }) {
  const [posted, setPosted] = useState([]);
  const [overrides, setOverrides] = useState({});

  function addProject(raw) {
    setPosted((list) => [raw, ...list]);
  }

  function saveMilestones(projectId, milestones) {
    if (posted.some((p) => p.id === projectId)) {
      setPosted((list) => list.map((p) => (p.id === projectId ? applyPostedMilestones(p, milestones) : p)));
    } else {
      setOverrides((o) => ({ ...o, [projectId]: milestones }));
    }
  }

  const value = useMemo(() => ({ posted, overrides, addProject, saveMilestones }), [posted, overrides]);
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects harus dipakai di dalam <ProjectsProvider>");
  return ctx;
}

// Semua proyek milik UMKM ini: yang diposting (paling baru di atas) + proyek
// bawaan, masing-masing dihitung ulang lewat enrichProject() kalau milestone-
// nya berubah, jadi progres & status milestone tetap konsisten dengan log
// event. `includeBase: false` = sembunyikan proyek bawaan (skenario "UMKM
// baru" di dashboard).
export function useClientProjects(umkmName, { includeBase = true } = {}) {
  const { posted, overrides } = useProjects();
  return useMemo(() => {
    const base = includeBase
      ? umkmProjects(umkmName).map((p) => (overrides[p.id] ? enrichProject({ ...p, milestones: overrides[p.id] }, MOCK_TODAY) : p))
      : [];
    const mine = posted.filter((p) => p.client === umkmName).map((p) => enrichProject(p, MOCK_TODAY));
    return [...mine, ...base];
  }, [umkmName, includeBase, posted, overrides]);
}
