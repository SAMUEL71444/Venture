"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ROLES } from "@/config/roles";
import { CURRENT_USERS } from "@/lib/users.mock";
import { SESSION_ENDED_EVENT, ACCOUNT_PENDING_EVENT, getAuthUser } from "@/lib/auth/session";
import { restoreSession, USE_MOCK } from "@/lib/auth/api";

const STORAGE_KEY = "digitalin.role";

// Dulu cuma nyimpen string role di state, hilang tiap refresh. Sekarang
// disimpan juga di localStorage (dibungkus try/catch — bisa gagal di private
// window dsb, lihat catatan artifact soal ini), jadi begitu login/ganti role
// lewat RoleSwitcher, reload halaman nggak balik ke null lagi. API publik
// (`role`, `setRole`, `useRole()`) SENGAJA tidak berubah — halaman login,
// verify, dan logout yang sudah ada tetap jalan tanpa disentuh.
//
// Sejak auth tersambung ke backend: `role` & `authUser` datang dari SESI ASLI
// (refresh token → /auth/refresh → /me/profile saat aplikasi dimuat), dan
// `status` memberi tahu halaman apakah sesi masih dipulihkan. Penyimpanan role
// di localStorage kini hanya dipakai mode demo (NEXT_PUBLIC_AUTH_MOCK=true)
// untuk RoleSwitcher. `user` tetap data mock CURRENT_USERS (dipakai halaman
// yang belum tersambung backend).
//
// Penjagaan halaman dilakukan di CLIENT (AppShell / RoleGuard / useRequireAuth),
// BUKAN lewat middleware Next.js: token tidak disimpan di cookie (access token
// di memori, refresh token di localStorage — lihat lib/auth/session.js), jadi
// server/middleware memang tidak bisa membaca sesi.
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
  const [authUser, setAuthUserState] = useState(null);
  // "loading" (memulihkan sesi) | "authenticated" | "anonymous" (belum login)
  // | "signedOut" (baru saja menekan Keluar di tab ini)
  // | "unreachable" (server tidak bisa dihubungi; token tetap ada, bisa dicoba lagi)
  const [status, setStatus] = useState("loading");
  const statusRef = useRef(status);
  statusRef.current = status;

  const alive = useRef(true);
  // Dipanggil sekali saat aplikasi dimuat, dan lagi HANYA lewat tombol "Coba lagi"
  // (retrySession) — tidak ada percobaan ulang otomatis, jadi tidak ada loop refresh.
  const runRestore = useCallback(() => {
    setStatus("loading");
    restoreSession().then((result) => {
      if (!alive.current) return;
      if (result.status !== "authenticated") {
        setStatus(result.status);
        return;
      }
      setAuthUserState(result.user);
      setRoleState(USE_MOCK && readStoredRole() ? readStoredRole() : result.user.appRole);
      setStatus("authenticated");
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    runRestore();
    return () => { alive.current = false; };
  }, [runRestore]);

  // Sesi backend berakhir (refresh token ditolak / akun ditangguhkan, lihat
  // lib/api.js) → keluar dari peran dan arahkan ke halaman Masuk.
  useEffect(() => {
    function onSessionEnded(e) {
      const reason = e.detail?.reason;
      if (reason !== "expired" && reason !== "suspended") return;
      const wasSignedIn = statusRef.current === "authenticated";
      setRole(null);
      setStatus("anonymous");
      // Saat sesi sedang dipulihkan (bukan sedang login) cukup jadi anonim.
      if (wasSignedIn) window.location.assign(`/login?reason=${reason}`);
    }
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
  }, []);

  // 403 ACCOUNT_PENDING_VERIFICATION dari API → status user ikut diperbarui.
  useEffect(() => {
    function onAccountPending() {
      if (statusRef.current === "authenticated") setAuthUserState(getAuthUser());
    }
    window.addEventListener(ACCOUNT_PENDING_EVENT, onAccountPending);
    return () => window.removeEventListener(ACCOUNT_PENDING_EVENT, onAccountPending);
  }, []);

  function setRole(next) {
    if (next) {
      // Mode asli: peran hanya boleh sama dengan peran akun yang login
      // (tidak bisa dipalsukan lewat mis. /verify?type=...).
      const sessionUser = getAuthUser();
      if (!sessionUser?.appRole || (!USE_MOCK && next !== sessionUser.appRole)) return;
      setAuthUserState(sessionUser);
      setStatus("authenticated");
    } else {
      setAuthUserState(null);
      setStatus("signedOut");
    }
    setRoleState(next);
    if (!USE_MOCK) return;
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage nggak tersedia (mis. private mode) — role tetap
      // kepakai selama sesi ini lewat state React, cuma nggak nempel
      // lintas refresh. Bukan error fatal, jadi sengaja dibiarkan diam.
    }
  }

  // Ringkasan user tersimpan diperbarui (mis. /verify memuat ulang /me/profile) → ikut ke state.
  const refreshAuthUser = useCallback(() => {
    const sessionUser = getAuthUser();
    if (sessionUser && statusRef.current === "authenticated") setAuthUserState(sessionUser);
  }, []);

  const user = role ? CURRENT_USERS[role] : null;
  const config = role ? ROLES[role] : null;

  return (
    <RoleContext.Provider value={{ role, setRole, user, config, authUser, status, retrySession: runRestore, refreshAuthUser }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole harus dipakai di dalam <RoleProvider>");
  return ctx;
}
