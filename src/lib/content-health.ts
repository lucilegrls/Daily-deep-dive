export interface HealthIncident {
  metric: string;
  status: "open" | "resolved";
  baseline: number;
  threshold: number;
  observed: number;
  lowest_observed: number;
  seen_count: number;
  opened_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolved_observed: number | null;
}

export const HEALTH_METRIC_LABELS: Record<string, string> = {
  published_topics: "Published topics",
  approved_sources: "Approved sources on published topics",
  published_categories: "Categories with published topics",
  active_lanes: "Active interest subjects",
};

/** Banner state for the editor's desk. */
export function healthBanner(
  incidents: HealthIncident[],
  lastCheckAt: string | null,
  now = Date.now(),
): { tone: "alert" | "ok" | "stale"; open: HealthIncident[]; recentlyResolved: HealthIncident[] } {
  const open = incidents.filter((i) => i.status === "open");
  const recentlyResolved = incidents.filter(
    (i) => i.status === "resolved" && i.resolved_at && now - Date.parse(i.resolved_at) < 7 * 86_400_000,
  );
  const stale = !lastCheckAt || now - Date.parse(lastCheckAt) > 36 * 3_600_000;
  return { tone: open.length ? "alert" : stale ? "stale" : "ok", open, recentlyResolved };
}
