import { z } from "zod";
import { isProbeableUrl } from "./link-safety";

export const IMPORT_BATCH_SIZE = 20;
export const IMPORT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const IMPORT_MAX_BATCH_BYTES = 256 * 1024;
export const sourceImportSchema = z.object({
  topic_id: z.number().int().positive(),
  kind: z.enum(["books", "papers", "videos", "articles", "pdfs", "podcasts", "tools"]),
  title: z.string().trim().min(1).max(1000),
  url: z.string().trim().max(4096).refine(isProbeableUrl, "Adresse interdite ou invalide"),
  origin: z.string().trim().min(1).max(200).optional(),
}).passthrough().superRefine((row, ctx) => {
  if (row.kind === "videos") {
    const u = new URL(row.url);
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com"].includes(u.hostname)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hôte vidéo non pris en charge" });
    }
  }
});

export function normalizedImportUrl(raw: string) {
  const url = new URL(raw.trim());
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString().replace(/\/$/, "");
}

export function parseImportFile(text: string): unknown[] {
  if (new TextEncoder().encode(text).length > IMPORT_MAX_FILE_BYTES) throw new Error("Fichier limité à 20 Mo.");
  const parsed: unknown = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && "resources" in parsed ? parsed.resources : null;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 20000) throw new Error("Un tableau resources de 1 à 20 000 éléments est attendu.");
  return rows;
}

export const batchImportSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  offset: z.number().int().min(0).max(20000),
  rows: z.array(z.unknown()).min(1).max(IMPORT_BATCH_SIZE),
}).superRefine((value, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(value)).length > IMPORT_MAX_BATCH_BYTES) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Lot limité à 256 Ko." });
  }
});

export function candidateFields() {
  return { review_status: "candidate", topic_fit_status: "unreviewed", credibility_status: "unreviewed", needs_review: true, embedding_status: "needs_review", rights_status: "unknown", link_status: "unchecked" } as const;
}

export async function importRowId(userId: string, fingerprint: string, index: number) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${fingerprint}:${index}`));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 15) | 80;
  bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}