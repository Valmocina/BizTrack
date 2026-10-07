// Loads data once on mount and exposes reload(). Errors are reported through notify.
import { useCallback, useEffect, useState } from "react";
import type { Notify } from "@/types";

export function useLoad<T>(fetcher: () => Promise<T>, initial: T, notify: Notify, label: string) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetcher());
    } catch (error) {
      notify(`Could not load ${label}: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { data, setData, loading, reload };
}
