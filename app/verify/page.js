"use client";

import "../auth.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import { ROLES } from "@/config/roles";
import AuthShell from "@/components/auth/AuthShell";
import { FieldError, FormAlert, SubmitButton, SignupSteps } from "@/components/auth/AuthParts";
import { IconCircleCheck, IconLoader, IconMail, IconShieldCheck } from "@/components/auth/AuthIcons";
import SessionLoading from "@/components/layout/SessionLoading";
import useRequireAuth from "@/components/layout/useRequireAuth";
import { getMyProfile, uploadKtm, sendCampusEmailVerification } from "@/lib/auth/api";
import { validateKtmFile, KTM_EXTENSIONS } from "@/lib/auth/validation";

// Verifikasi identitas (wajib login, peran dari sesi):
// - mahasiswa → status verifikasi dari /me/profile, unggah KTM (POST
//   students/me/verification), kirim ulang tautan email kampus.
// - trust (ADMIN) → antrean verifikasi (/verifications).
// - UMKM → info: akun UMKM tidak memerlukan verifikasi saat ini.
const ASIDE = {
  title: "Jaga kepercayaan di Digital.in.",
  text: "Verifikasi status mahasiswa memastikan UMKM bekerja dengan talenta yang benar-benar terdaftar di kampus.",
  points: [
    "Lewat email kampus atau unggah Kartu Tanda Mahasiswa (KTM)",
    "Ditinjau tim Verify & Trust, biasanya dalam 1×24 jam",
    "File KTM disimpan privat dan hanya dilihat peninjau",
  ],
};

export default function VerifyPage() {
  const router = useRouter();
  const signedIn = useRequireAuth();
  const { role } = useRole();

  useEffect(() => {
    if (signedIn && role === "trust") router.replace("/verifications");
  }, [signedIn, role, router]);

  if (!signedIn || !role || role === "trust") return <SessionLoading />;
  if (role === "umkm") return <UmkmInfo />;
  return <StudentVerification />;
}

function UmkmInfo() {
  return (
    <AuthShell aside={ASIDE}>
      <span className="au-badge-icon"><IconCircleCheck size={22} /></span>
      <h1 className="au-title">Akun UMKM siap dipakai</h1>
      <p className="au-sub">Akun UMKM tidak memerlukan verifikasi dokumen saat ini. Kamu bisa langsung memposting proyek dan mencari talenta.</p>
      <Link href={ROLES.umkm.home} className="btn btn-primary btn-block btn-lg">Ke dashboard</Link>
    </AuthShell>
  );
}

function StudentVerification() {
  const { refreshAuthUser } = useRole();
  const [data, setData] = useState(null); // { user, profile }
  const [loadError, setLoadError] = useState(null);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null); // { tone, title, text }
  const [sendingEmail, setSendingEmail] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await getMyProfile();
    if (!res.ok) {
      setLoadError(res.error.message);
      return;
    }
    setData(res.data);
    // Status akun bisa berubah (mis. sudah disetujui admin) → banner & penjagaan ikut diperbarui.
    refreshAuthUser();
  }, [refreshAuthUser]);

  useEffect(() => { load(); }, [load]);

  function pickFile(f) {
    setFile(f || null);
    setFileError(f ? validateKtmFile(f) : null);
    setNotice(null);
  }

  async function submitKtm(e) {
    e.preventDefault();
    if (uploading) return;
    const err = validateKtmFile(file);
    setFileError(err);
    if (err) return fileRef.current?.focus();

    setUploading(true);
    const res = await uploadKtm(file);
    setUploading(false);
    if (res.ok) {
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setNotice({ tone: "success", title: "KTM berhasil dikirim", text: "Tim Verify & Trust akan meninjau dokumenmu, biasanya dalam 1×24 jam." });
      load();
      return;
    }
    if (res.error.code === "VALIDATION") setFileError(res.error.fields?.ktm || res.error.message);
    else if (res.error.code === "VERIFICATION_ATTEMPTS_EXCEEDED") {
      setNotice({ tone: "error", title: res.error.message, text: "Hubungi tim Digital.in lewat Pusat Bantuan." });
      load();
    } else setNotice({ tone: "error", title: res.error.message });
  }

  async function resendCampusEmail() {
    if (sendingEmail) return;
    setSendingEmail(true);
    setNotice(null);
    const res = await sendCampusEmailVerification();
    setSendingEmail(false);
    if (res.ok) {
      setNotice({ tone: "success", title: "Tautan verifikasi dikirim ulang", text: `Cek kotak masuk ${data.profile.campus_email}. Tautan berlaku 60 menit.` });
      return;
    }
    if (res.error.code === "CAMPUS_EMAIL_NOT_AVAILABLE") {
      setNotice({ tone: "warning", title: res.error.message, text: "Pilih file KTM di bawah untuk melanjutkan." });
      fileRef.current?.focus();
      return;
    }
    if (res.error.code === "ALREADY_PROCESSED") {
      load();
      return;
    }
    setNotice({ tone: res.error.code === "RATE_LIMITED" ? "warning" : "error", title: res.error.message });
  }

  if (!data) {
    return (
      <AuthShell aside={ASIDE}>
        <h1 className="au-title">Verifikasi status mahasiswa</h1>
        {loadError ? (
          <FormAlert title={loadError} action={<button type="button" className="btn btn-secondary btn-sm" onClick={load}>Coba lagi</button>} />
        ) : (
          <p className="au-sub au-loading-line"><IconLoader size={16} className="au-spin" /> Memuat status verifikasi…</p>
        )}
      </AuthShell>
    );
  }

  const { user, profile } = data;
  const status = profile?.verification_status;
  const verified = user.status === "ACTIVE" || status === "VERIFIED";
  const rejected = !verified && status === "REJECTED";
  const waiting = !verified && status === "PENDING" && profile?.has_ktm;
  // Ditolak: boleh unggah ulang selama masih ada sisa kesempatan (maks. 3 pengajuan).
  const remaining = profile?.verification_attempts_remaining ?? 0;
  const canResubmit = rejected && remaining > 0;
  const canUpload = !verified && (status === "PENDING" || canResubmit) && !profile?.campus_email_verified_at;
  const canResendEmail = !verified && status === "PENDING" && !profile?.campus_email_verified_at && !!profile?.campus_email;
  const university = profile?.university?.name || profile?.university_name_custom;

  return (
    <AuthShell aside={ASIDE}>
      {!verified && <SignupSteps current={2} />}
      <span className="au-badge-icon"><IconShieldCheck size={22} /></span>
      <h1 className="au-title">Verifikasi status mahasiswa</h1>
      {university && <p className="au-sub">Kampus: <b>{university}</b></p>}

      {verified ? (
        <FormAlert tone="success" title="Akun aktif" action={<Link href={ROLES.mahasiswa.home} className="btn btn-primary btn-sm">Ke dashboard</Link>}>
          Status mahasiswamu sudah terverifikasi. Semua fitur sudah bisa dipakai.
        </FormAlert>
      ) : rejected ? (
        <FormAlert title="Verifikasi ditolak" action={!canResubmit && <Link href="/help" className="btn btn-secondary btn-sm">Pusat Bantuan</Link>}>
          {profile.verification_rejection_reason ? <>Alasan: {profile.verification_rejection_reason}. </> : null}
          {canResubmit
            ? <>Perbaiki lalu unggah ulang KTM di bawah. Sisa kesempatan: <b>{remaining}</b> dari 3.</>
            : <>Batas 3 kali pengajuan sudah tercapai. Hubungi tim Digital.in lewat Pusat Bantuan.</>}
        </FormAlert>
      ) : waiting ? (
        <FormAlert tone="info" title="Menunggu review">
          KTM sudah kami terima dan sedang ditinjau tim Verify &amp; Trust (biasanya 1×24 jam). Kamu masih bisa mengganti file selama belum ditinjau.
        </FormAlert>
      ) : (
        <FormAlert tone="warning" title="Belum mengajukan verifikasi">
          {canResendEmail ? "Klik tautan di email kampusmu, atau unggah KTM." : "Unggah Kartu Tanda Mahasiswa (KTM) untuk diverifikasi."}
        </FormAlert>
      )}

      {notice && <FormAlert tone={notice.tone} title={notice.title}>{notice.text}</FormAlert>}

      {canResendEmail && (
        <div className="au-resend">
          <span><IconMail size={15} /> Tautan dikirim ke <b className="au-email">{profile.campus_email}</b></span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resendCampusEmail} disabled={sendingEmail}>
            {sendingEmail ? "Mengirim…" : "Kirim ulang email verifikasi"}
          </button>
        </div>
      )}

      {canUpload && (
        <form className="au-form" onSubmit={submitKtm} noValidate>
          <div className="field">
            <label htmlFor="verify-ktm">{waiting ? "Ganti file KTM" : canResubmit ? "Unggah ulang KTM" : "Unggah KTM"}</label>
            <input
              ref={fileRef} id="verify-ktm" name="ktm" type="file" className="input au-input"
              accept={KTM_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
              onChange={(e) => pickFile(e.target.files?.[0])}
              aria-invalid={!!fileError || undefined} aria-describedby={fileError ? "verify-ktm-err" : "verify-ktm-hint"}
            />
            {fileError
              ? <FieldError id="verify-ktm-err" message={fileError} />
              : <p id="verify-ktm-hint" className="au-hint au-hint-left">PDF, JPG, atau PNG — maksimal 5 MB.</p>}
          </div>
          <SubmitButton loading={uploading} disabled={!file} loadingText="Mengunggah…">Kirim untuk verifikasi</SubmitButton>
        </form>
      )}

      {!verified && (
        <p className="au-switch">
          <Link href={ROLES.mahasiswa.home} className="link-btn">Nanti saja, ke dashboard</Link>
        </p>
      )}
    </AuthShell>
  );
}
