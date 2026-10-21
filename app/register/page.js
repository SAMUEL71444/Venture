"use client";

import "../auth.css";
import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell, { usePolicy } from "@/components/auth/AuthShell";
import PasswordInput from "@/components/auth/PasswordInput";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { FieldError, FormAlert, SubmitButton, SignupSteps } from "@/components/auth/AuthParts";
import { validateRegister } from "@/lib/auth/validation";
import { register } from "@/lib/auth/api";

// useSearchParams wajib dibungkus <Suspense> di App Router.
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}

const TYPES = {
  umkm: {
    label: "Pemilik UMKM",
    nameLabel: "Nama usaha",
    namePlaceholder: "contoh: Kopi Anteng",
    emailPlaceholder: "nama@usaha.com",
    title: "Daftarkan usahamu",
    aside: {
      title: "Bawa usahamu naik kelas secara digital.",
      text: "Temukan mahasiswa berbakat untuk konten, desain, website, sampai pembukuan.",
      points: ["Gratis mendaftar dan memposting proyek", "Bayar per milestone — dana aman di escrow", "Talenta mahasiswa terverifikasi kampusnya"],
    },
  },
  mahasiswa: {
    label: "Mahasiswa",
    nameLabel: "Nama lengkap",
    namePlaceholder: "contoh: Nadia Putri",
    emailPlaceholder: "nama@student.ac.id",
    title: "Buat akun mahasiswa",
    aside: {
      title: "Bangun portofolio dari proyek nyata.",
      text: "Kerjakan proyek UMKM sesuai jadwal kuliahmu dan dapatkan penghasilan pertamamu.",
      points: ["Pembayaran dijamin lewat escrow", "Proyek fleksibel, bisa dikerjakan remote", "Riwayat proyek jadi portofolio terverifikasi"],
    },
  },
};

const FIELD_ORDER = ["name", "email", "password", "confirm"];

function RegisterContent() {
  const searchParams = useSearchParams();
  const type = TYPES[searchParams.get("type")] ? searchParams.get("type") : "umkm";
  const t = TYPES[type];

  return (
    <AuthShell aside={t.aside} topLink={{ text: "Sudah punya akun?", label: "Masuk", href: "/login" }}>
      <RegisterForm type={type} t={t} />
    </AuthShell>
  );
}

// Dipisah dari RegisterContent supaya bisa memakai usePolicy() (provider ada
// di dalam AuthShell).
function RegisterForm({ type, t }) {
  const router = useRouter();
  const policy = usePolicy();
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [emailTaken, setEmailTaken] = useState(false);
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);
  const touched = useRef({}); // field yang sudah pernah ditinggalkan (blur)

  const opts = { nameLabel: t.nameLabel };
  // Pesan untuk satu field, dihitung dengan aturan yang sama seperti backend.
  const errorOf = (field, v) => validateRegister({ ...v, agree: true }, opts)[field];

  function change(field, value) {
    const next = { ...values, [field]: value };
    setValues(next);
    setFormError(null);
    if (field === "email") setEmailTaken(false);
    setErrors((e) => {
      const upd = { ...e };
      // Field yang sudah bermasalah divalidasi ulang tiap ketikan → error
      // langsung hilang begitu diperbaiki.
      if (e[field]) upd[field] = errorOf(field, next);
      // Ganti password ikut memeriksa ulang konfirmasi yang sudah diisi.
      if (field === "password" && next.confirm && (e.confirm || touched.current.confirm)) upd.confirm = errorOf("confirm", next);
      return upd;
    });
  }

  // Validasi saat meninggalkan field (hanya kalau sudah diisi, supaya tidak
  // "memarahi" field yang baru dilewati).
  function blur(field) {
    touched.current[field] = true;
    if (!values[field]) return;
    setErrors((e) => ({ ...e, [field]: errorOf(field, values) }));
  }

  function focusFirst(errs) {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first) formRef.current?.querySelector(`[name="reg-${first}"]`)?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || !agree) return;
    const errs = validateRegister({ ...values, agree }, opts);
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return focusFirst(errs);

    setLoading(true);
    const res = await register({ ...values, agree, role: type, nameLabel: t.nameLabel });
    setLoading(false);

    if (res.ok) {
      setValues((v) => ({ ...v, password: "", confirm: "" }));
      router.push(`/verify-email?email=${encodeURIComponent(res.data.email)}`);
      return;
    }
    const err = res.error;
    if (err.code === "EMAIL_TAKEN" || err.code === "VALIDATION") {
      // Hasil validasi BACKEND — ditampilkan di field yang sama.
      setErrors(err.fields || {});
      setEmailTaken(err.code === "EMAIL_TAKEN");
      focusFirst(err.fields || {});
      return;
    }
    setFormError(err);
  }

  const field = (name) => ({
    name: `reg-${name}`,
    "aria-invalid": !!errors[name] || undefined,
    "aria-describedby": errors[name] ? `reg-${name}-err` : undefined,
  });

  return (
    <>
      <SignupSteps current={0} />
      <h1 className="au-title">{t.title}</h1>
      <p className="au-sub">
        Mendaftar sebagai <b>{t.label}</b> · <Link href="/choose-type" className="link-btn">Ganti</Link>
      </p>

      <form ref={formRef} className="au-form" onSubmit={handleSubmit} noValidate>
        {formError && <FormAlert title={formError.message} />}

        <div className="field">
          <label htmlFor="reg-name">{t.nameLabel}</label>
          <input
            id="reg-name" {...field("name")} className="input au-input" placeholder={t.namePlaceholder}
            autoComplete={type === "umkm" ? "organization" : "name"} maxLength={80}
            value={values.name} onChange={(e) => change("name", e.target.value)} onBlur={() => blur("name")}
          />
          <FieldError id="reg-name-err" message={errors.name} />
        </div>

        <div className="field">
          <label htmlFor="reg-email">Email</label>
          <input
            id="reg-email" {...field("email")} type="email" className="input au-input" placeholder={t.emailPlaceholder}
            autoComplete="email" inputMode="email"
            value={values.email} onChange={(e) => change("email", e.target.value)} onBlur={() => blur("email")}
          />
          {errors.email && (
            <p id="reg-email-err" className="au-error">
              <span>{errors.email}</span>
              {emailTaken && <> · <Link href="/login" className="au-error-link">Masuk ke akunmu</Link></>}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="reg-password">Password</label>
          <PasswordInput
            id="reg-password" value={values.password} onChange={(e) => change("password", e.target.value)}
            onBlur={() => blur("password")} autoComplete="new-password" placeholder="Buat password"
            invalid={!!errors.password}
            describedBy={["reg-password-rules", errors.password && "reg-password-err"].filter(Boolean).join(" ")}
          />
          <FieldError id="reg-password-err" message={errors.password} />
          <PasswordStrength id="reg-password-rules" password={values.password} />
        </div>

        <div className="field">
          <label htmlFor="reg-confirm">Konfirmasi password</label>
          <PasswordInput
            id="reg-confirm" value={values.confirm} onChange={(e) => change("confirm", e.target.value)}
            onBlur={() => blur("confirm")} autoComplete="new-password" placeholder="Ketik ulang password"
            invalid={!!errors.confirm} describedBy={errors.confirm ? "reg-confirm-err" : undefined}
          />
          <FieldError id="reg-confirm-err" message={errors.confirm} />
        </div>

        <label className="au-check au-agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            Saya menyetujui{" "}
            <button type="button" className="link-btn" onClick={() => policy.open("syarat")}>Syarat &amp; Ketentuan</button>
            {" "}dan{" "}
            <button type="button" className="link-btn" onClick={() => policy.open("privasi")}>Kebijakan Privasi</button>
            {" "}Digital.in.
          </span>
        </label>

        <SubmitButton loading={loading} disabled={!agree} loadingText="Membuat akun…">Buat Akun</SubmitButton>
        {!agree && <p className="au-hint" id="reg-agree-hint">Centang persetujuan di atas untuk melanjutkan.</p>}
      </form>

      <p className="au-switch">
        Sudah punya akun? <Link href="/login" className="link-btn">Masuk</Link>
      </p>
    </>
  );
}
