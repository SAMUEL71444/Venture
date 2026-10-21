"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ROLES } from "@/config/roles";
import { CURRENT_USERS } from "@/lib/users.mock";

const STORAGE_KEY = "digitalin.role";

// Dulu cuma nyimpen string role di state, hilang tiap refresh. Sekarang
// disimpan juga di localStorage (dibungkus try/catch — bisa gagal di private
// window dsb, lihat catatan artifact soal ini), jadi begitu login/ganti role
// lewat RoleSwitcher, reload halaman nggak balik ke null lagi. API publik
// (`role`, `setRole`, `useRole()`) SENGAJA tidak berubah — halaman login,
// verify, dan logout yang sudah ada tetap jalan tanpa disentuh.
const RoleContext = createContext(null);

function readStoredRole() {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v && ROLES[v] ? v : null;
  } catch {
    return null;
  }
}

export function RoleProvider({ children }) {
  // Mulai dari null di server & render pertama supaya HTML server-side dan
  // client-side sama persis (hindari hydration mismatch), baru dibaca dari
  // localStorage sesudah mount lewat useEffect di bawah.
  const [role, setRoleState] = useState(null);

  useEffect(() => {
    // Nggak ada role tersimpan (mis. belum pernah login) -> default ke
    // "mahasiswa" supaya URL bersama (/dashboard, /projects, dst) tetap
    // langsung bisa dibuka tanpa lewat /login dulu — kebutuhan prototipe,
    // bukan perilaku auth beneran.
    setRoleState(readStoredRole() || "mahasiswa");
  }, []);

  function setRole(next) {
    setRoleState(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage nggak tersedia (mis. private mode) — role tetap
      // kepakai selama sesi ini lewat state React, cuma nggak nempel
      // lintas refresh. Bukan error fatal, jadi sengaja dibiarkan diam.
    }
  }

  const user = role ? CURRENT_USERS[role] : null;
  const config = role ? ROLES[role] : null;

  return (
    <RoleContext.Provider value={{ role, setRole, user, config }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole harus dipakai di dalam <RoleProvider>");
  return ctx;
}
