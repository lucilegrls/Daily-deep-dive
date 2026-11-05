import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Pause, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importResourceBatch } from "@/lib/resource-import.functions";
import { IMPORT_BATCH_SIZE, IMPORT_MAX_FILE_BYTES, batchImportSchema, parseImportFile } from "@/lib/resource-import";
import { supabase } from "@/integrations/supabase/client";

type Progress = { offset: number; inserted: number; duplicates: number; videos: number; readings: number; errors: { index: number; topicId: number | null; reason: string }[] };
const emptyProgress = (): Progress => ({ offset: 0, inserted: 0, duplicates: 0, videos: 0, readings: 0, errors: [] });

export function ResourceImportPanel({ onComplete }: { onComplete: () => void }) {
  const send = useServerFn(importResourceBatch);
  const [file, setFile] = useState<{ name: string; rows: unknown[]; fingerprint: string; key: string } | null>(null);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stop = useRef(false);
  const active = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);

  async function choose(selected: File | undefined) {
    if (!selected || active.current) return;
    setError(""); setFile(null); setProgress(emptyProgress());
    try {
      if (selected.size > IMPORT_MAX_FILE_BYTES) throw new Error("Fichier limité à 20 Mo.");
      const text = await selected.text();
      const rows = parseImportFile(text);
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      const fingerprint = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
      const session = await supabase.auth.getUser();
      if (!session.data.user) throw new Error("Reconnectez-vous pour importer.");
      const key = `deep-dive-import:${session.data.user.id}:${fingerprint}`;
      try {
        const stored = JSON.parse(localStorage.getItem(key) ?? "null");
        if (stored && stored.expires > Date.now() && Number.isInteger(stored.progress?.offset) && stored.progress.offset <= rows.length) setProgress(stored.progress);
      } catch { /* A missing checkpoint never prevents idempotent replay. */ }
      setFile({ name: selected.name, rows, fingerprint, key });
    } catch (err) { setError(err instanceof Error ? err.message : "Fichier illisible."); }
  }

  async function run() {
    if (!file || active.current) return;
    active.current = true; stop.current = false; setBusy(true); setError("");
    let current = progress;
    try {
      while (current.offset < file.rows.length && !stop.current) {
        let rows = file.rows.slice(current.offset, current.offset + IMPORT_BATCH_SIZE);
        while (rows.length > 1 && !batchImportSchema.safeParse({ fingerprint: file.fingerprint, offset: current.offset, rows }).success) rows = rows.slice(0, Math.ceil(rows.length / 2));
        const input = batchImportSchema.parse({ fingerprint: file.fingerprint, offset: current.offset, rows });
        const result = await send({ data: input });
        current = { offset: current.offset + rows.length, inserted: current.inserted + result.inserted, duplicates: current.duplicates + result.duplicates, videos: current.videos + result.videos, readings: current.readings + result.readings, errors: [...current.errors, ...result.errors] };
        setProgress(current);
        try { localStorage.setItem(file.key, JSON.stringify({ expires: Date.now() + 7 * 86400000, progress: current })); }
        catch { setError("Progression non mémorisée sur cet appareil ; le même fichier peut être relancé sans doublons."); }
      }
      onComplete();
    } catch { setError("Import interrompu. Reprenez le lot en attente ; les sources déjà enregistrées restent intactes."); }
    finally { active.current = false; setBusy(false); }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ file: file?.name, ...progress }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "import-report.json"; link.click(); URL.revokeObjectURL(url);
  }

  return <section className="border-t border-border py-6">
    <h2 className="font-display text-xl text-foreground">Importer des sources</h2>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button variant="outline" asChild><label className={busy ? "pointer-events-none opacity-50" : "cursor-pointer"}><Upload />Choisir un fichier JSON<input aria-label="Fichier JSON de sources" type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={e => { void choose(e.target.files?.[0]); }} /></label></Button>
      {file && <span className="min-w-0 break-all text-sm text-muted-foreground">{file.name}</span>}
      {file && progress.offset < file.rows.length && !busy && <Button onClick={() => void run()}><Play />{progress.offset ? "Reprendre" : "Importer comme candidats"}</Button>}
      {busy && <Button variant="outline" onClick={() => { stop.current = true; }}><Pause />Pause</Button>}
      {file && <Button variant="ghost" onClick={download}><Download />Rapport</Button>}
    </div>
    {file && <div className="mt-4" role="status" aria-live="polite">
      <progress aria-label="Progression de l’import" className="h-2 w-full accent-primary" max={file.rows.length} value={progress.offset} />
      <p className="mt-2 text-sm text-muted-foreground">{progress.offset} / {file.rows.length} traitées · {progress.inserted} ajoutées · {progress.duplicates} doublons · {progress.errors.length} refusées</p>
      <p className="text-sm text-muted-foreground">{progress.readings} lectures · {progress.videos} vidéos · {progress.offset === file.rows.length ? "Terminé" : busy ? "En cours" : "En attente"}</p>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {progress.errors.length > 0 && <details className="mt-3 text-sm text-foreground"><summary>Éléments refusés</summary><ul className="max-h-64 overflow-auto">{progress.errors.map(e => <li key={e.index}>Ligne {e.index + 1} · Sujet {e.topicId ?? "?"} : {e.reason}</li>)}</ul></details>}
  </section>;
}