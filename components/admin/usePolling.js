"use client";

import { useEffect, useRef } from "react";

// Jalankan `fn` saat mount lalu tiap `intervalMs` SELAMA tab terlihat. Saat tab
// disembunyikan, pembaruan berhenti; saat terlihat lagi, langsung diperbarui
// sekali lalu interval berjalan kembali. Tanpa websocket.
export default function usePolling(fn, intervalMs = 30000) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let timer = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => fnRef.current(), intervalMs);
    };
    const stop = () => {
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        fnRef.current();
        start();
      }
    };

    fnRef.current();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
