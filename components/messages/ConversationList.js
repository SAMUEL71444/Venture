"use client";

import Icon from "@/components/Icon";
import { initials } from "@/lib/mock-data";
import { formatListTime } from "@/lib/chat";
import { MOCK_TODAY } from "@/lib/projects.mock";

// Panel kiri halaman Pesan — daftar percakapan, sudah diurutkan dari yang
// terbaru dan disaring dari luar (lihat app/messages/page.js). Komponen ini
// murni presentational.
export default function ConversationList({ conversations, activeId, onSelect, query, onQueryChange }) {
  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h2 className="t-h2" style={{ margin: 0 }}>Pesan</h2>
      </div>

      {/* "chat-search" nge-override flex:1 milik .project-search — tanpa itu
          kotak ini memanjang mengisi seluruh sisa tinggi .chat-list (karena
          .chat-list sendiri flex-column), dan ikonnya (top:50%) jadi
          melayang di tengah panel. */}
      <div className="project-search chat-search" style={{ margin: "0 16px 14px" }}>
        <Icon name="search" />
        <input
          className="input"
          placeholder="Cari nama atau proyek..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <div className="chat-list-items">
        {conversations.length === 0 ? (
          <p className="t-small muted" style={{ padding: "24px 20px", textAlign: "center" }}>
            Tidak ada percakapan yang cocok.
          </p>
        ) : (
          conversations.map((c) => {
            const last = c.messages[c.messages.length - 1];
            const isMine = last.from === "me";
            return (
              <button
                key={c.id}
                type="button"
                className={`chat-list-item ${c.id === activeId ? "active" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <span className="chat-avatar" style={{ background: c.contact.avatarBg }}>
                  {initials(c.contact.name)}
                  <span className={`online-dot ${c.contact.online ? "online" : ""}`} />
                </span>
                <span className="chat-list-main">
                  <span className="row-between">
                    <span className="t-small" style={{ fontWeight: 700 }}>{c.contact.name}</span>
                    <span className="t-caption" style={{ flexShrink: 0 }}>{formatListTime(last.at, MOCK_TODAY)}</span>
                  </span>
                  <span className="row-between">
                    <span className="chat-list-preview">
                      {isMine && <Icon name={last.status === "dibaca" ? "checkCheck" : "check"} />}
                      {isMine ? `Kamu: ${last.text}` : last.text}
                    </span>
                    {c.unread > 0 && <span className="chat-unread">{c.unread}</span>}
                  </span>
                  <span className="chat-project-tag">{c.projectTitle}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
