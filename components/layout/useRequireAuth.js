"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";

// Halaman wajib login. Dijaga di client karena token tidak ada di cookie
// (lihat catatan di context/RoleContext.js) — tidak ada middleware Next.js.
// - belum login   → /login?next=<halaman ini>, lalu kembali ke sini setelah login
// - baru Keluar   → ke beranda (tujuan yang sama dengan tombol Keluar)
// Mengembalikan true bila konten boleh dirender.
export default function useRequireAuth() {
  const { status } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") {
      const here = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(here)}`);
    } else if (status === "signedOut") {
      router.replace("/");
    }
  }, [status, router]);

  return status === "authenticated";
}
