import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { friendlyError } from "@/lib/friendly-error";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, exportMyData } from "@/lib/account-data.functions";

/** Download-my-data and delete-my-account, placed quietly at the end of the account page. */
export function AccountDataControls({ canEdit }: { canEdit: boolean }) {
  const { t } = useI18n();
  const exportFn = useServerFn(exportMyData);
  const deleteFn = useServerFn(deleteMyAccount);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [asking, setAsking] = useState(false);

  const download = async () => {
    setBusy(true); setMsg(null);
    try {
      const data = await exportFn();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = "deep-dive-my-data.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setMsg(friendlyError(e, undefined, t)); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setMsg(null);
    try {
      await deleteFn({ data: { confirm } });
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch (e) { setMsg(friendlyError(e, undefined, t)); setBusy(false); }
  };

  return (
    <section className="mt-10 border-t border-border pt-6 text-sm" aria-labelledby="your-data">
      <h2 id="your-data" className="font-display text-lg text-foreground">Your data</h2>
      <p className="mt-1 text-muted-foreground">Download everything you've saved, read and written, or delete your account. Deleting removes your notes, saves, reading history and suggestions for good.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void download()} className="min-h-11 rounded-full border border-border bg-card px-5 text-foreground">Download my data</button>
        {!canEdit && !asking ? (
          <button type="button" disabled={busy} onClick={() => setAsking(true)} className="min-h-11 rounded-full border border-destructive/50 px-5 text-destructive">Delete my account…</button>
        ) : null}
      </div>
      {asking ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="del-confirm" className="text-muted-foreground">Type DELETE to confirm</label>
          <input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2" />
          <button type="button" disabled={busy || confirm !== "DELETE"} onClick={() => void remove()} className="min-h-11 rounded-full bg-destructive px-5 text-destructive-foreground disabled:opacity-50">Delete permanently</button>
          <button type="button" onClick={() => { setAsking(false); setConfirm(""); }} className="min-h-11 rounded-full px-4 text-muted-foreground">Cancel</button>
        </div>
      ) : null}
      {msg ? <p role="alert" className="mt-2 text-destructive">{msg}</p> : null}
    </section>
  );
}
