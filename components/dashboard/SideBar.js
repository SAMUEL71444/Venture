"use client";

import { forwardRef, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import UserMenuTrigger from "./UserMenuTrigger";
import SidebarBrandToggle from "./SidebarBrandToggle";
import SearchPanel from "@/components/search/SearchPanel";
import { useSearchPanel } from "@/context/SearchPanelContext";

// Harus sinkron sama .dash-sidebar / .dash-sidebar.collapsed di globals.css
// — dipakai buat naruh SearchPanel pas di tepi kanan sidebar.
const SIDEBAR_WIDTH_OPEN = 240;
const SIDEBAR_WIDTH_COLLAPSED = 72;

const RESET_BUTTON = { width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "inherit", font: "inherit" };

// `mobile`/`mobileOpen`: di bawah md sidebar jadi drawer off-canvas yang
// dikontrol AppShell; `onNavigate` dipanggil saat menu dipilih (menutup
// drawer). Submenu dibuka lewat klik/tap/keyboard (tombol dengan
// aria-expanded); hover hanya membantu di pointer mouse — di layar sentuh,
// tap memicu mouseenter lalu click sehingga submenu langsung tertutup lagi.
const Sidebar = forwardRef(function Sidebar({ id, open, onToggle, navItems, user, mobile = false, mobileOpen = false, onNavigate }, ref) {
  const pathname = usePathname();
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const closeTimer = useRef(null);
  const { isOpen: searchOpen, openSearch } = useSearchPanel();
  const hasSearchItem = navItems.some((item) => item.action === "search");

  const scheduleClose = () => { closeTimer.current = setTimeout(() => setOpenSubmenu(null), 150); };
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const isMouse = (e) => e.pointerType === "mouse" && !mobile;

  return (
    <>
    <aside
      id={id}
      ref={ref}
      className={`dash-sidebar ${open ? "" : "collapsed"} ${mobileOpen ? "mobile-open" : ""}`}
      aria-label="Navigasi utama"
      {...(mobile ? { role: "dialog", "aria-modal": mobileOpen || undefined, "aria-hidden": !mobileOpen || undefined } : {})}
    >
      <div className="sidebar-top" style={{ padding: "16px 16px 14px" }}>
        <SidebarBrandToggle open={open} onToggle={onToggle} />
      </div>

      {/* Menu akun dipindah ke sini — atas, sebelum daftar nav — sesuai permintaan */}
      <div style={{ padding: "0 8px 8px", borderBottom: "1px solid var(--border)", marginBottom: 8 }}>
        <UserMenuTrigger user={user} sidebarOpen={open} />
      </div>

      <nav
        key={open ? "expanded" : "collapsed"}
        style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}
      >
        {navItems.map((item, i) => {
          const hasChildren = !!item.children;
          // c.href bisa punya query string (mis. "/projects?tab=aktif")
          // — usePathname() nggak pernah punya query, jadi dibandingin tanpa
          // bagian query-nya. Tanpa ini, item children berquery nggak pernah
          // ke-highlight sebagai aktif.
          const active = item.action === "search"
            ? searchOpen
            : item.href
              ? pathname === item.href || pathname.startsWith(item.href + "/")
              : item.children?.some((c) => pathname === c.href.split("?")[0] || pathname.startsWith(c.href.split("?")[0] + "/"));
          const isSubmenuOpen = openSubmenu === item.label;
          const submenuId = `submenu-${i}`;

          const row = (
            <div
              className={`nav-row ${active ? "active" : ""}`}
              onPointerEnter={hasChildren ? (e) => { if (!isMouse(e)) return; cancelClose(); setOpenSubmenu(item.label); } : undefined}
              onPointerLeave={hasChildren ? (e) => { if (isMouse(e)) scheduleClose(); } : undefined}
            >
              <span className="nav-icon"><Icon name={item.icon} /></span>
                <span
                  className="nav-label"
                  style={{ transitionDelay: open ? `${i * 40}ms` : "0ms" }}
                >
                  {item.label}
                </span>
                {hasChildren && open && <span className="nav-caret"><Icon name={mobile && isSubmenuOpen ? "chevDown" : "chevRight"} /></span>}
            </div>
          );

          // Stagger cuma dipakai saat SIDEBAR TERBUKA — item muncul geser
          // masuk dari kiri satu per satu. Saat collapse, tidak perlu
          // animasi masuk lagi (konsisten dengan nav-label yang nutup serentak).
          const itemStyle = open ? { animationDelay: `${i * 40}ms` } : undefined;
          const itemClassName = `nav-item${open ? " nav-item-animate" : ""}`;

          return (
            <div key={item.label} style={{ position: "relative" }}>
              {item.action === "search" ? (
                <button
                  type="button"
                  className={itemClassName}
                  style={{ ...itemStyle, ...RESET_BUTTON }}
                  onClick={() => { onNavigate?.(); openSearch(); }}
                >
                  {row}
                </button>
              ) : item.href ? (
                <Link href={item.href} className={itemClassName} style={itemStyle} onClick={() => onNavigate?.()}>{row}</Link>
              ) : (
                <button
                  type="button"
                  className={itemClassName}
                  style={{ ...itemStyle, ...RESET_BUTTON }}
                  aria-expanded={isSubmenuOpen}
                  aria-controls={isSubmenuOpen ? submenuId : undefined}
                  aria-label={open ? undefined : item.label}
                  onClick={() => setOpenSubmenu(isSubmenuOpen ? null : item.label)}
                >
                  {row}
                </button>
              )}
              {hasChildren && isSubmenuOpen && (
                <div
                  id={submenuId}
                  className="nav-flyout"
                  onPointerEnter={(e) => { if (isMouse(e)) cancelClose(); }}
                  onPointerLeave={(e) => { if (isMouse(e)) scheduleClose(); }}
                >
                  {item.children.map((c) => (
                    <Link key={c.href} href={c.href} className="nav-flyout-item" onClick={() => { setOpenSubmenu(null); onNavigate?.(); }}>
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>

    {hasSearchItem && (
      <SearchPanel sidebarWidth={mobile ? 0 : open ? SIDEBAR_WIDTH_OPEN : SIDEBAR_WIDTH_COLLAPSED} />
    )}
    </>
  );
});

export default Sidebar;
