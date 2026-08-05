"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

interface SearchCtxType {
  query: string;
  setQuery: (q: string) => void;
  selectedCats: Set<string>;
  toggleCat: (cat: string) => void;
  clearCats: () => void;
}

const SearchCtx = createContext<SearchCtxType>({
  query: "",
  setQuery: () => {},
  selectedCats: new Set(),
  toggleCat: () => {},
  clearCats: () => {},
});

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQueryRaw] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  const setQuery = useCallback((q: string) => setQueryRaw(q), []);

  const toggleCat = useCallback((cat: string) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const clearCats = useCallback(() => setSelectedCats(new Set()), []);

  return (
    <SearchCtx.Provider value={{ query, setQuery, selectedCats, toggleCat, clearCats }}>
      {children}
    </SearchCtx.Provider>
  );
}

export const useSearch = () => useContext(SearchCtx);
