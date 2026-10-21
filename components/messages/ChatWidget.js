"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import ProjectDetailDrawer from "@/components/projects/ProjectDetailDrawer";
import { useChat } from "@/context/ChatContext";
import { useRole } from "@/context/RoleContext";
import { STATUS_META, MOCK_TODAY } from "@/lib/projects.mock";
import { unreadCount, formatLastSeen } from "@/lib/chat";

// Bubble chat melayang, dirender sekali di app/layout.js buat semua
// halaman. Tampilnya sekarang ditentukan config/roles.js (features.chatWidget
// per role — lihat CATATAN di bawah), bukan lagi dicek dari prefix URL:
// role yang datanya belum ada (Verify & Trust) otomatis disembunyikan lewat
// itu, tanpa nulis if(role===...) di sini. Tetap disembunyikan di halaman
// /messages sendiri, karena di situ chat-nya udah tampil penuh.
// Halaman publik/pra-login: chat adalah fitur akun, dan bubble-nya dulu
// menutupi tombol CTA homepage di layar HP.
const PUBLIC_ROUTES = ["/", "/login", "/register", "/choose-type", "/verify", "/verify-email", "/forgot-password"];

export default function ChatWidget() {
  const pathname = usePathname();
  const { config } = useRole();
  const {
    convs, sorted, activeId, activeIndex, selectConversation, goRelative,
    sendMessage, unreadTotal, widgetOpen, openWidget, closeWidget, openIntent,
    projectById, perspective,
  } = useChat();

  const [showChat, setShowChat] = useState(false);
  const [query, setQuery] = useState("");
  const [projectDrawerOpen, setProjectDrawerOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Klik bubble polos -> buka ke daftar percakapan ("list"). Klik "Pesan
  // klien" dari kartu/drawer proyek (openWidget(projectId)) -> langsung ke
  // jendela chat proyek itu ("chat"). Lihat ChatContext.js (openIntent).
  useEffect(() => {
    if (widgetOpen) setShowChat(openIntent === "chat");
  }, [widgetOpen, openIntent]);

  // Tutup panel dengan tombol Esc — cuma dipasang selagi panel terbuka.
  useEffect(() => {
    if (!widgetOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") closeWidget();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [widgetOpen, closeWidget]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => {
      const project = projectById[c.projectId];
      const haystack = [c.contact.name, project?.title, project?.client].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [sorted, query, projectById]);

  const conversationViews = filtered.map((c) => ({
    ...c,
    projectTitle: projectById[c.projectId]?.title || "",
    unread: unreadCount(c),
  }));

  const active = convs.find((c) => c.id === activeId) || null;
  const activeProject = active ? projectById[active.projectId] : null;
  const activeView = active ? {
    ...active,
    projectTitle: activeProject?.title || "",
    lastSeenLabel: formatLastSeen(active.contact.lastSeen, MOCK_TODAY),
  } : null;

  function handleSelect(id) {
    selectConversation(id);
    setShowChat(true);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  const nav = sorted.length > 1 ? {
    index: activeIndex, total: sorted.length,
    onPrev: () => goRelative(-1), onNext: () => goRelative(1),
  } : null;

  const canShowWidget = !!config?.features?.chatWidget && pathname !== "/messages" && !PUBLIC_ROUTES.includes(pathname);
  if (!canShowWidget) return null;

  return (
    <>
      <button
        type="button"
        className="chat-fab"
        onClick={() => (widgetOpen ? closeWidget() : openWidget())}
        aria-label={widgetOpen ? "Tutup pesan" : "Buka pesan"}
        aria-expanded={widgetOpen}
      >
        <Icon name={widgetOpen ? "close" : "chat"} />
        {!widgetOpen && unreadTotal > 0 && <span className="chat-fab-badge">{unreadTotal}</span>}
      </button>

      {widgetOpen && (
        <>
          <div className="chat-widget-overlay" onClick={closeWidget} aria-hidden="true" />
          <div className="chat-widget-panel" role="dialog" aria-label="Pesan">
            <div className="chat-widget-header">
              <span className="t-small" style={{ fontWeight: 700 }}>Pesan</span>
              <div className="row gap-4">
                <Link href="/messages" className="icon-btn" aria-label="Buka halaman penuh" data-tooltip="Buka halaman penuh">
                  <Icon name="arrowUpRight" />
                </Link>
                <button type="button" className="icon-btn" onClick={closeWidget} aria-label="Tutup panel pesan">
                  <Icon name="close" />
                </button>
              </div>
            </div>

            <div className={`chat-layout compact ${showChat ? "show-chat" : ""}`}>
              <ConversationList
                conversations={conversationViews}
                activeId={activeId}
                onSelect={handleSelect}
                query={query}
                onQueryChange={setQuery}
              />
              <ChatWindow
                conversation={activeView}
                projectMeta={activeProject ? STATUS_META[activeProject.status] : null}
                onBack={() => setShowChat(false)}
                onOpenProjectDetail={() => setProjectDrawerOpen(true)}
                onSend={sendMessage}
                onAttach={() => showToast("Lampiran belum tersedia di prototipe ini.")}
                nav={nav}
              />
            </div>
          </div>
        </>
      )}

      <ProjectDetailDrawer project={activeProject} open={projectDrawerOpen} onClose={() => setProjectDrawerOpen(false)} perspective={perspective} />

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
