/**
 * Editorial pipeline: library import and the daily expansion run.
 *
 * Both write through the admin client and both record a row in
 * `editorial_runs` with what was found, imported, skipped as a duplicate,
 * rejected and whatever fell short. Nothing here publishes unverified
 * material: drafted topics land with status `draft` and their suggested
 * sources land as `candidate`, waiting for a human in the editor's desk.
 */
import backlogData from "@/data/backlog.json";
import topicBank from "@/data/topic-bank.json";
import rawTopics from "@/data/topics.json";
import { isSafeSourceUrl, slugify } from "@/lib/content-safety";
import type { Topic } from "@/data/topics";



export interface RunResult {
  runId: string | null;
  status: "succeeded" | "partial" | "failed";
  found: number;
  imported: number;
  duplicates: number;
  rejected: number;
  shortfall?: string;
  details: Record<string, unknown>;
}

const GROUPS = ["books", "papers", "videos", "articles"] as const;

async function getAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

/** Idempotent import of the repository library into the content backend. */
export async function importLibrary(): Promise<RunResult> {
  const admin = await getAdmin();
  const library = rawTopics as unknown as { topics: Topic[]; updated?: string };
  const topics = library.topics;

  const { data: run } = await admin
    .from("editorial_runs")
    .insert({
      kind: "library_import",
      target_count: topics.length,
      found_count: topics.length,
    })
    .select("id")
    .single();
  const runId = run?.id ?? null;

  let imported = 0;
  let duplicates = 0;
  let rejected = 0;
  let failed = 0;
  const rejectedUrls: string[] = [];
  const failures: string[] = [];

  // Which topics already exist? Those are left exactly as they are: a rerun
  // must never overwrite an editor's later decision about status, title,
  // context or publication date.
  const { data: existingRows, error: existingError } = await admin
    .from("content_topics")
    .select("id");
  if (existingError) {
    failures.push(`Could not read the existing library: ${existingError.message}`);
  }
  const existingIds = new Set((existingRows ?? []).map((row) => row.id));

  for (const topic of topics) {
    const isNew = !existingIds.has(topic.id);

    if (isNew) {
      const { error } = await admin.from("content_topics").insert({
        id: topic.id,
        slug: slugify(topic.title),
        title: topic.title,
        category: topic.category,
        context: topic.context,
        takeaways: topic.takeaways ?? [],
        tags: topic.tags ?? [],
        status: "published",
        origin: "github:lucilegrls/Daily-deep-dive",
        last_verified: topic.lastVerified ?? null,
        published_at: new Date().toISOString(),
      });
      if (error) {
        failed += 1;
        failures.push(`Topic ${topic.id} (${topic.title}): ${error.message}`);
        continue;
      }
      imported += 1;
      existingIds.add(topic.id);
    } else {
      duplicates += 1;
    }

    // Provenance lives in editor-only storage and is refreshed harmlessly.
    const { error: provenanceError } = await admin
      .from("content_topic_private")
      .upsert(
        {
          topic_id: topic.id,
          provenance: {
            source: "src/data/topics.json",
            repo: "lucilegrls/Daily-deep-dive",
            libraryUpdated: library.updated ?? null,
            lastImportedAt: new Date().toISOString(),
          } as never,
        },
        { onConflict: "topic_id" },
      );
    if (provenanceError) {
      failed += 1;
      failures.push(`Provenance for topic ${topic.id}: ${provenanceError.message}`);
    }

    for (const kind of GROUPS) {
      const items = topic.ressources?.[kind] ?? [];
      let position = 0;
      for (const resource of items) {
        if (!isSafeSourceUrl(resource.url)) {
          rejected += 1;
          rejectedUrls.push(resource.url);
          continue;
        }
        const { error: existsError, count } = await admin
          .from("content_resources")
          .select("id", { count: "exact", head: true })
          .eq("topic_id", topic.id)
          .eq("url", resource.url);
        if (existsError) {
          failed += 1;
          failures.push(`Checking ${resource.url}: ${existsError.message}`);
          continue;
        }
        if ((count ?? 0) > 0) {
          duplicates += 1;
          position += 1;
          continue;
        }
        const { error: insertError } = await admin
          .from("content_resources")
          .insert({
            topic_id: topic.id,
            kind,
            title: resource.title,
            url: resource.url,
            author: resource.author ?? null,
            source: resource.source ?? null,
            publication: resource.publication ?? null,
            description: resource.description ?? null,
            review_status: "approved",
            verification: (resource.verification ?? {}) as never,
            last_checked: resource.verification?.checkedAt ?? null,
            position: position++,
            origin: "github:lucilegrls/Daily-deep-dive",
          });
        if (insertError) {
          failed += 1;
          failures.push(`Source ${resource.url}: ${insertError.message}`);
        }
      }
    }
  }

  // Idea backlog from the repository's editorial topic map.
  const backlog = backlogData as { family: string; idea: string }[];
  for (const item of backlog) {
    await admin
      .from("topic_backlog")
      .upsert(
        { family: item.family, idea: item.idea },
        { onConflict: "family,idea", ignoreDuplicates: true },
      );
  }

  // The 220 reviewed topic directions from the 19 September handoff, kept with
  // their group and mechanism notes. Research directions, not finished topics.
  const bank = topicBank as {
    group: string;
    set: string;
    title: string;
    notes: string;
  }[];
  for (const item of bank) {
    await admin.from("topic_backlog").upsert(
      {
        family: item.group,
        idea: item.title,
        notes: item.notes || null,
        source: `REPOSITORY_UPDATE_CONTEXT_2026-09-19.md · group ${item.set}`,
      },
      { onConflict: "family,idea", ignoreDuplicates: true },
    );
  }

  const result: RunResult = {
    runId,
    status: failed > 0 || rejected > 0 ? "partial" : "succeeded",
    found: topics.length,
    imported,
    duplicates,
    rejected,
    details: {
      backlogIdeas: backlog.length,
      reviewedTopicDirections: bank.length,
      rejectedUrls,
      failed,
      failures: failures.slice(0, 50),
      note: "Existing topics are never overwritten on a rerun. Links refused by the safety rule (Wikipedia or non-http/https) count as rejected; anything the database refused is counted separately as failed.",
    },
  };

  const shortfalls: string[] = [];
  if (rejected > 0) shortfalls.push(`${rejected} link(s) refused by the source-safety rule.`);
  if (failed > 0) shortfalls.push(`${failed} write(s) failed and were not saved.`);
  if (shortfalls.length > 0) result.shortfall = shortfalls.join(" ");

  if (runId) {
    await admin
      .from("editorial_runs")
      .update({
        status: result.status,
        imported_count: imported,
        duplicate_count: duplicates,
        rejected_count: rejected,
        shortfall_reason: result.shortfall ?? null,
        details: result.details as never,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }
  return result;
}

interface DraftedTopic {
  title: string;
  category: string;
  context: string;
  takeaways: string[];
  tags: string[];
  sources?: { kind: string; title: string; url: string; why?: string }[];
}

/**
 * Daily expansion: drafts up to `target` new topics from the idea backlog.
 * Drafts are never published automatically — they wait for review.
 */
export async function runDailyExpansion(target = 10): Promise<RunResult> {
  // AI drafting is paused (no AI spend). Opt-in only via an explicit flag.
  if (process.env["AI_DRAFTING_ENABLED"] !== "true") {
    return {
      runId: null, status: "failed", found: 0, imported: 0, duplicates: 0, rejected: 0,
      shortfall: "AI drafting is paused; nothing was drafted and no AI call was made.", details: {},
    };
  }
  const admin = await getAdmin();
  const apiKey = process.env["AI_API_KEY"];
  const apiBaseUrl = process.env["AI_API_BASE_URL"];
  const model = process.env["AI_MODEL"];
  // Duplicate-run guard: refuse while another run started within the hour.
  const { data: running } = await admin
    .from("editorial_runs")
    .select("id")
    .eq("kind", "daily_expansion")
    .eq("status", "running")
    .gte("started_at", new Date(Date.now() - 3_600_000).toISOString())
    .limit(1);
  if (running && running.length > 0) {
    return {
      runId: null, status: "failed", found: 0, imported: 0, duplicates: 0, rejected: 0,
      shortfall: "Another expansion run is already in progress.", details: {},
    };
  }

  const { data: run } = await admin
    .from("editorial_runs")
    .insert({ kind: "daily_expansion", target_count: target })
    .select("id")
    .single();
  const runId = run?.id ?? null;

  const fail = async (reason: string): Promise<RunResult> => {
    if (runId) {
      await admin
        .from("editorial_runs")
        .update({
          status: "failed",
          shortfall_reason: reason,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    return {
      runId,
      status: "failed",
      found: 0,
      imported: 0,
      duplicates: 0,
      rejected: 0,
      shortfall: reason,
      details: {},
    };
  };

  if (!apiKey || !apiBaseUrl || !model) {
    return fail("No optional research model is configured; no AI call was made.");
  }

  // Claim the next ideas so a second run picks up where this one left off
  // instead of taking the same entries again. Anything not used is released.
  const { data: candidates } = await admin
    .from("topic_backlog")
    .select("id, family, idea")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(target);
  if (!candidates || candidates.length === 0) return fail("The idea backlog is empty.");

  const { data: ideas, error: claimError } = await admin
    .from("topic_backlog")
    .update({ status: "claimed" })
    .in(
      "id",
      candidates.map((c) => c.id),
    )
    .eq("status", "open")
    .select("id, family, idea");
  if (claimError || !ideas || ideas.length === 0) {
    return fail("The idea queue could not be claimed; nothing was drafted.");
  }

  const release = async (status: "open" | "drafted", ids: string[]) => {
    if (ids.length === 0) return;
    await admin.from("topic_backlog").update({ status }).in("id", ids);
  };
  const claimedIds = new Set(ideas.map((i) => i.id));
  const usedIds = new Set<string>();
  const releaseUnused = () =>
    release(
      "open",
      [...claimedIds].filter((id) => !usedIds.has(id)),
    );

  const { data: existing } = await admin
    .from("content_topics")
    .select("slug");
  const existingSlugs = new Set((existing ?? []).map((row) => row.slug));

  let imported = 0;
  let duplicates = 0;
  let rejected = 0;
  const notes: string[] = [];

  const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You draft deep-dive topic briefs for an editorial review queue. Each brief must explain a mechanism or system, state what is well supported and what is contested, and stay factual. Never cite Wikipedia or any of its mirrors. Only propose sources whose exact URL you are confident exists; if unsure, propose none. Reply with JSON only: {\"topics\":[{\"title\":\"\",\"category\":\"\",\"context\":\"\",\"takeaways\":[\"\"],\"tags\":[\"\"],\"sources\":[{\"kind\":\"books|papers|videos|articles\",\"title\":\"\",\"url\":\"\",\"why\":\"\"}]}]}",
        },
        {
          role: "user",
          content: `Draft ${ideas.length} topic briefs, one for each idea below. Keep the subject family as the category.\n\n${ideas
            .map((i) => `- [${i.family}] ${i.idea}`)
            .join("\n")}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    await releaseUnused();
    return fail(`The research model refused the request (status ${response.status}).`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  let drafted: DraftedTopic[] = [];
  try {
    const json = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    drafted = (JSON.parse(json) as { topics?: DraftedTopic[] }).topics ?? [];
  } catch {
    await releaseUnused();
    return fail("The research model returned a reply that could not be read as topic briefs.");
  }

  const { data: maxRow } = await admin
    .from("content_topics")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);
  let nextId = (maxRow?.[0]?.id ?? 0) + 1;

  for (const [index, draft] of drafted.entries()) {
    const idea = ideas[index];
    if (!draft?.title || !draft?.context) {
      rejected += 1;
      continue;
    }
    const slug = slugify(draft.title);
    if (existingSlugs.has(slug)) {
      duplicates += 1;
      if (idea) usedIds.add(idea.id);
      continue;
    }
    const id = nextId++;
    const { error } = await admin.from("content_topics").insert({
      id,
      slug,
      title: draft.title,
      category: draft.category || "Uncategorised",
      context: draft.context,
      takeaways: Array.isArray(draft.takeaways) ? draft.takeaways.slice(0, 6) : [],
      tags: Array.isArray(draft.tags) ? draft.tags.slice(0, 8) : [],
      status: "draft",
      origin: "daily_expansion",
    });
    if (error) {
      rejected += 1;
      continue;
    }
    await admin.from("content_topic_private").upsert(
      {
        topic_id: id,
        provenance: {
          run: runId,
          backlogId: idea?.id ?? null,
          generatedAt: new Date().toISOString(),
          model: "google/gemini-3-flash-preview",
          note: "Drafted from the idea backlog. Not reviewed, not verified, not published.",
        } as never,
      },
      { onConflict: "topic_id" },
    );
    existingSlugs.add(slug);
    imported += 1;
    if (idea) usedIds.add(idea.id);

    for (const source of draft.sources ?? []) {
      if (!isSafeSourceUrl(source.url)) {
        rejected += 1;
        continue;
      }
      const kind = GROUPS.includes(source.kind as never)
        ? (source.kind as (typeof GROUPS)[number])
        : "articles";
      const { data: inserted, error: sourceError } = await admin
        .from("content_resources")
        .insert({
          topic_id: id,
          kind,
          title: source.title,
          url: source.url,
          review_status: "candidate",
          origin: "daily_expansion",
          verification: {
            limitation:
              "Suggested by the drafting model. The link has not been opened, read or verified.",
          },
        })
        .select("id")
        .single();
      if (sourceError || !inserted) {
        rejected += 1;
        continue;
      }
      if (source.why) {
        await admin.from("content_resource_private").upsert(
          { resource_id: inserted.id, selection_reason: source.why },
          { onConflict: "resource_id" },
        );
      }
    }
  }

  // Ideas that produced a draft are marked done; the rest go back in the queue.
  await release("drafted", [...usedIds]);
  await releaseUnused();

  if (imported < target) {
    notes.push(
      `${imported} of ${target} drafted. Shortfalls are left visible rather than padded with filler.`,
    );
  }
  notes.push("Every drafted topic stays unpublished until a person reviews it.");

  const result: RunResult = {
    runId,
    status: imported === 0 ? "failed" : imported < target ? "partial" : "succeeded",
    found: drafted.length,
    imported,
    duplicates,
    rejected,
    ...(imported < target ? { shortfall: notes[0] as string } : {}),
    details: { notes, ideas: ideas.map((i) => i.idea) },
  };

  if (runId) {
    await admin
      .from("editorial_runs")
      .update({
        status: result.status,
        found_count: drafted.length,
        imported_count: imported,
        duplicate_count: duplicates,
        rejected_count: rejected,
        shortfall_reason: result.shortfall ?? null,
        details: result.details as never,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
  }
  return result;
}
