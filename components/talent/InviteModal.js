"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { initials } from "@/lib/mock-data";

// Modal "Ajak ke Proyek". `projects` = proyek terbuka milik UMKM yang
// sedang login (difilter FindTalentView, harus di-memo supaya pesan yang
// sedang diketik tidak ter-reset tiap render). Kalau kosong, satu-satunya
// aksi adalah melengkapi postingan proyek dulu.
export default function InviteModal({ talent: current, umkmName, projects, onClose, onSend }) {
  const [message, setMessage] = useState("");
  const [projectId, setProjectId] = useState("");
  // Talent terakhir tetap ditampilkan selama animasi tutup berjalan.
  const lastTalent = useRef(current);
  if (current) lastTalent.current = current;
  const talent = current;
  const shown = lastTalent.current;

  // Isi ulang pesan & pilihan proyek tiap kali modal dibuka untuk talent lain.
  useEffect(() => {
    if (!talent) return;
    setMessage(`Halo ${talent.name.split(" ")[0]}!\n\nSaya ingin mengajak kamu melihat proyek yang saya posting. Silakan ajukan proposal jika tersedia dan tertarik.\n\n${umkmName}`);
    setProjectId(projects[0]?.id || "");
  }, [talent, umkmName, projects]);

  const hasProjects = projects.length > 0;

  return (
    <Modal open={!!talent} onClose={onClose} title="Ajak ke Proyek">
      {shown && (
        <>
          <div className="row gap-16 mt-16">
            <div className="avatar invite-avatar" style={{ background: shown.avatarBg }}>{initials(shown.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="t-small" style={{ fontWeight: 700, textDecoration: "underline" }}>{shown.name}</div>
              <div className="t-small muted">{shown.title}</div>
            </div>
          </div>

          {hasProjects && (
            <div className="field mt-20" style={{ marginBottom: 14 }}>
              <label htmlFor="invite-project">Pilih Proyek</label>
              <select id="invite-project" className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          )}

          <div className={`field ${hasProjects ? "" : "mt-20"}`}>
            <label htmlFor="invite-message">Pesan</label>
            <textarea id="invite-message" className="input" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            {hasProjects ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!message.trim()}
                onClick={() => onSend(shown, projects.find((p) => p.id === projectId))}
              >
                Kirim Undangan
              </button>
            ) : (
              <Link href="/projects?new=1" className="btn btn-primary">Lengkapi Postingan Proyek</Link>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
