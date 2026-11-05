import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { batchImportSchema, candidateFields, importRowId, normalizedImportUrl, sourceImportSchema } from "./resource-import";
import type { Database } from "@/integrations/supabase/types";

export const importResourceBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => batchImportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const role = await db.rpc("is_editor");
    if (role.error || role.data !== true) throw new Error("Import réservé aux éditeurs.");
    const errors: { index: number; topicId: number | null; reason: string }[] = [];
    const valid = data.rows.flatMap((raw, i) => {
      const parsed = sourceImportSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push({ index: data.offset + i, topicId: raw && typeof raw === "object" && "topic_id" in raw && typeof raw.topic_id === "number" ? raw.topic_id : null, reason: parsed.error.issues.map(x => x.message).join("; ") });
        return [];
      }
      return [{ row: parsed.data, index: data.offset + i }];
    });
    if (!valid.length) return { inserted: 0, duplicates: 0, videos: 0, readings: 0, errors };
    const topicIds = [...new Set(valid.map(x => x.row.topic_id))];
    const topics = await db.from("content_topics").select("id").in("id", topicIds);
    if (topics.error) throw new Error("Lecture des sujets impossible. Reprenez ce lot.");
    const knownTopics = new Set(topics.data.map(x => x.id));
    const existing = new Map<string, string>();
    for (let offset = 0; ; offset += 1000) {
      const result = await db.from("content_resources").select("id, topic_id, url").in("topic_id", topicIds).order("id").range(offset, offset + 999);
      if (result.error) throw new Error("Vérification des doublons impossible. Reprenez ce lot.");
      for (const row of result.data) existing.set(`${row.topic_id}:${normalizedImportUrl(row.url)}`, row.id);
      if (result.data.length < 1000) break;
    }
    type Insert = Database["public"]["Tables"]["content_resources"]["Insert"];
    const inserts: Insert[] = [];
    const privateRows: { resource_id: string; rights_notes: string }[] = [];
    let duplicates = 0;
    for (const { row, index } of valid) {
      if (!knownTopics.has(row.topic_id)) {
        errors.push({ index, topicId: row.topic_id, reason: "Sujet inexistant : aucune réaffectation." });
        continue;
      }
      const id = await importRowId(context.userId, data.fingerprint, index);
      const key = `${row.topic_id}:${normalizedImportUrl(row.url)}`;
      const oldId = existing.get(key);
      if (oldId && oldId !== id) { duplicates++; continue; }
      const text = (field: string) => typeof row[field] === "string" ? (row[field] as string).slice(0, 20000) : null;
      inserts.push({ id, topic_id: row.topic_id, kind: row.kind, title: row.title, url: normalizedImportUrl(row.url), origin: row.origin ?? "editor-batch-import", author: text("author"), creator: text("creator"), duration: text("duration"), publication: text("publication"), source: text("source"), description: text("description"), difficulty: text("difficulty"), format: text("format"), ...candidateFields(), embed_type: "link_only", verification: { reviewLevel: "Import candidate; no page, rights or embedding verification performed.", importFingerprint: data.fingerprint } });
      // Preserve the complete supplied record privately, without exposing editorial notes.
      privateRows.push({ resource_id: id, rights_notes: JSON.stringify(row) });
      existing.set(key, id);
    }
    if (!inserts.length) return { inserted: 0, duplicates, videos: 0, readings: 0, errors };
    // DO NOTHING on conflict: retries cannot update an existing source, even after approval.
    const result = await db.from("content_resources").upsert(inserts, { onConflict: "topic_id,url", ignoreDuplicates: true }).select("id");
    if (result.error) throw new Error("Enregistrement du lot interrompu. Reprenez sans risque de doublon.");
    // A response can be lost after a commit. Deterministic IDs identify only this import's rows.
    const confirmed = await db.from("content_resources").select("id, kind").in("id", inserts.map(x => x.id).filter((id): id is string => typeof id === "string"));
    if (confirmed.error) throw new Error("Confirmation du lot interrompue. Reprenez ce lot.");
    const ids = new Set(confirmed.data.map(x => x.id));
    const metadata = privateRows.filter(x => ids.has(x.resource_id));
    if (metadata.length) {
      const saved = await db.from("content_resource_private").upsert(metadata, { onConflict: "resource_id", ignoreDuplicates: true });
      if (saved.error) throw new Error("Métadonnées en attente. Reprenez ce lot pour les compléter.");
    }
    const videos = confirmed.data.filter(x => x.kind === "videos").length;
    return { inserted: ids.size, duplicates: duplicates + inserts.length - ids.size, videos, readings: ids.size - videos, errors };
  });