"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ConversationList from "@/components/messages/ConversationList";
import ChatWindow from "@/components/messages/ChatWindow";
import ProjectDetailDrawer from "@/components/projects/ProjectDetailDrawer";
import { STATUS_META, MOCK_TODAY } from "@/lib/projects.mock";
import { unreadCount, formatLastSeen } from "@/lib/chat";
import { useChat } from "@/context/ChatContext";

// useSearchParams wajib dibungkus <Suspense> di App Router — lihat catatan
// yang sama di app/register/page.js.
export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesView />
    </Suspense>
  );
}

function MessagesView() {
  const searchParams = useSearchParams();
  const projectParam = searchParams.get("project");

  // Percakapan sekarang dipegang ChatContext (dipakai bareng bubble chat
  // melayang di semua halaman) — halaman ini cuma nampilinnya penuh.
  // projectById/perspective datang dari ChatContext sesuai role (UMKM -> proyek
  // miliknya, Freelancer -> Proyek Saya).
  const { convs, sorted, activeId, activeIndex, selectConversation, goRelative, sendMessage, projectById, perspective } = useChat();

  const [query, setQuery] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [projectDrawerOpen, setProjectDrawerOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const appliedProjectParam = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => {
      const project = projectById[c.projectId];
      // Cocokkan nama kontak, judul proyek, ATAU nama UMKM-nya — orang
      // sering nyari berdasarkan nama usaha (mis. "Batik Asri Nusantara"),
      // bukan cuma judul proyeknya ("Pembuatan Logo & Panduan Merek").
      const haystack = [c.contact.name, project?.title, project?.client].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [sorted, query, projectById]);

  // Deep-link ?project=mp2 dari tombol "Pesan klien" di Proyek Saya —
  // sekali saja, biar nggak maksa balik ke situ tiap convs berubah.
  useEffect(() => {
    if (appliedProjectParam.current || !projectParam) return;
    const match = convs.find((c) => c.projectId === projectParam);
    if (match) {
      selectConversation(match.id);
      setMobileShowChat(true);
      appliedProjectParam.current = true;
    }
  }, [projectParam, convs, selectConversation]);

  const active = convs.find((c) => c.id === activeId) || null;
  const activeProject = active ? projectById[active.projectId] : null;

  function selectConversationAndShow(id) {
    selectConversation(id);
    setMobileShowChat(true);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  const conversationViews = filtered.map((c) => ({
    ...c,
    projectTitle: projectById[c.projectId]?.title || "",
    unread: unreadCount(c),
  }));

  const activeView = active ? {
    ...active,
    projectTitle: activeProject?.title || "",
    lastSeenLabel: formatLastSeen(active.contact.lastSeen, MOCK_TODAY),
  } : null;

  const nav = sorted.length > 1 ? {
    index: activeIndex, total: sorted.length,
    onPrev: () => goRelative(-1), onNext: () => goRelative(1),
  } : null;

  return (
    <AppShell bare>
      <div className={`chat-layout ${mobileShowChat ? "show-chat" : ""}`}>
        <ConversationList
          conversations={conversationViews}
          activeId={activeId}
          onSelect={selectConversationAndShow}
          query={query}
          onQueryChange={setQuery}
        />
        <ChatWindow
          conversation={activeView}
          projectMeta={activeProject ? STATUS_META[activeProject.status] : null}
          onBack={() => setMobileShowChat(false)}
          onOpenProjectDetail={() => setProjectDrawerOpen(true)}
          onSend={sendMessage}
          onAttach={() => showToast("Lampiran belum tersedia di prototipe ini.")}
          nav={nav}
        />
      </div>

      <ProjectDetailDrawer
        project={activeProject}
        open={projectDrawerOpen}
        onClose={() => setProjectDrawerOpen(false)}
        perspective={perspective}
      />

      {toast && <div className="toast">{toast}</div>}
    </AppShell>
  );
}
