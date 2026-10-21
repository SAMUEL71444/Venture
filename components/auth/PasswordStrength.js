import { IconCheck, IconX } from "./AuthIcons";
import { PASSWORD_RULES, passwordStrength } from "@/lib/auth/validation";

// Indikator kekuatan + checklist syarat password, diperbarui tiap ketikan.
// Aturannya sama persis dengan validasi form & backend (lib/auth/validation.js).
export default function PasswordStrength({ id, password }) {
  const { level, label } = passwordStrength(password);

  return (
    <div id={id} className="au-strength">
      <div className="au-strength-head">
        <div className={`au-strength-bar lvl-${level}`} aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <span className="au-strength-label" aria-live="polite">
          {level ? <>Kekuatan: <b>{label}</b></> : "Kekuatan password"}
        </span>
      </div>
      <ul className="au-rules">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password || "");
          return (
            <li key={r.id} className={ok ? "ok" : ""}>
              {ok ? <IconCheck size={14} /> : <IconX size={14} />}
              <span>{r.label}</span>
              <span className="sr-only">{ok ? " — terpenuhi" : " — belum terpenuhi"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
