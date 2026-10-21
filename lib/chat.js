// Helper murni buat halaman Pesan — format waktu ala aplikasi chat
// (jam kalau hari ini, "Kemarin", atau tanggal), dihitung relatif ke
// `todayIso` (biasanya MOCK_TODAY dari lib/projects.mock.js), bukan
// `new Date()` asli, supaya konsisten sama data dummy.

import { CONVERSATIONS, UMKM_THREADS } from "./messages.mock";
import { TALENTS } from "./talents.mock";
import { umkmProjects } from "./payments";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const pad = (n) => String(n).padStart(2, "0");

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function yesterdayOf(d) {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return y;
}

export function formatClock(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

// Dipakai di daftar percakapan: "10.12" (hari ini), "Kemarin", atau "12 Sep".
export function formatListTime(iso, todayIso) {
  const d = new Date(iso);
  const today = new Date(todayIso);
  if (sameDate(d, today)) return formatClock(iso);
  if (sameDate(d, yesterdayOf(today))) return "Kemarin";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Pemisah tanggal di dalam jendela chat: "Hari ini", "Kemarin", atau
// "12 Sep 2026".
export function dayLabel(iso, todayIso) {
  const d = new Date(iso);
  const today = new Date(todayIso);
  if (sameDate(d, today)) return "Hari ini";
  if (sameDate(d, yesterdayOf(today))) return "Kemarin";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// "Terakhir aktif hari ini pukul 10.12" / "...kemarin" / "...12 Sep 2026"
export function formatLastSeen(iso, todayIso) {
  if (!iso) return "Terakhir aktif baru-baru ini";
  const label = dayLabel(iso, todayIso);
  const clock = formatClock(iso);
  if (label === "Hari ini") return `Terakhir aktif hari ini pukul ${clock}`;
  if (label === "Kemarin") return `Terakhir aktif kemarin pukul ${clock}`;
  return `Terakhir aktif ${label}`;
}

export function unreadCount(conv) {
  return conv.messages.filter((m) => m.from === "them" && !m.read).length;
}

export function lastMessage(conv) {
  return conv.messages[conv.messages.length - 1];
}

export function sortByLatest(conversations) {
  return [...conversations].sort((a, b) => lastMessage(b).at.localeCompare(lastMessage(a).at));
}

// Balik sudut pandang sebuah percakapan: "me" <-> "them". Pesan keluar
// (`status`: dibaca/terkirim) dan pesan masuk (`read`: true/false) saling
// bertukar arti — pesan yang sudah "dibaca" lawan bicara jadi pesan masuk
// yang `read: true`, dan sebaliknya.
export function flipConversation(conv) {
  return {
    ...conv,
    messages: conv.messages.map((m) => {
      if (m.from === "me") {
        const { status, ...rest } = m;
        return { ...rest, from: "them", read: status === "dibaca" };
      }
      const { read, ...rest } = m;
      return { ...rest, from: "me", status: read ? "dibaca" : "terkirim" };
    }),
  };
}

// Daftar percakapan untuk UMKM, DITURUNKAN dari relasi proyeknya: satu
// percakapan per proyek yang punya freelancer (sedang atau pernah
// dikerjakan), jadi nama kontak selalu sama dengan freelancer di kartu
// proyek. Isi chat proyek mp* diambil dari percakapan freelancer lalu
// dibalik; proyek pp* dari UMKM_THREADS. Proyek tanpa isi chat dilewati
// (percakapan kosong akan merusak daftar).
export function buildUmkmConversations(umkmName) {
  return umkmProjects(umkmName)
    .filter((p) => p.freelancerId)
    .map((p) => {
      const talent = TALENTS.find((t) => t.id === p.freelancerId);
      const base = { name: p.freelancerName, avatarBg: talent?.avatarBg || "#DBEAFE" };
      const own = CONVERSATIONS.find((c) => c.projectId === p.id);
      if (own) {
        return { ...flipConversation(own), id: `uconv-${p.id}`, projectId: p.id, contact: { ...base, online: true, lastSeen: null } };
      }
      const thread = UMKM_THREADS[p.id];
      if (!thread) return null;
      return {
        id: `uconv-${p.id}`, projectId: p.id,
        contact: { ...base, online: thread.online, lastSeen: thread.lastSeen },
        messages: thread.messages.map((m) => ({ ...m })),
      };
    })
    .filter(Boolean);
}
