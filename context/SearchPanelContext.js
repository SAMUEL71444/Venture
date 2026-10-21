"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// State global buat panel search gaya Upwork (lihat components/search/SearchPanel.js).
// Dipisah dari RoleContext karena ini murni UI state, bukan data user/auth.
const SearchPanelContext = createContext(null);

export function SearchPanelProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");

  const openSearch = useCallback((q = "") => {
    setInitialQuery(q);
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, initialQuery, openSearch, closeSearch }),
    [isOpen, initialQuery, openSearch, closeSearch]
  );

  return (
    <SearchPanelContext.Provider value={value}>
      {children}
    </SearchPanelContext.Provider>
  );
}

export function useSearchPanel() {
  const ctx = useContext(SearchPanelContext);
  if (!ctx) throw new Error("useSearchPanel harus dipakai di dalam <SearchPanelProvider>");
  return ctx;
}
