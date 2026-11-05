import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getTopic } from "@/lib/content.functions";
import { useAccount } from "@/lib/account";
import { retryDelay, retryTransient, withTimeout } from "@/lib/retry";

/** A topic counts as read after this much visible time in the letter. */
const DWELL_MS = 15_000;

/**
 * Opens a topic in the letter sheet and counts a read only when the reader
 * actually stays with it: the tab must be visible and the letter still open
 * after a real stretch of reading time. Repeat opens on the same day are
 * ignored by the database.
 */
export function useOpenTopic() {
  const { recordRead } = useAccount();
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["topic", openId],
    queryFn: () => withTimeout(getTopic({ data: { id: openId } })),
    retry: retryTransient,
    retryDelay,
    enabled: openId !== null,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (openId === null) return;
    let elapsed = 0;
    let last = Date.now();

    const tick = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === "visible") elapsed += now - last;
      last = now;
      if (elapsed >= DWELL_MS) {
        window.clearInterval(tick);
        recordRead(openId);
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [openId, recordRead]);

  return {
    openId,
    openTopic: setOpenId,
    closeTopic: () => setOpenId(null),
    topic: openId !== null ? (data ?? null) : null,
    loading: isFetching,
    failed: openId !== null && isError && !isFetching,
    retry: () => void refetch(),
  };
}
