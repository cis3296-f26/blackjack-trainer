import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyAccountStats,
  recordRound,
  type AccountStats,
  type RoundRecord,
} from "./engine/stat";
import { loadStats, saveStats } from "./statsStorage";

export type StatsStatus = "loading" | "ready" | "loadError" | "saveError";

export function useAccountStats(uid: string) {
  const [stats, setStats] = useState<AccountStats>(emptyAccountStats);
  const [status, setStatus] = useState<StatsStatus>("loading");
  const current = useRef<AccountStats | null>(null); // null until the saved stats arrive
  const pending = useRef<RoundRecord[]>([]); // rounds finished before loading completed

  // Each save writes the whole document, so a failed save is fixed by the next one
  const commit = useCallback(
    (next: AccountStats) => {
      current.current = next;
      setStats(next);
      saveStats(uid, next).then(
        () => setStatus("ready"),
        () => setStatus("saveError"),
      );
    },
    [uid],
  );

  // Load the saved stats once, then add any rounds that finished while loading
  useEffect(() => {
    let cancelled = false;
    loadStats(uid).then(
      (saved) => {
        if (cancelled) return;
        const queued = pending.current;
        pending.current = [];
        if (queued.length > 0) commit(queued.reduce(recordRound, saved));
        else {
          current.current = saved;
          setStats(saved);
          setStatus("ready");
        }
      },
      () => {
        if (!cancelled) setStatus("loadError");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uid, commit]);

  const record = useCallback(
    (round: RoundRecord) => {
      if (current.current) commit(recordRound(current.current, round));
      else pending.current.push(round);
    },
    [commit],
  );

  const reset = useCallback(() => {
    if (current.current) commit(emptyAccountStats);
  }, [commit]);

  return { stats, status, record, reset };
}
