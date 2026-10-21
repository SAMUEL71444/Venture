"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";

// Halaman khusus tamu (/login, /register): user yang SUDAH login saat halaman
// dibuka diarahkan ke `target(role)`. Keputusan diambil sekali begitu sesi
// selesai dipulihkan, jadi login/daftar yang berhasil di halaman ini tetap
// memakai navigasinya sendiri. Mengembalikan true selama layar tunggu perlu tampil.
export default function useGuestOnly(target) {
  const { status, role } = useRole();
  const router = useRouter();
  const decision = useRef(null); // null | "guest" | "redirect"

  if (decision.current === null && status !== "loading") {
    decision.current = status === "authenticated" ? "redirect" : "guest";
  }

  useEffect(() => {
    if (decision.current === "redirect" && role) router.replace(target(role));
  }, [status, role, router, target]);

  return decision.current !== "guest";
}
