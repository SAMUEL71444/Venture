"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import { useRole } from "@/context/RoleContext";
import { ROLES } from "@/config/roles";

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setRole } = useRole();
  const type = searchParams.get("type") || "umkm";
  const isUmkm = type === "umkm";

  function finishAndEnter() {
    setRole(type);
    router.push(ROLES[type]?.home || "/dashboard");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="auth-brand"><div className="mark">D</div><div className="name t-h3">Digital.in</div></div>
        <div className="progress-steps"><span className="done" /><span className="done" /><span /></div>
        <h2 className="t-h2">Verifikasi {isUmkm ? "usaha" : "status mahasiswa"}</h2>
        <p className="t-small muted mt-8">Langkah ini membantu menjaga kepercayaan di platform. Prosesnya biasanya selesai dalam 1×24 jam.</p>
        <div className="mt-20">
          {isUmkm ? (
            <>
              <div className="field"><label>Nomor Induk Berusaha (NIB) — opsional</label><input className="input" placeholder="Kosongkan jika belum punya" /></div>
              <div className="field">
                <label>Unggah Foto Usaha / KTP Pemilik</label>
                <div className="card" style={{ borderStyle: "dashed", padding: 28, textAlign: "center" }}>
                  <Icon name="paperclip" />
                  <div className="t-small mt-8">Seret file ke sini atau <span className="link-btn">pilih file</span></div>
                  <div className="t-caption mt-4">JPG, PNG, atau PDF — maks 5MB</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="field"><label>Email Kampus (.ac.id)</label><input className="input" placeholder="nama@student.ac.id" /></div>
              <div className="field">
                <label>Unggah Kartu Tanda Mahasiswa (KTM)</label>
                <div className="card" style={{ borderStyle: "dashed", padding: 28, textAlign: "center" }}>
                  <Icon name="paperclip" />
                  <div className="t-small mt-8">Seret file ke sini atau <span className="link-btn">pilih file</span></div>
                  <div className="t-caption mt-4">JPG atau PNG — maks 5MB</div>
                </div>
              </div>
            </>
          )}
          <div className="card mt-16" style={{ background: "var(--info-bg)", borderColor: "transparent", padding: 14 }}>
            <div className="t-small" style={{ color: "var(--info)", fontWeight: 600 }}>
              <Icon name="shield" /> Data kamu aman dan hanya dipakai untuk proses verifikasi.
            </div>
          </div>
          <button className="btn btn-primary btn-block btn-lg mt-20" onClick={finishAndEnter}>Kirim untuk Verifikasi</button>
          <button className="btn btn-ghost btn-block mt-8" onClick={finishAndEnter}>Lewati untuk sekarang</button>
        </div>
      </div>
    </div>
  );
}
