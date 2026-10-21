"use client";

import "../auth.css";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRole } from "@/context/RoleContext";
import AuthShell, { usePolicy } from "@/components/auth/AuthShell";
import ContactField from "@/components/auth/ContactField";
import PasswordInput from "@/components/auth/PasswordInput";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { FieldError, FormAlert, SubmitButton, SignupSteps, useCountdown } from "@/components/auth/AuthParts";
import { IconCircleCheck, IconLoader } from "@/components/auth/AuthIcons";
import {
  validateRegister, validateIdentifier, normalizeIdentifier, displayIdentifier, formatCountdown,
} from "@/lib/auth/validation";
import { sendOtp, register, getUniversities } from "@/lib/auth/api";
import { savePending, readProof, clearSignup } from "@/lib/auth/signup-flow";

// Alur daftar (OTP DULU, baru akun dibuat):
// 1. /register?type=…            pilih kanal + kontak → kirim OTP
// 2. /verify-email?…             masukkan kode → dapat verification_token
// 3. /register?type=…&step=data  lengkapi data akun → POST register
// 4. /verify?type=…              verifikasi identitas (halaman yang sudah ada)
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
    emailPlaceholder: "nama@email.com",
    title: "Buat akun mahasiswa",
    aside: {
      title: "Bangun portofolio dari proyek nyata.",
      text: "Kerjakan proyek UMKM sesuai jadwal kuliahmu dan dapatkan penghasilan pertamamu.",
      points: ["Pembayaran dijamin lewat escrow", "Proyek fleksibel, bisa dikerjakan remote", "Riwayat proyek jadi portofolio terverifikasi"],
    },
  },
};

function RegisterContent() {
  const searchParams = useSearchParams();
  const type = TYPES[searchParams.get("type")] ? searchParams.get("type") : "umkm";
  const t = TYPES[type];
  const wantsDetails = searchParams.get("step") === "data";

  // Bukti verifikasi dibaca setelah mount (sessionStorage) — hindari hydration mismatch.
  const [proof, setProof] = useState(undefined);
  useEffect(() => {
    setProof(wantsDetails ? readProof(type) : null);
  }, [type, wantsDetails]);

  return (
    <AuthShell aside={t.aside} topLink={{ text: "Sudah punya akun?", label: "Masuk", href: "/login" }}>
      {proof === undefined ? null : proof ? (
        <DetailsForm type={type} t={t} proof={proof} />
      ) : (
        <ContactStep
          type={type} t={t}
          expired={wantsDetails}
          initialChannel={searchParams.get("channel")}
          initialIdentifier={searchParams.get("identifier")}
        />
      )}
    </AuthShell>
  );
}

// --- Langkah 1: kanal + kontak → kirim OTP -----------------------------------
function ContactStep({ type, t, expired, initialChannel, initialIdentifier }) {
  const router = useRouter();
  const [channel, setChannel] = useState(initialChannel === "whatsapp" ? "whatsapp" : "email");
  const [value, setValue] = useState(initialIdentifier || "");
  const [error, setError] = useState(null);
  const [taken, setTaken] = useState(false);
  const [formError, setFormError] = useState(
    expired ? { tone: "warning", title: "Verifikasi kontak sudah kedaluwarsa", text: "Kirim kode baru untuk melanjutkan pendaftaran." } : null,
  );
  const [loading, setLoading] = useState(false);
  const [waitUntil, setWaitUntil] = useState(null);
  const waitLeft = useCountdown(waitUntil);
  const inputRef = useRef(null);

  function changeChannel(next) {
    if (next === channel) return;
    setChannel(next);
    setValue("");
    setError(null);
    setTaken(false);
  }

  function change(v) {
    setValue(v);
    setTaken(false);
    if (error) setError(validateIdentifier(channel, v));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || waitLeft > 0) return;
    const err = validateIdentifier(channel, value);
    setError(err);
    setFormError(null);
    if (err) return inputRef.current?.focus();

    const identifier = normalizeIdentifier(channel, value);
    setLoading(true);
    const res = await sendOtp({ purpose: "register", channel, identifier });
    setLoading(false);

    if (res.ok) {
      clearSignup();
      savePending({ type, channel, identifier, expiresAt: res.data.expiresAt, resendAt: Date.now() + res.data.resendAfter * 1000 });
      router.push(`/verify-email?${new URLSearchParams({ type, channel, identifier })}`);
      return;
    }
    const r = res.error;
    if (r.code === "IDENTIFIER_TAKEN") {
      setError(channel === "email" ? "Email sudah terdaftar" : "Nomor WhatsApp sudah terdaftar");
      setTaken(true);
      return inputRef.current?.focus();
    }
    if (r.code === "VALIDATION") {
      setError(r.fields?.identifier || r.message);
      return inputRef.current?.focus();
    }
    if (r.code === "OTP_COOLDOWN") {
      // Kode masih aktif dari permintaan sebelumnya → langsung ke halaman kode.
      savePending({ type, channel, identifier, expiresAt: null, resendAt: Date.now() + r.retryAfter * 1000 });
      router.push(`/verify-email?${new URLSearchParams({ type, channel, identifier })}`);
      return;
    }
    if (r.code === "RATE_LIMITED") setWaitUntil(Date.now() + r.retryAfter * 1000);
    setFormError({ tone: r.code === "RATE_LIMITED" ? "warning" : "error", title: r.message });
  }

  return (
    <>
      <SignupSteps current={0} />
      <h1 className="au-title">{t.title}</h1>
      <p className="au-sub">
        Mendaftar sebagai <b>{t.label}</b> · <Link href="/choose-type" className="link-btn">Ganti</Link>
      </p>
      <p className="au-sub">Verifikasi email atau nomor WhatsApp dulu, lalu lengkapi data akunmu.</p>

      <form className="au-form" onSubmit={handleSubmit} noValidate>
        {formError && <FormAlert tone={formError.tone} title={formError.title}>{formError.text}</FormAlert>}

        <ContactField
          idPrefix="reg" channel={channel} onChannelChange={changeChannel}
          value={value} onChange={change} inputRef={inputRef} emailPlaceholder={t.emailPlaceholder}
          onBlur={() => value && setError(validateIdentifier(channel, value))}
          error={error}
          errorAction={taken && <Link href="/login" className="au-error-link">Masuk ke akunmu</Link>}
        />

        <SubmitButton loading={loading} disabled={waitLeft > 0} loadingText="Mengirim kode…">
          {waitLeft > 0 ? `Coba lagi dalam ${formatCountdown(waitLeft)}` : "Kirim kode verifikasi"}
        </SubmitButton>
      </form>

      <p className="au-switch">
        Sudah punya akun? <Link href="/login" className="link-btn">Masuk</Link>
      </p>
    </>
  );
}

// --- Langkah 2: data akun per peran ---------------------------------------------
const FIELD_ORDER = ["name", "university", "campusEmail", "city", "password", "confirm"];

function DetailsForm({ type, t, proof }) {
  const router = useRouter();
  const policy = usePolicy();
  const { setRole } = useRole();
  const [values, setValues] = useState({ name: "", city: "", university: "", campusEmail: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [universities, setUniversities] = useState(type === "mahasiswa" ? null : []);
  const [uniError, setUniError] = useState(false);
  const formRef = useRef(null);
  const touched = useRef({});
  const proofLeft = useCountdown(proof.expiresAt);
  const proofExpired = proofLeft === 0;

  const opts = { type, nameLabel: t.nameLabel };
  const errorOf = (field, v) => validateRegister({ ...v, agree: true }, opts)[field];

  useEffect(() => {
    if (type !== "mahasiswa") return;
    let alive = true;
    getUniversities().then((res) => {
      if (!alive) return;
      if (res.ok) setUniversities(res.data);
      else setUniError(true);
    });
    return () => { alive = false; };
  }, [type]);

  function change(field, value) {
    const next = { ...values, [field]: value };
    setValues(next);
    setFormError(null);
    setErrors((e) => {
      const upd = { ...e };
      if (e[field]) upd[field] = errorOf(field, next);
      if (field === "password" && next.confirm && (e.confirm || touched.current.confirm)) upd.confirm = errorOf("confirm", next);
      return upd;
    });
  }

  function blur(field) {
    touched.current[field] = true;
    if (!values[field]) return;
    setErrors((e) => ({ ...e, [field]: errorOf(field, values) }));
  }

  function focusFirst(errs) {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first) formRef.current?.querySelector(`[name="reg-${first}"]`)?.focus();
  }

  // Kembali ke langkah 1 dengan kontak terisi; RegisterContent membaca URL baru.
  function restart() {
    clearSignup();
    router.replace(`/register?${new URLSearchParams({ type, channel: proof.channel, identifier: proof.identifier })}`);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || !agree || proofExpired) return;
    const errs = validateRegister({ ...values, agree }, opts);
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return focusFirst(errs);

    setLoading(true);
    const res = await register({ type, channel: proof.channel, identifier: proof.identifier, token: proof.token, values });
    setLoading(false);

    if (res.ok) {
      clearSignup();
      setRole(res.data.user.appRole);
      router.push(`/verify?type=${type}`);
      return;
    }
    const r = res.error;
    if (r.code === "VALIDATION" && r.fields && Object.keys(r.fields).some((f) => FIELD_ORDER.includes(f))) {
      setErrors(r.fields);
      return focusFirst(r.fields);
    }
    if (r.code === "VERIFICATION_EXPIRED") {
      clearSignup();
      setFormError({ code: r.code, title: r.message });
      return;
    }
    if (r.code === "IDENTIFIER_TAKEN") {
      setFormError({ code: r.code, title: "Kontak ini sudah terdaftar", text: "Masuk dengan akun tersebut atau gunakan kontak lain." });
      return;
    }
    setFormError({ code: r.code, title: r.message });
  }

  const field = (name) => ({
    name: `reg-${name}`,
    "aria-invalid": !!errors[name] || undefined,
    "aria-describedby": errors[name] ? `reg-${name}-err` : undefined,
  });

  const showExpired = proofExpired || formError?.code === "VERIFICATION_EXPIRED";

  return (
    <>
      <SignupSteps current={1} />
      <h1 className="au-title">Lengkapi data akun</h1>
      <p className="au-sub">
        Mendaftar sebagai <b>{t.label}</b>
      </p>

      <div className="au-verified">
        <IconCircleCheck size={18} />
        <span><b>{displayIdentifier(proof.channel, proof.identifier)}</b> terverifikasi</span>
        <button type="button" className="link-btn" onClick={restart}>Ganti</button>
      </div>

      <form ref={formRef} className="au-form" onSubmit={handleSubmit} noValidate>
        {showExpired ? (
          <FormAlert
            tone="warning" title="Verifikasi kontak sudah kedaluwarsa"
            action={<button type="button" className="btn btn-secondary btn-sm" onClick={restart}>Kirim kode baru</button>}
          >
            Demi keamanan, data harus dikirim dalam beberapa menit setelah kode diverifikasi.
          </FormAlert>
        ) : formError ? (
          <FormAlert
            title={formError.title}
            action={formError.code === "IDENTIFIER_TAKEN" && <Link href="/login" className="btn btn-secondary btn-sm">Masuk</Link>}
          >
            {formError.text}
          </FormAlert>
        ) : (
          proofLeft <= 120 && <p className="au-hint au-hint-left">Selesaikan dalam <b>{formatCountdown(proofLeft)}</b> sebelum verifikasi kedaluwarsa.</p>
        )}

        <div className="field">
          <label htmlFor="reg-name">{t.nameLabel}</label>
          <input
            id="reg-name" {...field("name")} className="input au-input" placeholder={t.namePlaceholder}
            autoComplete={type === "umkm" ? "organization" : "name"} maxLength={80}
            value={values.name} onChange={(e) => change("name", e.target.value)} onBlur={() => blur("name")}
          />
          <FieldError id="reg-name-err" message={errors.name} />
        </div>

        {type === "umkm" && (
          <div className="field">
            <label htmlFor="reg-city">Kota <span className="au-optional">(opsional)</span></label>
            <input
              id="reg-city" {...field("city")} className="input au-input" placeholder="contoh: Bandung"
              autoComplete="address-level2" maxLength={120}
              value={values.city} onChange={(e) => change("city", e.target.value)}
            />
            <FieldError id="reg-city-err" message={errors.city} />
          </div>
        )}

        {type === "mahasiswa" && (
          <>
            <div className="field">
              <label htmlFor="reg-university">Universitas</label>
              {universities === null && !uniError ? (
                <p className="au-sub au-loading-line"><IconLoader size={16} className="au-spin" /> Memuat daftar universitas…</p>
              ) : uniError ? (
                <FormAlert title="Daftar universitas tidak dapat dimuat" />
              ) : universities.length === 0 ? (
                <FormAlert tone="warning" title="Belum ada universitas terdaftar">
                  Hubungi tim Digital.in agar kampusmu ditambahkan.
                </FormAlert>
              ) : (
                <select
                  id="reg-university" {...field("university")} className="input au-input"
                  value={values.university} onChange={(e) => change("university", e.target.value)} onBlur={() => blur("university")}
                >
                  <option value="">Pilih universitas</option>
                  {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
              <FieldError id="reg-university-err" message={errors.university} />
            </div>

            <div className="field">
              <label htmlFor="reg-campusEmail">Email kampus <span className="au-optional">(opsional)</span></label>
              <input
                id="reg-campusEmail" {...field("campusEmail")} type="email" className="input au-input"
                placeholder="nama@student.ac.id" autoComplete="off" inputMode="email"
                value={values.campusEmail} onChange={(e) => change("campusEmail", e.target.value)} onBlur={() => blur("campusEmail")}
              />
              {errors.campusEmail
                ? <FieldError id="reg-campusEmail-err" message={errors.campusEmail} />
                : <p className="au-hint au-hint-left">Isi untuk verifikasi status mahasiswa lewat tautan email. Bisa juga lewat unggah KTM nanti.</p>}
            </div>
          </>
        )}

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

        <SubmitButton loading={loading} disabled={!agree || showExpired} loadingText="Membuat akun…">Buat Akun</SubmitButton>
        {!agree && <p className="au-hint">Centang persetujuan di atas untuk melanjutkan.</p>}
      </form>
    </>
  );
}
