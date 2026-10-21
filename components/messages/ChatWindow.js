"use client";

import { useEffect, useRef } from "react";
import Icon from "@/components/Icon";
import ChatComposer from "./ChatComposer";
import { initials } from "@/lib/mock-data";
import { dayLabel, formatClock } from "@/lib/chat";
import { MOCK_TODAY } from "@/lib/projects.mock";

// `nav` (opsional): { index, total, onPrev, onNext } — kalau dikasih,
// tampilkan panah+titik indikator dan aktifkan swipe sentuh kiri/kanan buat
// pindah percakapan tanpa balik ke daftar dulu (dipakai di ChatWidget & mode
// sempit halaman /messages).
export default function ChatWindow({ conversation, projectMeta, onBack, onOpenProjectDetail, onSend, onAttach, nav }) {
  const listRef = useRef(null);
  const touchStart = useRef(null);

  function handleTouchStart(e) {
    if (!nav) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e) {
    if (!nav || !touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    // Ambang 60px, dan harus lebih horizontal daripada vertikal — biar nggak
    // ke-trigger pas orang cuma scroll pesan ke atas/bawah.
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) nav.onNext(); else nav.onPrev();
    }
  }

  // Auto-scroll HANYA kontainer pesan (.chat-messages), bukan seluruh
  // halaman — makanya pakai scrollTop langsung, bukan scrollIntoView (yang
  // ikut menggulir elemen induk dan sering berhenti di tengah kalau layout
  // belum settle). rAF nunggu satu frame supaya tinggi konten sudah pasti.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [conversation?.id]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !conversation) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.messages.length]);

  if (!conversation) {
    return (
      <div className="chat-window chat-window-empty">
        <div className="chat-empty-icon"><Icon name="chat" /></div>
        <h2 className="t-h2">Pilih Percakapan</h2>
        <p className="t-body muted" style={{ maxWidth: 320, textAlign: "center" }}>
          Pilih salah satu percakapan di sebelah kiri untuk mulai chat.
        </p>
      </div>
    );
  }

  const msgs = conversation.messages;
  let lastDay = null;

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-left">
          <button type="button" className="icon-btn chat-back-btn" onClick={onBack} aria-label="Kembali ke daftar percakapan">
            <Icon name="chevLeft" />
          </button>

          <span className="chat-avatar" style={{ background: conversation.contact.avatarBg }}>
            {initials(conversation.contact.name)}
            <span className={`online-dot ${conversation.contact.online ? "online" : ""}`} />
          </span>

          <div className="chat-header-info">
            <div className="t-small" style={{ fontWeight: 700 }}>{conversation.contact.name}</div>
            <div className="t-caption">{conversation.contact.online ? "Online" : conversation.lastSeenLabel}</div>
          </div>
        </div>

        <div className="chat-header-project">
          <span className="chip">{conversation.projectTitle}</span>
          {projectMeta && (
            <span className={`badge ${projectMeta.badgeClass}`}>
              <Icon name={projectMeta.icon} /> {projectMeta.label}
            </span>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenProjectDetail}>
            Detail Proyek
          </button>
        </div>
      </div>

      {nav && nav.total > 1 && (
        <div className="chat-nav-bar">
          <button type="button" className="chat-nav-btn" onClick={nav.onPrev} aria-label="Percakapan sebelumnya">
            <Icon name="chevLeft" />
          </button>
          <div className="chat-nav-dots">
            {Array.from({ length: nav.total }).map((_, i) => (
              <span key={i} className={`chat-nav-dot ${i === nav.index ? "active" : ""}`} />
            ))}
          </div>
          <button type="button" className="chat-nav-btn" onClick={nav.onNext} aria-label="Percakapan berikutnya">
            <Icon name="chevRight" />
          </button>
        </div>
      )}

      <div className="chat-messages" ref={listRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {msgs.map((m, i) => {
          const label = dayLabel(m.at, MOCK_TODAY);
          const showDay = label !== lastDay;
          lastDay = label;

          const prev = msgs[i - 1];
          const next = msgs[i + 1];
          const prevSameGroup = !showDay && prev && prev.from === m.from;
          const nextSameGroup = !!next && dayLabel(next.at, MOCK_TODAY) === label && next.from === m.from;
          const firstInGroup = !prevSameGroup;
          const lastInGroup = !nextSameGroup;

          return (
            <div key={m.id}>
              {showDay && <div className="chat-day"><span>{label}</span></div>}
              <div className={`msg-row ${m.from === "me" ? "me" : "them"} ${firstInGroup && !showDay ? "new-group" : ""}`}>
                {m.from === "them" && (
                  firstInGroup ? (
                    <span className="msg-avatar" style={{ background: conversation.contact.avatarBg }}>
                      {initials(conversation.contact.name)}
                    </span>
                  ) : (
                    <span className="msg-avatar-spacer" />
                  )
                )}
                <div className={`bubble ${m.from === "me" ? "me" : "them"} ${firstInGroup ? "first" : ""} ${lastInGroup ? "last" : ""}`}>
                  <div className="bubble-text">{m.text}</div>
                  {m.attachment && (
                    <div className="bubble-attachment"><Icon name="paperclip" /> {m.attachment.name}</div>
                  )}
                  <div className="bubble-meta">
                    <span>{formatClock(m.at)}</span>
                    {m.from === "me" && (
                      <Icon name={m.status === "dibaca" ? "checkCheck" : "check"} className={m.status === "dibaca" ? "read-tick" : ""} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ChatComposer onSend={onSend} onAttach={onAttach} />
    </div>
  );
}
