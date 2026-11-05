import envelopeImg from "@/assets/envelope.png";
import academiaAsset from "@/assets/gateway-dark-academia.png.asset.json";
import inkyAsset from "@/assets/gateway-inky.png.asset.json";
import maximalAsset from "@/assets/gateway-maximalist.png.asset.json";
import minimalAsset from "@/assets/gateway-minimalist.png.asset.json";
import retroAsset from "@/assets/gateway-retro.png.asset.json";
import y2kAsset from "@/assets/gateway-y2k.png.asset.json";

export interface ThemeOption {
  id: string;
  label: string;
  description: string;
  swatch: [string, string, string];
  /** The object a reader taps to open a topic's library in this look. */
  gateway: {
    src: string;
    /** Describes the object for anyone reading the interface aloud. */
    object: string;
    /** Romantic keeps the printed-on-paper blend; the rest sit as objects. */
    blend?: "multiply";
  };
}

export const THEMES: ThemeOption[] = [
  {
    id: "romantic",
    label: "Romantic",
    description: "Cream laid paper, lace and a wax seal.",
    swatch: ["#f6efe2", "#e7c9c4", "#7b3b3b"],
    gateway: { src: envelopeImg, object: "lace envelope", blend: "multiply" },
  },
  {
    id: "minimal",
    label: "Minimalist",
    description: "White space, quiet type, no ornament.",
    swatch: ["#ffffff", "#e6e6e6", "#1c1c1c"],
    gateway: { src: minimalAsset.url, object: "clipped archival cards" },
  },
  {
    id: "inky",
    label: "Inky",
    description: "Deep green and charcoal, heavy serif.",
    swatch: ["#17231e", "#2a3a32", "#8fd6a8"],
    gateway: { src: inkyAsset.url, object: "quill and inkwell" },
  },
  {
    id: "maximal",
    label: "Maximalist",
    description: "Loud colour, fat type, big radius.",
    swatch: ["#f7e9a8", "#7ad3c8", "#c32ea3"],
    gateway: { src: maximalAsset.url, object: "rotary telephone" },
  },
  {
    id: "retro",
    label: "Retro print",
    description: "Newsprint warmth and vintage ink.",
    swatch: ["#ece0c8", "#d9c39a", "#a8402a"],
    gateway: { src: retroAsset.url, object: "vintage ticket" },
  },
  {
    id: "y2k",
    label: "Y2K",
    description: "Chrome blues, bubble shapes, gloss.",
    swatch: ["#e6f1ff", "#9fd8ee", "#8b3ede"],
    gateway: { src: y2kAsset.url, object: "iridescent cassette" },
  },
  {
    id: "academia",
    label: "Dark academia",
    description: "Oxblood, parchment and candlelight.",
    swatch: ["#3a3227", "#5a4b38", "#9c3b2f"],
    gateway: { src: academiaAsset.url, object: "wax seal" },
  },
];

/** The object for a look, falling back to the default look's object. */
export function gatewayFor(themeId: string) {
  const match = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  return match!.gateway;
}

export const DEFAULT_THEME = "romantic";
export const THEME_STORAGE_KEY = "daily-deep-dive:theme";

/** The only theme ids the app ever stores. Mirrored by apply_onboarding. */
export const THEME_IDS: string[] = THEMES.map((t) => t.id);

export function isTheme(value: unknown): value is string {
  return typeof value === "string" && THEME_IDS.includes(value);
}


export function applyTheme(theme: string) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}
