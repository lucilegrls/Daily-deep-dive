/**
 * Replaceable wider-web search provider. Deep Dive's own glossary, topics and
 * approved sources are always offered first; this is the last option.
 *
 * - With VITE_GOOGLE_CSE_ID set, the Google Programmable Search Element is
 *   loaded (only after the reader asks) inside a Deep Dive panel.
 * - Without it, a plain search opens in a new tab.
 * The Custom Search JSON API is intentionally not used.
 */
export interface WebSearchProvider {
  id: string;
  label: string;
  inline: boolean;
  /** Mounts results into `host`; returns a cleanup function. */
  mount?: (host: HTMLElement, query: string) => () => void;
  externalUrl: (query: string) => string;
}

const CSE_HOST = "https://cse.google.com/cse.js";

function googleElement(cx: string): WebSearchProvider {
  return {
    id: "google-pse",
    label: "Google Programmable Search",
    inline: true,
    externalUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    mount: (host, query) => {
      host.innerHTML = "";
      const box = document.createElement("div");
      box.className = "gcse-searchresults-only";
      box.setAttribute("data-gname", "deepdive");
      host.appendChild(box);
      const run = () => {
        const g = (window as unknown as { google?: { search?: { cse?: { element?: { render: (o: object) => void; getElement: (n: string) => { execute: (q: string) => void } | undefined } } } } }).google;
        const el = g?.search?.cse?.element;
        if (!el) return;
        if (!el.getElement("deepdive")) el.render({ div: box, tag: "searchresults-only", gname: "deepdive" });
        el.getElement("deepdive")?.execute(query);
      };
      const w = window as unknown as { __gcse?: object };
      w.__gcse = { parsetags: "explicit", callback: run };
      if (!document.querySelector(`script[src^="${CSE_HOST}"]`)) {
        const s = document.createElement("script");
        s.src = `${CSE_HOST}?cx=${encodeURIComponent(cx)}`;
        s.async = true;
        document.head.appendChild(s);
      } else run();
      return () => {
        host.innerHTML = "";
      };
    },
  };
}

const linkOut: WebSearchProvider = {
  id: "link-out",
  label: "web search",
  inline: false,
  externalUrl: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
};

export function webSearchProvider(): WebSearchProvider {
  const cx = import.meta.env["VITE_GOOGLE_CSE_ID"] as string | undefined;
  return cx && /^[A-Za-z0-9:_-]{5,60}$/.test(cx) ? googleElement(cx) : linkOut;
}
