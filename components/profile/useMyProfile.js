"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRole } from "@/context/RoleContext";
import { profileApi } from "@/lib/profile/api";

// Data profil milik sendiri dari GET /me/profile (bukan data contoh), dipakai halaman
// Profil & Pengaturan. save(patch) → PUT /me/profile; nama baru langsung ikut ke
// sidebar, menu pengguna, dan sapaan dashboard (refreshAuthUser), tanpa logout.
export default function useMyProfile() {
  const { refreshAuthUser } = useRole();
  const [state, setState] = useState({ loading: true, error: null, user: null, profile: null });
  const alive = useRef(true);

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await profileApi.me();
    if (!alive.current) return;
    if (!res.ok) {
      setState((s) => ({ ...s, loading: false, error: res.error.message }));
      return;
    }
    setState({ loading: false, error: null, user: res.data.user, profile: res.data.profile });
    refreshAuthUser();
  }, [refreshAuthUser]);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => { alive.current = false; };
  }, [reload]);

  const save = useCallback(async (patch) => {
    const res = await profileApi.update(patch);
    if (res.ok && alive.current) {
      setState((s) => ({ ...s, user: res.data.user, profile: res.data.profile }));
      refreshAuthUser();
    }
    return res;
  }, [refreshAuthUser]);

  return { ...state, reload, save };
}
