"use client";
import { useCallback, useEffect, useState } from "react";
import { getAccount, type Account } from "@/lib/api";

/** Loads the signed-in user's account bundle (profile + provider + draft + fleet), with optional polling. */
export function useAccount(userId: string | null | undefined, pollMs = 0) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setAccount(await getAccount(userId));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    if (!pollMs) return;
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { account, loading, error, refresh };
}

/** Polls an async loader on an interval; returns the latest value. */
export function usePolling<T>(loader: (() => Promise<T>) | null, ms: number, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const run = useCallback(async () => {
    if (!loader) return;
    try {
      setValue(await loader());
    } catch {
      // keep last value (offline)
    } finally {
      setLoaded(true);
    }
  }, [loader]);
  useEffect(() => {
    if (!loader) return;
    void run();
    const id = setInterval(run, ms);
    return () => clearInterval(id);
  }, [run, ms, loader]);
  return { value, loaded, refresh: run };
}
