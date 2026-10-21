"use client";

import { useEffect, useRef } from "react";

// Kunci fokus keyboard di dalam `ref` selama `active` (modal, drawer, menu
// navigasi mobile): Tab/Shift+Tab berputar di dalam, fokus awal masuk ke
// elemen pertama (kecuali sudah ada yang difokus di dalamnya, mis. autoFocus),
// dan fokus dikembalikan ke elemen sebelumnya saat ditutup.
// Bisa bertumpuk (modal di atas drawer): hanya trap TERATAS yang bereaksi.
// `onEscape` opsional — Modal/Drawer sudah menangani Esc sendiri.
const stack = [];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function useFocusTrap(ref, active, { onEscape } = {}) {
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const root = ref.current;
    if (!root) return undefined;
    const token = {};
    stack.push(token);
    const previous = document.activeElement;

    const focusables = () => [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);

    if (!root.contains(document.activeElement)) {
      const first = focusables()[0];
      if (first) first.focus({ preventScroll: true });
      else { root.setAttribute("tabindex", "-1"); root.focus({ preventScroll: true }); }
    }

    function onKeyDown(e) {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === "Escape" && escapeRef.current) {
        e.stopPropagation();
        escapeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const inside = root.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const i = stack.indexOf(token);
      if (i !== -1) stack.splice(i, 1);
      if (previous instanceof HTMLElement && previous !== document.body && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
