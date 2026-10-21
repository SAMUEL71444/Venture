"use client";

import { useId, useState } from "react";
import Icon from "@/components/Icon";

// Daftar pertanyaan-jawaban yang bisa expand satu per satu (satu terbuka
// dalam satu waktu). Dipakai halaman Pusat Bantuan (HelpView). Transisi
// tinggi memakai pola yang sama dengan CollapsibleCard (.cc-body).
export default function Accordion({ items }) {
  const [openId, setOpenId] = useState(null);
  const baseId = useId();

  return (
    <div className="accordion">
      {items.map((item, i) => {
        const id = `${baseId}-${i}`;
        const open = openId === id;
        return (
          <div key={item.id || i} className="accordion-item">
            <button
              type="button"
              className="accordion-trigger"
              onClick={() => setOpenId(open ? null : id)}
              aria-expanded={open}
              aria-controls={`${id}-panel`}
            >
              <span>{item.question}</span>
              <span className={`cc-chev ${open ? "open" : ""}`}><Icon name="chevDown" /></span>
            </button>
            <div id={`${id}-panel`} className={`cc-body ${open ? "open" : ""}`}>
              <div className="cc-body-inner">
                <p className="t-small muted">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
