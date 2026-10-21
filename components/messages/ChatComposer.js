"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";

// Enter mengirim, Shift+Enter baris baru. Tombol lampirkan cuma dummy
// (lihat onAttach dari parent) — belum ada backend upload di prototipe ini.
export default function ChatComposer({ onSend, onAttach }) {
  const [text, setText] = useState("");
  const taRef = useRef(null);

  function handleChange(e) {
    setText(e.target.value);
    const ta = taRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
  }

  return (
    <div className="chat-composer">
      <button type="button" className="icon-btn" onClick={onAttach} aria-label="Lampirkan file" data-tooltip="Lampirkan file">
        <Icon name="paperclip" />
      </button>
      <textarea
        ref={taRef}
        className="chat-composer-input"
        placeholder="Tulis pesan..."
        rows={1}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="icon-circle-btn chat-send-btn"
        onClick={submit}
        disabled={!text.trim()}
        aria-label="Kirim pesan"
      >
        <Icon name="send" />
      </button>
    </div>
  );
}
