"use client";

import "../../auth.css";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { ROLES } from "@/config/roles";
import AuthShell from "@/components/auth/AuthShell";
import { FormAlert } from "@/components/auth/AuthParts";
import { IconAlert, IconCircleCheck, IconClock, IconLoader, IconShieldCheck } from "@/components/auth/AuthIcons";
import { sendCampusEmailVerification } from "@/lib/auth/api";

// Tujuan tautan verifikasi email kampus. Backend memproses tautan lalu mengarahkan ke sini
// dengan ?status=success|already_verified|expired|invalid|rejected (lihat
// VerificationController::verifyCampusEmail). Halaman ini publik dan TIDAK pernah membuat
// sesi dari tautan: kalau browser sudah punya sesi (dipulihkan RoleContext), arahkan ke
// dashboard; kalau belum, tampilkan tombol Masuk.
const ASIDE = {
  title: "Jaga kepercayaan di Digital.in.",
  text: "Verifikasi status mahasiswa memastikan UMKM bekerja dengan talenta yang benar-benar terdaftar di kampus.",
  points: [
    "Lewat email kampus atau unggah Kartu Tanda Mahasiswa (KTM)",
    "Ditinjau tim Verify & Trust, biasanya dalam 1×24 jam",
    "File KTM disimpan privat dan hanya dilihat peninjau",
  ],
};

const REDIRECT_SECONDS = 5;

const STATUS = {
  success: {
    icon: IconCircleCheck,
    title: "Email kampus terverifikasi",
    text: "Terima kasih! Status mahasiswamu sudah terverifikasi dan akunmu kini aktif.",
    done: true,
  },
  already_verified: {
    icon: IconCircleCheck,
    title: "Verifikasi sudah selesai",
    text: "Akunmu sudah terverifikasi sebelumnya, lewat email kampus atau KTM. Tidak ada lagi yang perlu dilakukan.",
    done: true,
  },
  expired: {
    icon: IconClock,
    title: "Tautan sudah kedaluwarsa",
    text: "Tautan verifikasi hanya berlaku sebentar demi keamanan. Minta tautan baru, atau verifikasi lewat unggah KTM.",
    retry: true,
  },
  invalid: {
    icon: IconAlert,
    title: "Tautan tidak valid",
    text: "Tautan ini rusak, tidak lengkap, atau sudah diganti tautan yang lebih baru. Minta tautan baru, atau verifikasi lewat unggah KTM.",
    retry: true,
  },
  rejected: {
    icon: IconAlert,
    title: "Verifikasi ditolak",
    text: "Pengajuan verifikasimu ditolak tim Verify & Trust, jadi akunmu belum aktif. Lihat alasannya dan ajukan ulang di halaman Verifikasi.",
  },
};

export default function CampusEmailStatusPage() {
  return (
    <Suspense fallback={null}>
      <CampusEmailStatus />
    </Suspense>
  );
}

function CampusEmailStatus() {
  const searchParams = useSearchParams();
  const key = STATUS[searchParams.get("status")] ? searchParams.get("status") : "invalid";
  const info = STATUS[key];
  const Icon = info.icon;
  const { status: session, role } = useRole();
  const signedIn = session === "authenticated" && !!role;

  return (
    <AuthShell aside={ASIDE}>
      <span className="au-badge-icon"><Icon size={22} /></span>
      <h1 className="au-title">{info.title}</h1>
      <p className="au-sub">{info.text}</p>

      <div className="au-form" style={{ display: "grid", gap: 12 }}>
        {session === "loading" ? (
          <p className="au-sub au-loading-line" role="status"><IconLoader size={16} className="au-spin" /> Memeriksa sesi…</p>
        ) : info.done ? (
          <DoneActions signedIn={signedIn} role={role} />
        ) : info.retry ? (
          <RetryActions signedIn={signedIn} role={role} />
        ) : (
          <VerifyPageAction signedIn={signedIn} />
        )}
      </div>
    </AuthShell>
  );
}

// success / already_verified: sesi aktif → dashboard otomatis; belum login → tombol Masuk.
function DoneActions({ signedIn, role }) {
  const router = useRouter();
  const home = (role && ROLES[role]?.home) || "/dashboard";
  const [left, setLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (!signedIn) return undefined;
    if (left <= 0) {
      router.replace(home);
      return undefined;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [signedIn, left, home, router]);

  if (!signedIn) {
    return (
      <>
        <p className="au-sub" style={{ margin: 0 }}>Masuk untuk mulai memakai Digital.in.</p>
        <Link href="/login" className="btn btn-primary btn-block btn-lg">Masuk</Link>
      </>
    );
  }
  return (
    <>
      <p className="au-sub" style={{ margin: 0 }} role="status">Mengarahkan ke dashboard dalam {Math.max(left, 0)} detik…</p>
      <Link href={home} className="btn btn-primary btn-block btn-lg">Ke dashboard sekarang</Link>
    </>
  );
}

// expired / invalid: kirim ulang tautan (perlu login sebagai mahasiswa) atau unggah KTM.
function RetryActions({ signedIn, role }) {
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);

  if (!signedIn) {
    return (
      <>
        <p className="au-sub" style={{ margin: 0 }}>Masuk dulu untuk meminta tautan baru atau mengunggah KTM.</p>
        <Link href={`/login?next=${encodeURIComponent("/verify")}`} className="btn btn-primary btn-block btn-lg">Masuk</Link>
      </>
    );
  }
  if (role !== "mahasiswa") return <VerifyPageAction signedIn />;

  async function resend() {
    if (sending) return;
    setSending(true);
    setNotice(null);
    const res = await sendCampusEmailVerification();
    setSending(false);
    setNotice(res.ok
      ? { tone: "success", title: "Tautan baru sudah dikirim", text: "Cek kotak masuk email kampusmu dan buka tautan terbaru." }
      : { tone: "error", title: res.error.message, text: "Kamu tetap bisa verifikasi lewat unggah KTM." });
  }

  return (
    <>
      {notice && <FormAlert tone={notice.tone} title={notice.title}>{notice.text}</FormAlert>}
      <button type="button" className="btn btn-primary btn-block btn-lg" onClick={resend} disabled={sending}>
        {sending ? <><IconLoader size={16} className="au-spin" /> Mengirim…</> : "Kirim ulang tautan"}
      </button>
      <Link href="/verify" className="btn btn-secondary btn-block btn-lg"><IconShieldCheck size={16} /> Unggah KTM</Link>
    </>
  );
}

// rejected (dan peran non-mahasiswa): arahan ke halaman Verifikasi, tanpa kesan akun aktif.
function VerifyPageAction({ signedIn }) {
  if (!signedIn) {
    return <Link href={`/login?next=${encodeURIComponent("/verify")}`} className="btn btn-primary btn-block btn-lg">Masuk</Link>;
  }
  return <Link href="/verify" className="btn btn-primary btn-block btn-lg">Ke halaman Verifikasi</Link>;
}
