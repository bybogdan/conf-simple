import { useEffect, useRef, useState } from "react";
import { FileText, Search, X } from "lucide-react";
import { api } from "../api";
import { pagePath } from "../pageTree";
import type { Page, SearchResult } from "../types";

export function SearchPalette({ pages, onClose, onSelect }: { pages: Page[]; onClose: () => void; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      api.search(query).then((next) => {
        if (!controller.signal.aborted) { setResults(next); setSelected(0); }
      }).catch(() => undefined).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 120);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query]);

  function choose(id: string) { onSelect(id); onClose(); }

  return (
    <div className="overlay" onMouseDown={onClose}>
      <section className="search-palette" role="dialog" aria-modal="true" aria-label="Search pages" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-input-row">
          <Search size={17} />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages…"
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown" && results.length) { event.preventDefault(); setSelected((value) => (value + 1) % results.length); }
              if (event.key === "ArrowUp" && results.length) { event.preventDefault(); setSelected((value) => (value - 1 + results.length) % results.length); }
              if (event.key === "Enter" && results[selected]) { event.preventDefault(); choose(results[selected].id); }
            }} />
          <button className="icon-button" aria-label="Close search" onClick={onClose}><X size={15} /></button>
        </div>
        <p className="palette-label">{query.trim() ? "Results" : "Search all pages"}</p>
        <div className="search-results">
          {!query.trim() && <p className="palette-empty">Search page titles and content.</p>}
          {query.trim() && !loading && !results.length && <p className="palette-empty">No pages found.</p>}
          {results.map((result, index) => {
            const page = pages.find((candidate) => candidate.id === result.id);
            const path = page ? pagePath(pages, page) : [];
            return <button key={result.id} className={index === selected ? "selected" : ""} onMouseEnter={() => setSelected(index)} onClick={() => choose(result.id)}>
              <FileText size={15} />
              <span><span className="result-path">{path.map((item) => item.title).join(" › ") || result.title}</span><small>{result.snippet || "Title match"}</small></span>
              <b>Open</b>
            </button>;
          })}
        </div>
        <footer className="palette-footer"><span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span><b>{results.length ? `${results.length} page${results.length === 1 ? "" : "s"}` : ""}</b></footer>
      </section>
    </div>
  );
}
