"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CONVERSATIONS } from "@/lib/messages.mock";
import { CURRENT_USERS } from "@/lib/users.mock";
import { MOCK_TODAY, getAllProjects } from "@/lib/projects.mock";
import { sortByLatest, unreadCount, buildUmkmConversations } from "@/lib/chat";
import { useRole } from "@/context/RoleContext";
import { useClientProjects } from "@/context/ProjectsContext";

// State percakapan dipindah ke sini dari app/messages/page.js supaya bisa
// dipakai bareng oleh halaman Pesan (penuh) DAN bubble chat melayang
// (components/messages/ChatWidget.js) — badge belum dibaca dan isi chat
// selalu sama di keduanya, karena sumbernya satu.
//
// Percakapan disimpan PER ROLE: Freelancer melihat percakapan dengan
// klien-kliennya (sudut pandang Nadia), UMKM melihat percakapan dengan
// freelancer di proyek-proyek miliknya (diturunkan dari relasi proyek,
// lib/chat.js -> buildUmkmConversations). Dulu semua role memakai daftar
// Nadia, jadi UMKM melihat chat milik klien lain. Verify & Trust tidak
// punya chat (config.features.chatWidget).
const ChatContext = createContext(null);

function cloneConversations() {
  return CONVERSATIONS.map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m })) }));
}

export function ChatProvider({ children }) {
  const { role, user } = useRole();
  const chatKey = role === "umkm" ? "umkm" : role === "mahasiswa" ? "mahasiswa" : null;

  const [store, setStore] = useState(() => ({
    mahasiswa: cloneConversations(),
    umkm: buildUmkmConversations(CURRENT_USERS.umkm.name),
  }));
  // Percakapan yang sedang dibuka per role. Kalau belum ada pilihan eksplisit,
  // default ke percakapan terbaru (lihat `activeId` di bawah).
  const [activeByRole, setActiveByRole] = useState({});
  const [widgetOpen, setWidgetOpen] = useState(false);
  // Dibaca ChatWidget.js buat nentuin panel dibuka ke daftar percakapan
  // ("list", klik bubble polos) atau langsung ke jendela chat ("chat",
  // klik "Pesan klien/freelancer" yang sudah nunjuk ke satu proyek).
  const [openIntent, setOpenIntent] = useState("list");
  const readTimers = useRef([]);

  useEffect(() => () => readTimers.current.forEach(clearTimeout), []);

  const convs = chatKey ? store[chatKey] : [];
  const sorted = useMemo(() => sortByLatest(convs), [convs]);

  const activeId = (chatKey && activeByRole[chatKey]) || sorted[0]?.id || null;
  const activeIndex = sorted.findIndex((c) => c.id === activeId);

  function updateConvs(updater) {
    if (!chatKey) return;
    setStore((s) => ({ ...s, [chatKey]: updater(s[chatKey]) }));
  }

  function selectConversation(id) {
    if (!chatKey) return;
    setActiveByRole((a) => ({ ...a, [chatKey]: id }));
    updateConvs((prev) => prev.map((c) => (
      c.id === id
        ? { ...c, messages: c.messages.map((m) => (m.from === "them" ? { ...m, read: true } : m)) }
        : c
    )));
  }

  // Geser ke percakapan sebelumnya/berikutnya (dipakai swipe & panah ‹ › —
  // lihat components/messages/ChatWindow.js), muter balik ke awal/akhir.
  function goRelative(delta) {
    if (sorted.length === 0) return;
    const idx = activeIndex < 0 ? 0 : activeIndex;
    const nextIdx = (idx + delta + sorted.length) % sorted.length;
    selectConversation(sorted[nextIdx].id);
  }

  function sendMessage(text) {
    if (!activeId) return;
    const targetId = activeId;
    const now = new Date();
    const at = `${MOCK_TODAY}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const id = `${targetId}-new-${Date.now()}`;

    updateConvs((prev) => prev.map((c) => (
      c.id === targetId
        ? { ...c, messages: [...c.messages, { id, from: "me", text, at, status: "terkirim" }] }
        : c
    )));

    // Simulasi "dibaca" ala aplikasi chat — nggak ada backend beneran.
    const t = setTimeout(() => {
      updateConvs((prev) => prev.map((c) => (
        c.id === targetId
          ? { ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, status: "dibaca" } : m)) }
          : c
      )));
    }, 1500);
    readTimers.current.push(t);
  }

  // Buka panel melayang, opsional langsung ke percakapan proyek tertentu
  // (dipanggil dari tombol "Pesan klien/freelancer" di kartu & drawer proyek).
  function openWidget(projectId) {
    if (projectId) {
      const match = convs.find((c) => c.projectId === projectId);
      if (match) selectConversation(match.id);
      setOpenIntent("chat");
    } else {
      setOpenIntent("list");
    }
    setWidgetOpen(true);
  }

  function closeWidget() {
    setWidgetOpen(false);
  }

  const unreadTotal = useMemo(() => convs.reduce((sum, c) => sum + unreadCount(c), 0), [convs]);

  // Proyek yang terhubung ke percakapan, sesuai role: UMKM -> proyek miliknya
  // (termasuk yang baru diposting), Freelancer -> "Proyek Saya". Dipakai
  // halaman Pesan & ChatWidget untuk judul proyek, status, dan drawer.
  const clientProjects = useClientProjects(user?.name ?? "");
  const projectById = useMemo(() => {
    const list = role === "umkm" ? clientProjects : getAllProjects();
    return Object.fromEntries(list.map((p) => [p.id, p]));
  }, [role, clientProjects]);
  const perspective = role === "umkm" ? "client" : "freelancer";

  const value = {
    convs, sorted, activeId, activeIndex,
    selectConversation, goRelative, sendMessage,
    unreadTotal, openWidget, closeWidget, widgetOpen, openIntent,
    projectById, perspective,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat harus dipakai di dalam <ChatProvider>");
  return ctx;
}
